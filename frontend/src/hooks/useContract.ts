"use client";

import { useWriteContract, useReadContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther } from "viem";
import { BONUZ_CHESS_ABI, CONTRACT_ADDRESS } from "@/config/web3";

export function useCreateGameOnChain() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const createGame = (stakeEth: string) => {
    if (!CONTRACT_ADDRESS) throw new Error("Contract not configured");
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: BONUZ_CHESS_ABI,
      functionName: "createGame",
      value: stakeEth !== "0" ? parseEther(stakeEth) : 0n,
    });
  };

  return { createGame, hash, isPending, isConfirming, isSuccess, error };
}

export function useJoinGameOnChain() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const joinGame = (onchainGameId: number, stakeEth: string) => {
    if (!CONTRACT_ADDRESS) throw new Error("Contract not configured");
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: BONUZ_CHESS_ABI,
      functionName: "joinGame",
      args: [BigInt(onchainGameId)],
      value: stakeEth !== "0" ? parseEther(stakeEth) : 0n,
    });
  };

  return { joinGame, hash, isPending, isConfirming, isSuccess, error };
}

export function useWithdraw() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const withdraw = (onchainGameId: number) => {
    if (!CONTRACT_ADDRESS) throw new Error("Contract not configured");
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: BONUZ_CHESS_ABI,
      functionName: "withdraw",
      args: [BigInt(onchainGameId)],
    });
  };

  return { withdraw, hash, isPending, isConfirming, isSuccess, error };
}

export function usePendingWithdrawal(onchainGameId: number, playerAddress?: `0x${string}`) {
  return useReadContract({
    address: CONTRACT_ADDRESS!,
    abi: BONUZ_CHESS_ABI,
    functionName: "getPendingWithdrawal",
    args: onchainGameId != null && playerAddress ? [BigInt(onchainGameId), playerAddress] : undefined,
    query: { enabled: !!CONTRACT_ADDRESS && !!playerAddress && onchainGameId != null },
  });
}

export function usePlayerStats(playerAddress?: `0x${string}`) {
  return useReadContract({
    address: CONTRACT_ADDRESS!,
    abi: BONUZ_CHESS_ABI,
    functionName: "getPlayerStats",
    args: playerAddress ? [playerAddress] : undefined,
    query: { enabled: !!CONTRACT_ADDRESS && !!playerAddress },
  });
}

export { formatEther, parseEther };
