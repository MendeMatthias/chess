import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../utils/logger.js";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  logger.error("Unhandled error:", { message: err.message, stack: err.stack });

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation error",
      details: err.errors.map((e) => ({ path: e.path.join("."), message: e.message })),
    });
  }

  if (err.message.includes("not found")) {
    return res.status(404).json({ error: err.message });
  }

  if (err.message.includes("Not your turn") || err.message.includes("Only") || err.message.includes("Cannot")) {
    return res.status(403).json({ error: err.message });
  }

  if (err.message.includes("Invalid move")) {
    return res.status(400).json({ error: "Invalid move" });
  }

  res.status(500).json({ error: "Internal server error" });
}
