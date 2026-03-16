import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { config, validateConfig } from "./config/index.js";
import { logger } from "./utils/logger.js";
import { errorHandler } from "./middleware/error.js";
import { wsService } from "./services/ws.service.js";
import routes from "./routes/index.js";

validateConfig();

const app = express();
const server = createServer(app);

// Middleware
app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());
app.use(
  rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMaxRequests,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Routes
app.use("/api", routes);

// Error handling
app.use(errorHandler);

// WebSocket
wsService.init(server);

// Start
server.listen(config.port, () => {
  logger.info(`🏁 Bonuz Chess server running on port ${config.port}`);
  logger.info(`   Environment: ${config.nodeEnv}`);
  logger.info(`   Contract: ${config.contractAddress || "not configured"}`);
  logger.info(`   WebSocket: ws://localhost:${config.port}/ws`);
});

export { app, server };
