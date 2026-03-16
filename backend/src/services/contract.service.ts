import { createPublicClient, createWalletClient, http, parseAbi, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat, baseSepolia, base } from "viem/chains";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

const BONUZ_CHESS_ABI = parseAbi([
  "function finishGame(uint256 _gameId, uint8 _result, uint32 _moveCount, bytes32 _finalBoardHash) external",
  "function cancelGame(uint256 _gameId) external",
  "function getGame(uint256 _gameId) external view returns (tuple(address playerWhite, address playerBlack, uint256 stakePerPlayer, address creator, uint8 result, uint8 status, uint64 createdAt, uint64 startedAt, uint64 finishedAt, uint32 moveCount, bytes32 finalBoardHash))",
  "function getPlayerStats(address _player) external view returns (uint256 gamesPlayed, uint256 wins, uint256 winRate)",
  "function totalGamesPlayed() external view returns (uint256)",
  "function totalVolume() external view returns (uint256)",
  "event GameCreated(uint256 indexed gameId, address indexed creator, uint256 stake)",
  "event GameJoined(uint256 indexed gameId, address indexed player)",
  "event GameStarted(uint256 indexed gameId, address playerWhite, address playerBlack)",
  "event GameFinished(uint256 indexed gameId, uint8 result, uint256 moveCount)",
]);

function getChain() {
  switch (config.chainId) {
    case 84532: return baseSepolia;
    case 8453: return base;
    default: return hardhat;
  }
}

const chain = getChain();

const publicClient = createPublicClient({
  chain,
  transport: http(config.rpcUrl),
});

function getWalletClient() {
  if (!config.backendSignerKey) {
    logger.warn("No backend signer key configured");
    return null;
  }

  const account = privateKeyToAccount(config.backendSignerKey);
  return createWalletClient({
    account,
    chain,
    transport: http(config.rpcUrl),
  });
}

export class ContractService {
  private contractAddress: Address | null;

  constructor() {
    this.contractAddress = config.contractAddress || null;
  }

  isConfigured(): boolean {
    return !!this.contractAddress && !!config.backendSignerKey;
  }

  async finishGameOnChain(
    onchainGameId: number,
    result: number, // 1=WHITE_WIN, 2=BLACK_WIN, 3=DRAW
    moveCount: number,
    finalFen: string
  ) {
    if (!this.isConfigured()) {
      logger.warn("Contract not configured, skipping on-chain finalization");
      return null;
    }

    const walletClient = getWalletClient();
    if (!walletClient) return null;

    try {
      const boardHash = `0x${Buffer.from(finalFen).toString("hex").padEnd(64, "0")}` as `0x${string}`;

      const hash = await walletClient.writeContract({
        address: this.contractAddress!,
        abi: BONUZ_CHESS_ABI,
        functionName: "finishGame",
        args: [BigInt(onchainGameId), result, moveCount, boardHash],
      });

      logger.info(`Game finalized on-chain: ${hash}`, { onchainGameId, result });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return { hash, receipt };
    } catch (error) {
      logger.error("Failed to finalize game on-chain", { error, onchainGameId });
      throw error;
    }
  }

  async getGameOnChain(onchainGameId: number) {
    if (!this.contractAddress) return null;

    try {
      return await publicClient.readContract({
        address: this.contractAddress,
        abi: BONUZ_CHESS_ABI,
        functionName: "getGame",
        args: [BigInt(onchainGameId)],
      });
    } catch (error) {
      logger.error("Failed to read game from chain", { error, onchainGameId });
      return null;
    }
  }

  async getContractStats() {
    if (!this.contractAddress) return null;

    try {
      const [totalGames, totalVolume] = await Promise.all([
        publicClient.readContract({
          address: this.contractAddress,
          abi: BONUZ_CHESS_ABI,
          functionName: "totalGamesPlayed",
        }),
        publicClient.readContract({
          address: this.contractAddress,
          abi: BONUZ_CHESS_ABI,
          functionName: "totalVolume",
        }),
      ]);

      return { totalGames, totalVolume };
    } catch (error) {
      logger.error("Failed to read contract stats", { error });
      return null;
    }
  }
}

export const contractService = new ContractService();
