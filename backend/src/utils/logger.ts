import winston from "winston";
import { config } from "../config/index.js";

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

export const logger = winston.createLogger({
  level: config.nodeEnv === "production" ? "info" : "debug",
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  defaultMeta: { service: "bonuz-chess" },
  transports: [new winston.transports.Console({ format: consoleFormat })],
});

if (config.nodeEnv === "production") {
  logger.add(new winston.transports.File({ filename: "error.log", level: "error" }));
  logger.add(new winston.transports.File({ filename: "combined.log" }));
}
