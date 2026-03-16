import { PrismaClient, GameStatus } from "@prisma/client";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { gameService } from "../services/game.service.js";

const prisma = new PrismaClient();

async function checkTimeouts() {
  try {
    const activeGames = await prisma.game.findMany({
      where: { status: GameStatus.ACTIVE },
      select: { id: true, lastMoveAt: true, perMoveTimeLimit: true },
    });

    const now = Date.now();
    let timedOut = 0;

    for (const game of activeGames) {
      if (!game.lastMoveAt) continue;

      const elapsed = (now - game.lastMoveAt.getTime()) / 1000;
      if (elapsed > game.perMoveTimeLimit) {
        const result = await gameService.handleTimeout(game.id);
        if (result) {
          timedOut++;
          logger.info(`Timeout: game ${game.id} after ${Math.floor(elapsed)}s`);
        }
      }
    }

    if (timedOut > 0) {
      logger.info(`Timeout check: ${timedOut}/${activeGames.length} games timed out`);
    }
  } catch (error) {
    logger.error("Timeout check failed", { error });
  }
}

async function checkAbandoned() {
  try {
    const cutoff = new Date(Date.now() - config.gameAbandonmentHours * 60 * 60 * 1000);

    const abandoned = await prisma.game.updateMany({
      where: {
        status: GameStatus.PENDING,
        createdAt: { lt: cutoff },
      },
      data: {
        status: GameStatus.CANCELLED,
        result: "CANCELLED",
        finishedAt: new Date(),
      },
    });

    if (abandoned.count > 0) {
      logger.info(`Cancelled ${abandoned.count} abandoned games`);
    }
  } catch (error) {
    logger.error("Abandonment check failed", { error });
  }
}

async function main() {
  logger.info("⏱️ Timeout monitor started");
  logger.info(`   Check interval: ${config.timeoutCheckIntervalMs / 1000}s`);
  logger.info(`   Abandonment threshold: ${config.gameAbandonmentHours}h`);

  // Run checks on interval
  setInterval(checkTimeouts, config.timeoutCheckIntervalMs);
  setInterval(checkAbandoned, 60 * 60 * 1000); // Every hour

  // Initial check
  await checkTimeouts();
  await checkAbandoned();
}

main().catch((err) => {
  logger.error("Timeout monitor crashed", { error: err });
  process.exit(1);
});
