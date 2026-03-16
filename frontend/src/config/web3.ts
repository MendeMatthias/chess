"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { base, baseSepolia, hardhat } from "wagmi/chains";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo";

export const wagmiConfig = getDefaultConfig({
  appName: "Bonuz Chess",
  projectId,
  chains: [
    ...(process.env.NEXT_PUBLIC_CHAIN_ID === "8453" ? [base] : []),
    ...(process.env.NEXT_PUBLIC_CHAIN_ID === "84532" ? [baseSepolia] : []),
    ...(process.env.NODE_ENV === "development" ? [hardhat] : []),
  ],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL),
    [baseSepolia.id]: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL),
    [hardhat.id]: http("http://127.0.0.1:8545"),
  },
  ssr: true,
});

// Contract ABI (key functions)
export const BONUZ_CHESS_ABI = [
  {
    inputs: [],
    name: "createGame",
    outputs: [{ name: "gameId", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "_gameId", type: "uint256" }],
    name: "joinGame",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "_gameId", type: "uint256" }],
    name: "cancelGame",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "_gameId", type: "uint256" }],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "_gameId", type: "uint256" }],
    name: "getGame",
    outputs: [
      {
        components: [
          { name: "playerWhite", type: "address" },
          { name: "playerBlack", type: "address" },
          { name: "stakePerPlayer", type: "uint256" },
          { name: "creator", type: "address" },
          { name: "result", type: "uint8" },
          { name: "status", type: "uint8" },
          { name: "createdAt", type: "uint64" },
          { name: "startedAt", type: "uint64" },
          { name: "finishedAt", type: "uint64" },
          { name: "moveCount", type: "uint32" },
          { name: "finalBoardHash", type: "bytes32" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "_gameId", type: "uint256" },
      { name: "_player", type: "address" },
    ],
    name: "getPendingWithdrawal",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "_player", type: "address" }],
    name: "getPlayerStats",
    outputs: [
      { name: "gamesPlayed", type: "uint256" },
      { name: "wins", type: "uint256" },
      { name: "winRate", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}` | undefined;
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";
