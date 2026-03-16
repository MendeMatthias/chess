import { PrismaClient, GameStatus, GameResult, PlayerColor } from "@prisma/client";
import { chessEngine } from "./chess-engine.service.js";
import { logger } from "../utils/logger.js";
import { CreateGameInput, JoinGameInput, MakeMoveInput } from "../types/index.js";
import { nanoid } from "nanoid";

const prisma = new PrismaClient();

export class GameService {
  async getOrCreateUser(walletAddress: string) {
    const normalized = walletAddress.toLowerCase();
    return prisma.user.upsert({
      where: { walletAddress: normalized },
      update: { lastSeenAt: new Date() },
      create: { walletAddress: normalized },
    });
  }

  async createGame(input: CreateGameInput) {
    const user = await this.getOrCreateUser(input.walletAddress);

    const game = await prisma.game.create({
      data: {
        creatorId: user.id,
        stakeAmount: input.stakeAmount,
        perMoveTimeLimit: input.perMoveTimeLimit,
        isPrivate: input.isPrivate,
        inviteCode: input.isPrivate ? nanoid(8) : null,
        txHashCreate: input.txHash,
      },
      include: { creator: true },
    });

    logger.info(`Game created: ${game.id} by ${user.walletAddress}`, {
      stake: input.stakeAmount,
      timeLimit: input.perMoveTimeLimit,
    });

    return game;
  }

  async joinGame(gameId: string, input: JoinGameInput) {
    const user = await this.getOrCreateUser(input.walletAddress);

    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new Error("Game not found");
    if (game.status !== GameStatus.PENDING) throw new Error("Game is not pending");
    if (game.creatorId === user.id) throw new Error("Cannot join your own game");

    const updated = await prisma.game.update({
      where: { id: gameId },
      data: {
        whitePlayerId: game.creatorId,
        blackPlayerId: user.id,
        status: GameStatus.ACTIVE,
        startedAt: new Date(),
        lastMoveAt: new Date(),
        txHashJoin: input.txHash,
      },
      include: { whitePlayer: true, blackPlayer: true, creator: true },
    });

    // Load game into chess engine
    chessEngine.loadGame(gameId);

    logger.info(`Game joined: ${gameId} by ${user.walletAddress}`);
    return updated;
  }

  async makeMove(gameId: string, input: MakeMoveInput) {
    const user = await this.getOrCreateUser(input.walletAddress);

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: { whitePlayer: true, blackPlayer: true },
    });

    if (!game) throw new Error("Game not found");
    if (game.status !== GameStatus.ACTIVE) throw new Error("Game is not active");

    // Verify it's the correct player's turn
    const isWhiteTurn = game.currentTurn === PlayerColor.WHITE;
    const currentPlayerId = isWhiteTurn ? game.whitePlayerId : game.blackPlayerId;
    if (currentPlayerId !== user.id) throw new Error("Not your turn");

    // Load engine if not loaded
    if (!chessEngine.getGame(gameId)) {
      chessEngine.loadGame(gameId, game.currentFen);
    }

    // Make the move
    const result = chessEngine.makeMove(gameId, input.from, input.to, input.promotion);

    // Calculate time spent
    const now = new Date();
    const timeSpent = game.lastMoveAt
      ? Math.floor((now.getTime() - game.lastMoveAt.getTime()) / 1000)
      : 0;

    // Save move to database
    const move = await prisma.move.create({
      data: {
        gameId,
        playerId: user.id,
        from: input.from,
        to: input.to,
        promotion: input.promotion,
        fen: result.fen,
        san: result.san,
        moveNumber: game.moveCount + 1,
        timeSpent,
      },
    });

    // Update game state
    const updateData: any = {
      currentFen: result.fen,
      currentTurn: isWhiteTurn ? PlayerColor.BLACK : PlayerColor.WHITE,
      moveCount: game.moveCount + 1,
      lastMoveAt: now,
    };

    // Check if game is over
    if (result.isGameOver) {
      let gameResult = GameResult.DRAW;
      if (result.isCheckmate) {
        gameResult = isWhiteTurn ? GameResult.WHITE_WIN : GameResult.BLACK_WIN;
      }

      updateData.status = GameStatus.FINISHED;
      updateData.result = gameResult;
      updateData.finishedAt = now;

      // Update player stats
      await this.updatePlayerStats(game.whitePlayerId!, game.blackPlayerId!, gameResult);
      chessEngine.removeGame(gameId);

      logger.info(`Game finished: ${gameId} - ${gameResult}`);
    }

    const updatedGame = await prisma.game.update({
      where: { id: gameId },
      data: updateData,
      include: { whitePlayer: true, blackPlayer: true },
    });

    return { move, game: updatedGame, engineResult: result };
  }

  async getGame(gameId: string) {
    return prisma.game.findUnique({
      where: { id: gameId },
      include: {
        whitePlayer: true,
        blackPlayer: true,
        creator: true,
        moves: { orderBy: { createdAt: "asc" } },
      },
    });
  }

  async getLobbyGames() {
    return prisma.game.findMany({
      where: { status: GameStatus.PENDING, isPrivate: false },
      include: { creator: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async getActiveGames() {
    return prisma.game.findMany({
      where: { status: GameStatus.ACTIVE },
      include: { whitePlayer: true, blackPlayer: true },
      orderBy: { startedAt: "desc" },
      take: 50,
    });
  }

  async getUserGames(walletAddress: string) {
    const user = await this.getOrCreateUser(walletAddress);
    return prisma.game.findMany({
      where: {
        OR: [
          { creatorId: user.id },
          { whitePlayerId: user.id },
          { blackPlayerId: user.id },
        ],
      },
      include: { whitePlayer: true, blackPlayer: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async cancelGame(gameId: string, walletAddress: string) {
    const user = await this.getOrCreateUser(walletAddress);
    const game = await prisma.game.findUnique({ where: { id: gameId } });

    if (!game) throw new Error("Game not found");
    if (game.status !== GameStatus.PENDING) throw new Error("Can only cancel pending games");
    if (game.creatorId !== user.id) throw new Error("Only creator can cancel");

    return prisma.game.update({
      where: { id: gameId },
      data: {
        status: GameStatus.CANCELLED,
        result: GameResult.CANCELLED,
        finishedAt: new Date(),
      },
    });
  }

  async handleTimeout(gameId: string) {
    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (!game || game.status !== GameStatus.ACTIVE) return null;

    const now = new Date();
    const timeSinceLastMove = game.lastMoveAt
      ? (now.getTime() - game.lastMoveAt.getTime()) / 1000
      : Infinity;

    if (timeSinceLastMove <= game.perMoveTimeLimit) return null;

    // The player whose turn it is has timed out
    const result = game.currentTurn === PlayerColor.WHITE
      ? GameResult.BLACK_WIN
      : GameResult.WHITE_WIN;

    const updated = await prisma.game.update({
      where: { id: gameId },
      data: {
        status: GameStatus.FINISHED,
        result,
        finishedAt: now,
      },
      include: { whitePlayer: true, blackPlayer: true },
    });

    await this.updatePlayerStats(game.whitePlayerId!, game.blackPlayerId!, result);
    chessEngine.removeGame(gameId);

    logger.info(`Game timed out: ${gameId} - ${result}`);
    return updated;
  }

  private async updatePlayerStats(whiteId: string, blackId: string, result: GameResult) {
    const updates = [];

    updates.push(prisma.user.update({
      where: { id: whiteId },
      data: {
        gamesPlayed: { increment: 1 },
        ...(result === GameResult.WHITE_WIN ? { gamesWon: { increment: 1 } } : {}),
      },
    }));

    updates.push(prisma.user.update({
      where: { id: blackId },
      data: {
        gamesPlayed: { increment: 1 },
        ...(result === GameResult.BLACK_WIN ? { gamesWon: { increment: 1 } } : {}),
      },
    }));

    await Promise.all(updates);
  }

  // Chat
  async sendMessage(gameId: string, input: { walletAddress: string; content: string }) {
    const user = await this.getOrCreateUser(input.walletAddress);
    const game = await prisma.game.findUnique({ where: { id: gameId } });

    if (!game) throw new Error("Game not found");
    if (game.status !== GameStatus.ACTIVE) throw new Error("Chat only available in active games");

    const isPlayer = game.whitePlayerId === user.id || game.blackPlayerId === user.id;
    if (!isPlayer) throw new Error("Only players can chat");

    return prisma.chatMessage.create({
      data: {
        gameId,
        userId: user.id,
        content: input.content,
      },
      include: { user: true },
    });
  }

  async getMessages(gameId: string) {
    return prisma.chatMessage.findMany({
      where: { gameId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });
  }
}

export const gameService = new GameService();
