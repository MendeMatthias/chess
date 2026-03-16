import { expect } from "chai";
import { ethers } from "hardhat";
import { BonuzChess } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("BonuzChess", function () {
  let chess: BonuzChess;
  let owner: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;
  let player1: HardhatEthersSigner;
  let player2: HardhatEthersSigner;
  let backend: HardhatEthersSigner;

  const STAKE = ethers.parseEther("0.01");
  const FEE_BPS = 1000; // 10%
  const MIN_STAKE = ethers.parseEther("0.001");
  const MAX_STAKE = ethers.parseEther("10");

  beforeEach(async function () {
    [owner, treasury, player1, player2, backend] = await ethers.getSigners();

    const BonuzChess = await ethers.getContractFactory("BonuzChess");
    chess = await BonuzChess.deploy(treasury.address, FEE_BPS, MIN_STAKE, MAX_STAKE);
    await chess.waitForDeployment();

    await chess.setAuthorizedCaller(backend.address, true);
  });

  describe("Deployment", function () {
    it("should set correct initial values", async function () {
      expect(await chess.treasury()).to.equal(treasury.address);
      expect(await chess.treasuryFeeBps()).to.equal(FEE_BPS);
      expect(await chess.owner()).to.equal(owner.address);
      expect(await chess.minStake()).to.equal(MIN_STAKE);
      expect(await chess.maxStake()).to.equal(MAX_STAKE);
    });

    it("should reject zero address treasury", async function () {
      const BonuzChess = await ethers.getContractFactory("BonuzChess");
      await expect(
        BonuzChess.deploy(ethers.ZeroAddress, FEE_BPS, MIN_STAKE, MAX_STAKE)
      ).to.be.revertedWithCustomError(chess, "InvalidAddress");
    });

    it("should reject fee above max", async function () {
      const BonuzChess = await ethers.getContractFactory("BonuzChess");
      await expect(
        BonuzChess.deploy(treasury.address, 2001, MIN_STAKE, MAX_STAKE)
      ).to.be.revertedWithCustomError(chess, "InvalidFee");
    });
  });

  describe("Game Creation", function () {
    it("should create a game with stake", async function () {
      const tx = await chess.connect(player1).createGame({ value: STAKE });
      await expect(tx).to.emit(chess, "GameCreated").withArgs(0, player1.address, STAKE);

      const game = await chess.getGame(0);
      expect(game.creator).to.equal(player1.address);
      expect(game.stakePerPlayer).to.equal(STAKE);
      expect(game.status).to.equal(0); // PENDING
    });

    it("should create a casual game (no stake)", async function () {
      await chess.connect(player1).createGame();
      const game = await chess.getGame(0);
      expect(game.stakePerPlayer).to.equal(0);
    });

    it("should reject stake below minimum", async function () {
      await expect(
        chess.connect(player1).createGame({ value: ethers.parseEther("0.0001") })
      ).to.be.revertedWithCustomError(chess, "InvalidStake");
    });

    it("should increment game ID counter", async function () {
      await chess.connect(player1).createGame({ value: STAKE });
      await chess.connect(player1).createGame({ value: STAKE });
      expect(await chess.gameIdCounter()).to.equal(2);
    });
  });

  describe("Joining Games", function () {
    beforeEach(async function () {
      await chess.connect(player1).createGame({ value: STAKE });
    });

    it("should allow a player to join with correct stake", async function () {
      const tx = await chess.connect(player2).joinGame(0, { value: STAKE });
      await expect(tx).to.emit(chess, "GameJoined").withArgs(0, player2.address);
      await expect(tx).to.emit(chess, "GameStarted").withArgs(0, player1.address, player2.address);

      const game = await chess.getGame(0);
      expect(game.playerWhite).to.equal(player1.address);
      expect(game.playerBlack).to.equal(player2.address);
      expect(game.status).to.equal(1); // ACTIVE
    });

    it("should reject creator joining their own game", async function () {
      await expect(
        chess.connect(player1).joinGame(0, { value: STAKE })
      ).to.be.revertedWithCustomError(chess, "AlreadyJoined");
    });

    it("should reject wrong stake amount", async function () {
      await expect(
        chess.connect(player2).joinGame(0, { value: ethers.parseEther("0.005") })
      ).to.be.revertedWithCustomError(chess, "StakeMismatch");
    });
  });

  describe("Finishing Games", function () {
    const BOARD_HASH = ethers.keccak256(ethers.toUtf8Bytes("final-board"));

    beforeEach(async function () {
      await chess.connect(player1).createGame({ value: STAKE });
      await chess.connect(player2).joinGame(0, { value: STAKE });
    });

    it("should finish game with white win and distribute funds", async function () {
      const tx = await chess.connect(backend).finishGame(0, 1, 40, BOARD_HASH); // WHITE_WIN
      await expect(tx).to.emit(chess, "GameFinished").withArgs(0, 1, 40);

      const game = await chess.getGame(0);
      expect(game.status).to.equal(2); // FINISHED
      expect(game.result).to.equal(1); // WHITE_WIN

      // White should get 90% of the pot (stake * 2 - 10% fee)
      const totalPot = STAKE * 2n;
      const fee = (totalPot * BigInt(FEE_BPS)) / 10000n;
      const winnerPayout = totalPot - fee;

      expect(await chess.pendingWithdrawals(0, player1.address)).to.equal(winnerPayout);
      expect(await chess.pendingWithdrawals(0, player2.address)).to.equal(0);
    });

    it("should handle draw correctly", async function () {
      await chess.connect(backend).finishGame(0, 3, 50, BOARD_HASH); // DRAW

      const halfPot = STAKE; // Each gets their stake back (no fee on draws in this impl)
      expect(await chess.pendingWithdrawals(0, player1.address)).to.equal(halfPot);
      expect(await chess.pendingWithdrawals(0, player2.address)).to.equal(halfPot);
    });

    it("should reject unauthorized callers", async function () {
      await expect(
        chess.connect(player1).finishGame(0, 1, 40, BOARD_HASH)
      ).to.be.revertedWithCustomError(chess, "Unauthorized");
    });

    it("should update player stats", async function () {
      await chess.connect(backend).finishGame(0, 1, 40, BOARD_HASH);

      const [gamesP1, winsP1] = await chess.getPlayerStats(player1.address);
      expect(gamesP1).to.equal(1);
      expect(winsP1).to.equal(1);

      const [gamesP2, winsP2] = await chess.getPlayerStats(player2.address);
      expect(gamesP2).to.equal(1);
      expect(winsP2).to.equal(0);
    });
  });

  describe("Withdrawals", function () {
    const BOARD_HASH = ethers.keccak256(ethers.toUtf8Bytes("final-board"));

    beforeEach(async function () {
      await chess.connect(player1).createGame({ value: STAKE });
      await chess.connect(player2).joinGame(0, { value: STAKE });
      await chess.connect(backend).finishGame(0, 1, 40, BOARD_HASH);
    });

    it("should allow winner to withdraw", async function () {
      const balanceBefore = await ethers.provider.getBalance(player1.address);
      const tx = await chess.connect(player1).withdraw(0);
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(player1.address);

      const totalPot = STAKE * 2n;
      const fee = (totalPot * BigInt(FEE_BPS)) / 10000n;
      const expected = totalPot - fee;

      expect(balanceAfter - balanceBefore + gasCost).to.equal(expected);
    });

    it("should reject double withdrawal", async function () {
      await chess.connect(player1).withdraw(0);
      await expect(
        chess.connect(player1).withdraw(0)
      ).to.be.revertedWithCustomError(chess, "NoFundsToWithdraw");
    });
  });

  describe("Game Cancellation", function () {
    beforeEach(async function () {
      await chess.connect(player1).createGame({ value: STAKE });
    });

    it("should allow creator to cancel pending game", async function () {
      await chess.connect(player1).cancelGame(0);
      const game = await chess.getGame(0);
      expect(game.status).to.equal(3); // CANCELLED
      expect(await chess.pendingWithdrawals(0, player1.address)).to.equal(STAKE);
    });

    it("should not cancel active game", async function () {
      await chess.connect(player2).joinGame(0, { value: STAKE });
      await expect(
        chess.connect(player1).cancelGame(0)
      ).to.be.revertedWithCustomError(chess, "GameNotPending");
    });
  });

  describe("Admin Functions", function () {
    it("should update treasury", async function () {
      await chess.setTreasury(player1.address);
      expect(await chess.treasury()).to.equal(player1.address);
    });

    it("should update fee", async function () {
      await chess.setTreasuryFee(500);
      expect(await chess.treasuryFeeBps()).to.equal(500);
    });

    it("should reject non-owner admin calls", async function () {
      await expect(
        chess.connect(player1).setTreasury(player1.address)
      ).to.be.revertedWithCustomError(chess, "OwnableUnauthorizedAccount");
    });

    it("should pause and unpause", async function () {
      await chess.pause();
      await expect(
        chess.connect(player1).createGame({ value: STAKE })
      ).to.be.revertedWithCustomError(chess, "EnforcedPause");

      await chess.unpause();
      await chess.connect(player1).createGame({ value: STAKE });
    });
  });
});
