import { z } from "zod";

export const CreateGameSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  stakeAmount: z.string().default("0"),
  perMoveTimeLimit: z.number().min(10).max(600).default(60),
  isPrivate: z.boolean().default(false),
  txHash: z.string().optional(),
});

export const JoinGameSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  txHash: z.string().optional(),
});

export const MakeMoveSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  from: z.string().min(2).max(2),
  to: z.string().min(2).max(2),
  promotion: z.enum(["q", "r", "b", "n"]).optional(),
});

export const SendMessageSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  content: z.string().min(1).max(250),
});

export type CreateGameInput = z.infer<typeof CreateGameSchema>;
export type JoinGameInput = z.infer<typeof JoinGameSchema>;
export type MakeMoveInput = z.infer<typeof MakeMoveSchema>;
export type SendMessageInput = z.infer<typeof SendMessageSchema>;

// WebSocket message types
export type WSMessageType =
  | "game:move"
  | "game:joined"
  | "game:finished"
  | "game:timeout"
  | "chat:message"
  | "player:connected"
  | "player:disconnected"
  | "error";

export interface WSMessage {
  type: WSMessageType;
  gameId: string;
  data: unknown;
  timestamp: number;
}
