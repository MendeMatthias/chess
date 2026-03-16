"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { motion } from "framer-motion";
import { Clock, MessageCircle, Flag, Loader2, Wifi, WifiOff } from "lucide-react";
import { api } from "@/lib/api";
import { useGameSocket } from "@/hooks/useGameSocket";

export default function GamePage() {
  const params = useParams();
  const gameId = params.id as string;
  const { address } = useAccount();

  const [game, setGame] = useState<any>(null);
  const [chess] = useState(new Chess());
  const [boardPosition, setBoardPosition] = useState("start");
  const [loading, setLoading] = useState(true);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [showChat, setShowChat] = useState(false);

  const { isConnected: wsConnected, lastMessage } = useGameSocket(
    gameId,
    address || null
  );

  // Determine player orientation
  const playerColor =
    game?.blackPlayer?.walletAddress === address?.toLowerCase() ? "black" : "white";

  // Fetch game data
  const fetchGame = useCallback(async () => {
    try {
      const data = await api.getGame(gameId);
      setGame(data);
      if (data.currentFen) {
        chess.load(data.currentFen);
        setBoardPosition(data.currentFen);
      }
      if (data.moves) {
        setMoveHistory(data.moves.map((m: any) => m.san));
      }
    } catch (err) {
      console.error("Failed to fetch game:", err);
    } finally {
      setLoading(false);
    }
  }, [gameId, chess]);

  useEffect(() => {
    fetchGame();
  }, [fetchGame]);

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case "game:move": {
        const { move, game: updatedGame } = lastMessage.data as any;
        setGame(updatedGame);
        chess.load(updatedGame.currentFen);
        setBoardPosition(updatedGame.currentFen);
        setMoveHistory((prev) => [...prev, move.san]);
        break;
      }
      case "game:joined": {
        setGame(lastMessage.data);
        break;
      }
      case "game:finished": {
        const { game: finishedGame } = lastMessage.data as any;
        setGame(finishedGame);
        break;
      }
      case "chat:message": {
        setMessages((prev) => [...prev, lastMessage.data]);
        break;
      }
    }
  }, [lastMessage, chess]);

  // Handle piece drop
  const onDrop = async (sourceSquare: string, targetSquare: string, piece: string) => {
    if (!address || !game || game.status !== "ACTIVE") return false;

    // Check if it's this player's turn
    const isWhiteTurn = game.currentTurn === "WHITE";
    const isMyTurn =
      (isWhiteTurn && game.whitePlayer?.walletAddress === address.toLowerCase()) ||
      (!isWhiteTurn && game.blackPlayer?.walletAddress === address.toLowerCase());

    if (!isMyTurn) return false;

    // Determine promotion
    const isPromotion =
      piece[1] === "P" &&
      ((piece[0] === "w" && targetSquare[1] === "8") ||
        (piece[0] === "b" && targetSquare[1] === "1"));

    try {
      const result = await api.makeMove(gameId, {
        walletAddress: address,
        from: sourceSquare,
        to: targetSquare,
        promotion: isPromotion ? "q" : undefined,
      });

      chess.load(result.game.currentFen);
      setBoardPosition(result.game.currentFen);
      setGame(result.game);
      setMoveHistory((prev) => [...prev, result.move.san]);
      return true;
    } catch (err) {
      console.error("Move failed:", err);
      return false;
    }
  };

  const sendChat = async () => {
    if (!address || !chatInput.trim()) return;
    try {
      await api.sendMessage(gameId, { walletAddress: address, content: chatInput });
      setChatInput("");
    } catch {}
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-gold" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <p className="text-gray-400">Game not found</p>
      </div>
    );
  }

  const isGameOver = game.status === "FINISHED" || game.status === "CANCELLED";
  const isWaiting = game.status === "PENDING";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Board */}
        <div>
          {/* Status Bar */}
          <div className="mb-3 flex items-center justify-between rounded-lg border border-chess-border bg-chess-card px-4 py-2">
            <div className="flex items-center gap-2 text-sm">
              {wsConnected ? (
                <Wifi className="h-4 w-4 text-success" />
              ) : (
                <WifiOff className="h-4 w-4 text-danger" />
              )}
              <span className="text-gray-400">
                {isWaiting
                  ? "Waiting for opponent..."
                  : isGameOver
                    ? `Game Over — ${game.result?.replace("_", " ")}`
                    : `${game.currentTurn === "WHITE" ? "White" : "Black"}'s turn`}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Clock className="h-3 w-3" />
              {game.perMoveTimeLimit}s/move
            </div>
          </div>

          {/* Opponent Info */}
          <div className="mb-2 flex items-center gap-3 rounded-lg border border-chess-border bg-chess-card px-4 py-2">
            <div className="h-8 w-8 rounded-full bg-chess-darker text-center leading-8 text-lg">
              {playerColor === "white" ? "♚" : "♔"}
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                {playerColor === "white"
                  ? game.blackPlayer?.username || game.blackPlayer?.walletAddress?.slice(0, 10) || "Waiting..."
                  : game.whitePlayer?.username || game.whitePlayer?.walletAddress?.slice(0, 10) || "Waiting..."}
              </p>
              <p className="text-xs text-gray-500">Opponent</p>
            </div>
          </div>

          {/* Chess Board */}
          <div className="chess-board-container">
            <Chessboard
              id="bonuz-game"
              position={boardPosition}
              onPieceDrop={onDrop}
              boardOrientation={playerColor}
              boardWidth={560}
              customDarkSquareStyle={{ backgroundColor: "#779952" }}
              customLightSquareStyle={{ backgroundColor: "#edeed1" }}
              customBoardStyle={{
                borderRadius: "4px",
              }}
              animationDuration={200}
            />
          </div>

          {/* Player Info */}
          <div className="mt-2 flex items-center gap-3 rounded-lg border border-chess-border bg-chess-card px-4 py-2">
            <div className="h-8 w-8 rounded-full bg-chess-darker text-center leading-8 text-lg">
              {playerColor === "white" ? "♔" : "♚"}
            </div>
            <div>
              <p className="text-sm font-medium text-gold">
                You ({playerColor})
              </p>
              <p className="text-xs text-gray-500">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Game Info */}
          <div className="rounded-xl border border-chess-border bg-chess-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-300">Game Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Stake</span>
                <span className="text-gold">
                  {game.stakeAmount === "0" ? "Casual" : `${game.stakeAmount} ETH`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Moves</span>
                <span className="text-white">{game.moveCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={isGameOver ? "text-danger" : "text-success"}>
                  {game.status}
                </span>
              </div>
            </div>
          </div>

          {/* Move History */}
          <div className="rounded-xl border border-chess-border bg-chess-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-300">Moves</h3>
            <div className="max-h-48 overflow-y-auto font-mono text-xs">
              {moveHistory.length === 0 ? (
                <p className="text-gray-600">No moves yet</p>
              ) : (
                <div className="grid grid-cols-[2rem_1fr_1fr] gap-y-0.5">
                  {Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, i) => (
                    <div key={i} className="contents">
                      <span className="text-gray-600">{i + 1}.</span>
                      <span className="text-white">{moveHistory[i * 2]}</span>
                      <span className="text-gray-300">{moveHistory[i * 2 + 1] || ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Chat Toggle */}
          <button
            onClick={() => setShowChat(!showChat)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-chess-border bg-chess-card p-3 text-sm text-gray-400 transition-colors hover:border-gold hover:text-white"
          >
            <MessageCircle className="h-4 w-4" />
            {showChat ? "Hide Chat" : "Show Chat"}
          </button>

          {showChat && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="rounded-xl border border-chess-border bg-chess-card p-4"
            >
              <div className="mb-3 max-h-32 space-y-1 overflow-y-auto text-xs">
                {messages.map((msg) => (
                  <div key={msg.id}>
                    <span className="font-medium text-gold">
                      {msg.user?.walletAddress?.slice(0, 6)}:
                    </span>{" "}
                    <span className="text-gray-300">{msg.content}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                  placeholder="Type a message..."
                  className="flex-1 rounded-lg border border-chess-border bg-chess-darker px-3 py-1.5 text-sm text-white outline-none focus:border-gold"
                />
                <button
                  onClick={sendChat}
                  className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-chess-dark"
                >
                  Send
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
