import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { logger } from "../utils/logger.js";
import { WSMessage } from "../types/index.js";

interface GameConnection {
  ws: WebSocket;
  walletAddress: string;
  gameId: string;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private connections: Map<string, GameConnection[]> = new Map(); // gameId -> connections

  init(server: Server) {
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (ws, req) => {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const gameId = url.searchParams.get("gameId");
      const walletAddress = url.searchParams.get("wallet");

      if (!gameId || !walletAddress) {
        ws.close(1008, "Missing gameId or wallet");
        return;
      }

      this.addConnection(gameId, walletAddress, ws);

      ws.on("close", () => {
        this.removeConnection(gameId, ws);
        this.broadcast(gameId, {
          type: "player:disconnected",
          gameId,
          data: { walletAddress },
          timestamp: Date.now(),
        });
      });

      ws.on("error", (error) => {
        logger.error("WebSocket error", { gameId, walletAddress, error: error.message });
      });

      // Notify others
      this.broadcast(gameId, {
        type: "player:connected",
        gameId,
        data: { walletAddress },
        timestamp: Date.now(),
      }, ws);

      logger.debug(`WS connected: ${walletAddress} to game ${gameId}`);
    });

    logger.info("WebSocket server initialized");
  }

  private addConnection(gameId: string, walletAddress: string, ws: WebSocket) {
    const existing = this.connections.get(gameId) || [];
    existing.push({ ws, walletAddress, gameId });
    this.connections.set(gameId, existing);
  }

  private removeConnection(gameId: string, ws: WebSocket) {
    const existing = this.connections.get(gameId) || [];
    const filtered = existing.filter((c) => c.ws !== ws);
    if (filtered.length === 0) {
      this.connections.delete(gameId);
    } else {
      this.connections.set(gameId, filtered);
    }
  }

  broadcast(gameId: string, message: WSMessage, exclude?: WebSocket) {
    const connections = this.connections.get(gameId) || [];
    const payload = JSON.stringify(message);

    for (const conn of connections) {
      if (conn.ws !== exclude && conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(payload);
      }
    }
  }

  getConnectedPlayers(gameId: string): string[] {
    const connections = this.connections.get(gameId) || [];
    return [...new Set(connections.map((c) => c.walletAddress))];
  }

  getStats() {
    let totalConnections = 0;
    for (const conns of this.connections.values()) {
      totalConnections += conns.length;
    }
    return {
      activeGames: this.connections.size,
      totalConnections,
    };
  }
}

export const wsService = new WebSocketService();
