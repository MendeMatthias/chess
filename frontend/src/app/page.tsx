"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Crown, Swords, Shield, Zap, Trophy, Wallet } from "lucide-react";

const features = [
  {
    icon: Swords,
    title: "Competitive Chess",
    description: "Play real-time PvP chess with per-move time controls and live game tracking.",
  },
  {
    icon: Wallet,
    title: "On-Chain Staking",
    description: "Stake crypto on your games. Smart contract escrow ensures fair, trustless payouts.",
  },
  {
    icon: Shield,
    title: "Secure & Auditable",
    description: "OpenZeppelin security, reentrancy guards, and pull payment patterns protect your funds.",
  },
  {
    icon: Zap,
    title: "Low Gas, Fast Play",
    description: "Only critical events hit the chain. Moves happen instantly off-chain via WebSocket.",
  },
  {
    icon: Trophy,
    title: "90/10 Split",
    description: "Winners take 90% of the pot. 10% feeds the platform treasury. Simple and fair.",
  },
  {
    icon: Crown,
    title: "Built on Base",
    description: "Deployed on Base L2 for minimal gas fees and maximum speed.",
  },
];

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      {/* Hero */}
      <section className="relative flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/4 h-96 w-96 -translate-x-1/2 rounded-full bg-gold/5 blur-[120px]" />
          <div className="absolute right-1/4 top-1/2 h-64 w-64 rounded-full bg-accent/5 blur-[100px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-chess-border bg-chess-card px-4 py-1.5 text-sm text-gray-400">
            <Crown className="h-4 w-4 text-gold" />
            Web3 Competitive Chess
          </div>

          <h1 className="font-display text-5xl font-bold leading-tight tracking-tight sm:text-7xl">
            <span className="text-white">Stake.</span>{" "}
            <span className="gold-gradient">Play.</span>{" "}
            <span className="text-white">Win.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg text-gray-400">
            The first decentralized chess platform where every game can be a wager.
            Connect your wallet, challenge an opponent, and let the smart contract
            handle the rest.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/lobby"
              className="gold-glow inline-flex items-center gap-2 rounded-lg bg-gold px-8 py-3 font-semibold text-chess-dark transition-all hover:bg-gold-light"
            >
              <Swords className="h-5 w-5" />
              Enter the Arena
            </Link>
            <a
              href="https://github.com/bonuz-chess"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-chess-border px-8 py-3 text-gray-300 transition-all hover:border-gold hover:text-white"
            >
              View Source
            </a>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-24">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
            How It Works
          </h2>
          <p className="mt-4 text-gray-400">
            Chess meets DeFi. Every game is provably fair.
          </p>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="card-hover rounded-xl border border-chess-border bg-chess-card p-6"
            >
              <feature.icon className="mb-4 h-8 w-8 text-gold" />
              <h3 className="mb-2 text-lg font-semibold text-white">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-400">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-chess-border py-24 text-center">
        <h2 className="font-display text-3xl font-bold text-white">
          Ready to Play?
        </h2>
        <p className="mx-auto mt-4 max-w-md text-gray-400">
          Connect your wallet and create your first game in seconds.
        </p>
        <Link
          href="/lobby"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-gold px-8 py-3 font-semibold text-chess-dark transition-all hover:bg-gold-light"
        >
          <Crown className="h-5 w-5" />
          Start Playing
        </Link>
      </section>
    </div>
  );
}
