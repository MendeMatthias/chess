import { Router, Request, Response, NextFunction } from "express";
import { gameService } from "../services/game.service.js";
import { wsService } from "../services/ws.service.js";
import { CreateGameSchema, JoinGameSchema, MakeMoveSchema, SendMessageSchema } from "../types/index.js";
import { logger } from "../utils/logger.js";

const router = Router();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

// Health check
router.get("/health", (_req, res) => {
  const ws = wsService.getStats();
  res.json({ status: "ok", timestamp: new Date().toISOString(), ws });
});

// === GAME ROUTES ===

router.post("/games", asyncHandler(async (req, res) => {
  const input = CreateGameSchema.parse(req.body);
  const game = await gameService.createGame(input);
  res.status(201).json(game);
}));

router.get("/games/lobby", asyncHandler(async (_req, res) => {
  const games = await gameService.getLobbyGames();
  res.json(games);
}));

router.get("/games/active", asyncHandler(async (_req, res) => {
  const games = await gameService.getActiveGames();
  res.json(games);
}));

router.get("/games/:id", asyncHandler(async (req, res) => {
  const game = await gameService.getGame(req.params.id);
  if (!game) return res.status(404).json({ error: "Game not found" });
  res.json(game);
}));

router.post("/games/:id/join", asyncHandler(async (req, res) => {
  const input = JoinGameSchema.parse(req.body);
  const game = await gameService.joinGame(req.params.id, input);

  wsService.broadcast(req.params.id, {
    type: "game:joined",
    gameId: req.params.id,
    data: game,
    timestamp: Date.now(),
  });

  res.json(game);
}));

router.post("/games/:id/move", asyncHandler(async (req, res) => {
  const input = MakeMoveSchema.parse(req.body);
  const { move, game, engineResult } = await gameService.makeMove(req.params.id, input);

  wsService.broadcast(req.params.id, {
    type: "game:move",
    gameId: req.params.id,
    data: { move, game, engineResult },
    timestamp: Date.now(),
  });

  if (engineResult.isGameOver) {
    wsService.broadcast(req.params.id, {
      type: "game:finished",
      gameId: req.params.id,
      data: { game, result: game.result },
      timestamp: Date.now(),
    });
  }

  res.json({ move, game, engineResult });
}));

router.post("/games/:id/cancel", asyncHandler(async (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) return res.status(400).json({ error: "walletAddress required" });

  const game = await gameService.cancelGame(req.params.id, walletAddress);
  res.json(game);
}));

// === CHAT ROUTES ===

router.get("/games/:id/messages", asyncHandler(async (req, res) => {
  const messages = await gameService.getMessages(req.params.id);
  res.json(messages);
}));

router.post("/games/:id/messages", asyncHandler(async (req, res) => {
  const input = SendMessageSchema.parse(req.body);
  const message = await gameService.sendMessage(req.params.id, input);

  wsService.broadcast(req.params.id, {
    type: "chat:message",
    gameId: req.params.id,
    data: message,
    timestamp: Date.now(),
  });

  res.status(201).json(message);
}));

// === USER ROUTES ===

router.get("/users/:wallet", asyncHandler(async (req, res) => {
  const user = await gameService.getOrCreateUser(req.params.wallet);
  res.json(user);
}));

router.get("/users/:wallet/games", asyncHandler(async (req, res) => {
  const games = await gameService.getUserGames(req.params.wallet);
  res.json(games);
}));

export default router;
