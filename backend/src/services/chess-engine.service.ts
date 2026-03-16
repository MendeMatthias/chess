import { Chess } from "chess.js";
import { logger } from "../utils/logger.js";

export class ChessEngineService {
  private games: Map<string, Chess> = new Map();

  loadGame(gameId: string, fen?: string): Chess {
    const chess = new Chess(fen);
    this.games.set(gameId, chess);
    return chess;
  }

  getGame(gameId: string): Chess | undefined {
    return this.games.get(gameId);
  }

  makeMove(gameId: string, from: string, to: string, promotion?: string) {
    const chess = this.games.get(gameId);
    if (!chess) throw new Error(`Game ${gameId} not loaded`);

    try {
      const move = chess.move({ from, to, promotion });
      if (!move) throw new Error("Invalid move");

      const result = {
        move,
        fen: chess.fen(),
        san: move.san,
        isCheck: chess.isCheck(),
        isCheckmate: chess.isCheckmate(),
        isDraw: chess.isDraw(),
        isStalemate: chess.isStalemate(),
        isThreefoldRepetition: chess.isThreefoldRepetition(),
        isInsufficientMaterial: chess.isInsufficientMaterial(),
        isGameOver: chess.isGameOver(),
        turn: chess.turn(), // 'w' or 'b'
      };

      logger.debug(`Move in game ${gameId}: ${move.san}`, {
        fen: result.fen,
        isGameOver: result.isGameOver,
      });

      return result;
    } catch (error) {
      logger.warn(`Invalid move attempt in game ${gameId}: ${from}-${to}`, { error });
      throw new Error("Invalid move");
    }
  }

  validateMove(gameId: string, from: string, to: string, promotion?: string): boolean {
    const chess = this.games.get(gameId);
    if (!chess) return false;

    const moves = chess.moves({ verbose: true });
    return moves.some(
      (m) => m.from === from && m.to === to && (!promotion || m.promotion === promotion)
    );
  }

  getLegalMoves(gameId: string): string[] {
    const chess = this.games.get(gameId);
    if (!chess) return [];
    return chess.moves();
  }

  removeGame(gameId: string): void {
    this.games.delete(gameId);
  }

  getStatus(gameId: string) {
    const chess = this.games.get(gameId);
    if (!chess) return null;
    return {
      fen: chess.fen(),
      turn: chess.turn(),
      isCheck: chess.isCheck(),
      isCheckmate: chess.isCheckmate(),
      isDraw: chess.isDraw(),
      isGameOver: chess.isGameOver(),
      moveNumber: chess.moveNumber(),
      history: chess.history(),
    };
  }
}

export const chessEngine = new ChessEngineService();
