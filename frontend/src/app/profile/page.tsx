"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Trophy, Swords, Coins, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { usePlayerStats } from "@/hooks/useContract";
import Link from "next/link";

export default function ProfilePage() {
  const { address } = useAccount();
  const [user, setUser] = useState<any>(null);
  const [games, setGames] = useState<any[]>([]);
  const { data: onchainStats } = usePlayerStats(address);

  useEffect(() => {
    if (!address) return;
    api.getUser(address).then(setUser).catch(console.error);
    api.getUserGames(address).then(setGames).catch(console.error);
  }, [address]);

  if (!address) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-400">Connect your wallet to view your profile</p>
      </div>
    );
  }

  const stats = [
    { label: "Games Played", value: user?.gamesPlayed || 0, icon: Swords },
    { label: "Wins", value: user?.gamesWon || 0, icon: Trophy },
    { label: "Win Rate", value: user?.gamesPlayed ? `${Math.round((user.gamesWon / user.gamesPlayed) * 100)}%` : "—", icon: TrendingUp },
    { label: "Rating", value: user?.rating || 1200, icon: Coins },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-white">Profile</h1>
        <p className="mt-1 font-mono text-sm text-gray-500">{address}</p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-chess-border bg-chess-card p-4 text-center">
            <stat.icon className="mx-auto mb-2 h-6 w-6 text-gold" />
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="mt-1 text-xs text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-4 text-lg font-semibold text-white">Recent Games</h2>
      {games.length === 0 ? (
        <p className="text-gray-500">No games yet. <Link href="/lobby" className="text-gold hover:underline">Play now</Link></p>
      ) : (
        <div className="space-y-2">
          {games.map((game) => (
            <Link
              key={game.id}
              href={`/game/${game.id}`}
              className="card-hover flex items-center justify-between rounded-lg border border-chess-border bg-chess-card px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{game.result === "WHITE_WIN" ? "♔" : game.result === "BLACK_WIN" ? "♚" : "½"}</span>
                <div>
                  <p className="text-sm text-white">
                    vs {game.whitePlayer?.walletAddress === address.toLowerCase()
                      ? game.blackPlayer?.walletAddress?.slice(0, 10)
                      : game.whitePlayer?.walletAddress?.slice(0, 10) || "—"}
                  </p>
                  <p className="text-xs text-gray-500">{game.moveCount} moves</p>
                </div>
              </div>
              <span className={`text-xs font-medium ${
                game.status === "FINISHED" ? "text-gray-400" :
                game.status === "ACTIVE" ? "text-success" : "text-warning"
              }`}>
                {game.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
