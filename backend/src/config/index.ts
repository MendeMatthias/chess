import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT || "3001"),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "postgresql://localhost:5432/bonuzchess",

  // Blockchain
  contractAddress: process.env.CONTRACT_ADDRESS as `0x${string}` | undefined,
  backendSignerKey: process.env.BACKEND_SIGNER_PRIVATE_KEY as `0x${string}` | undefined,
  rpcUrl: process.env.RPC_URL || "http://127.0.0.1:8545",
  chainId: parseInt(process.env.CHAIN_ID || "31337"),

  // Game
  defaultPerMoveTimeLimit: 60,
  minStake: process.env.MIN_STAKE || "0.001",
  maxStake: process.env.MAX_STAKE || "10",

  // Security
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  rateLimitWindowMs: 15 * 60 * 1000,
  rateLimitMaxRequests: 100,

  // Chat
  maxMessageLength: 250,
  maxMessagesPerMinute: 10,

  // Timeouts
  gameAbandonmentHours: 24,
  timeoutCheckIntervalMs: 60_000,
} as const;

export function validateConfig() {
  const warnings: string[] = [];
  if (!process.env.DATABASE_URL) warnings.push("DATABASE_URL not set");
  if (!process.env.CONTRACT_ADDRESS) warnings.push("CONTRACT_ADDRESS not set");
  if (!process.env.BACKEND_SIGNER_PRIVATE_KEY) warnings.push("BACKEND_SIGNER_PRIVATE_KEY not set");
  if (warnings.length > 0) {
    console.warn("⚠️ Configuration warnings:", warnings.join(", "));
  }
}
