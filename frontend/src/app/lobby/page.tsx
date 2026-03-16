"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, Swords, Clock, Coins, Loader2, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { useCreateGameOnChain } from "@/hooks/useContract";
import { formatEther } from "viem";

export default function LobbyPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [stakeAmount, setStakeAmount] = useState("0");
  const [timeLimit, setTimeLimit] = useState(60);
  const [creating, setCreating] = useState(false);

  const { createGame: createOnChain, hash, isConfirming, isSuccess } = useCreateGameOnChain();

  const fetchGames = async () => {
    try {
      const data = await api.getLobbyGames();
      setGames(data);
    } catch (err) {
      console.error("Failed to fetch games:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
    const interval = setInterval(fetchGames, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = async () => {
    if (!address) return;
    setCreating(true);
    try {
      // If staking, create on-chain first
      if (stakeAmount !== "0") {
        createOnChain(stakeAmount);
      }

      // Create in backend
      const game = await api.createGame({
        walletAddress: address,
        stakeAmount,
        perMoveTimeLimit: timeLimit,
        txHash: hash,
      });

      router.push(`/game/${game.id}`);
    } catch (err) {
      console.error("Failed to create game:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (gameId: string) => {
    if (!address) return;
    try {
      await api.joinGame(gameId, { walletAddress: address });
      router.push(`/game/${gameId}`);
    } catch (err) {
      console.error("Failed to join game:", err);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Arena</h1>
          <p className="mt-1 text-gray-400">Find an opponent or create a new game</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchGames}
            className="flex items-center gap-2 rounded-lg border border-chess-border px-4 py-2 text-sm text-gray-300 transition-colors hover:border-gold hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-chess-dark transition-colors hover:bg-gold-light"
          >
            <Plus className="h-4 w-4" />
            New Game
          </button>
        </div>
      </div>

      {/* Create Game Form */}
      {showCreate && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mb-8 rounded-xl border border-chess-border bg-chess-card p-6"
        >
          <h2 className="mb-4 text-lg font-semibold text-white">Create New Game</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-gray-400">Stake (ETH)</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                className="w-full rounded-lg border border-chess-border bg-chess-darker px-4 py-2 text-white outline-none focus:border-gold"
                placeholder="0 for casual"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-400">Time per move (seconds)</label>
              <select
                value={timeLimit}
                onChange={(e) => setTimeLimit(Number(e.target.value))}
                className="w-full rounded-lg border border-chess-border bg-chess-darker px-4 py-2 text-white outline-none focus:border-gold"
              >
                <option value={30}>30s - Blitz</option>
                <option value={60}>60s - Standard</option>
                <option value={120}>120s - Relaxed</option>
                <option value={300}>300s - Classical</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={!isConnected || creating}
            className="mt-4 flex items-center gap-2 rounded-lg bg-gold px-6 py-2 font-semibold text-chess-dark transition-colors hover:bg-gold-light disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
            {creating ? "Creating..." : "Create Game"}
          </button>

          {!isConnected && (
            <p className="mt-2 text-sm text-warning">Connect your wallet to create a game</p>
          )}
        </motion.div>
      )}

      {/* Games List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      ) : games.length === 0 ? (
        <div className="rounded-xl border border-chess-border bg-chess-card py-20 text-center">
          <Swords className="mx-auto mb-4 h-12 w-12 text-gray-600" />
          <p className="text-lg text-gray-400">No games waiting</p>
          <p className="mt-1 text-sm text-gray-500">Be the first — create a game above</p>
        </div>
      ) : (
        <div className="space-y-3">
          {games.map((game, i) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card-hover flex items-center justify-between rounded-xl border border-chess-border bg-chess-card p-4"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-chess-darker text-gold">
                  ♔
                </div>
                <div>
                  <p className="font-medium text-white">
                    {game.creator?.username || `${game.creator?.walletAddress?.slice(0, 6)}...${game.creator?.walletAddress?.slice(-4)}`}
                  </p>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Coins className="h-3 w-3" />
                      {game.stakeAmount === "0" ? "Casual" : `${game.stakeAmount} ETH`}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {game.perMoveTimeLimit}s/move
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleJoin(game.id)}
                disabled={!isConnected || game.creator?.walletAddress === address?.toLowerCase()}
                className="rounded-lg border border-gold bg-transparent px-4 py-1.5 text-sm font-medium text-gold transition-all hover:bg-gold hover:text-chess-dark disabled:opacity-30"
              >
                Join
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
