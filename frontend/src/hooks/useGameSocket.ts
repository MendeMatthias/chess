"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { WS_URL } from "@/config/web3";

interface WSMessage {
  type: string;
  gameId: string;
  data: any;
  timestamp: number;
}

export function useGameSocket(gameId: string | null, walletAddress: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    if (!gameId || !walletAddress) return;

    const ws = new WebSocket(`${WS_URL}/ws?gameId=${gameId}&wallet=${walletAddress}`);

    ws.onopen = () => {
      setIsConnected(true);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };

    ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        setLastMessage(message);
      } catch {}
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Auto-reconnect after 3s
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();

    wsRef.current = ws;
  }, [gameId, walletAddress]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { isConnected, lastMessage };
}
