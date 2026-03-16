"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Crown, Swords, User } from "lucide-react";

export function Navbar() {
  return (
    <nav className="glass sticky top-0 z-50 border-b border-chess-border">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <Crown className="h-6 w-6 text-gold" />
          <span className="font-display text-xl font-bold text-white">
            Bonuz <span className="text-gold">Chess</span>
          </span>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          <Link
            href="/lobby"
            className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-gold"
          >
            <Swords className="h-4 w-4" />
            Play
          </Link>
          <Link
            href="/profile"
            className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-gold"
          >
            <User className="h-4 w-4" />
            Profile
          </Link>
        </div>

        <ConnectButton
          chainStatus="icon"
          showBalance={false}
          accountStatus="avatar"
        />
      </div>
    </nav>
  );
}
