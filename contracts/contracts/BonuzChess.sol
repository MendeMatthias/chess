// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BonuzChess
 * @dev Decentralized chess game with staking, escrow, and automated payouts
 * @notice Handles game creation, joining, result finalization, and payouts
 * @custom:security ReentrancyGuard + Pull payments + Access control
 */
contract BonuzChess is ReentrancyGuard, Ownable, Pausable {

    // ============ Enums ============

    enum GameResult { NONE, WHITE_WIN, BLACK_WIN, DRAW, CANCELLED }
    enum GameStatus { PENDING, ACTIVE, FINISHED, CANCELLED }

    // ============ Structs ============

    struct Game {
        address playerWhite;
        address playerBlack;
        uint256 stakePerPlayer;
        address creator;
        GameResult result;
        GameStatus status;
        uint64 createdAt;
        uint64 startedAt;
        uint64 finishedAt;
        uint32 moveCount;
        bytes32 finalBoardHash;
    }

    // ============ State Variables ============

    uint256 public gameIdCounter;
    address public treasury;
    uint16 public treasuryFeeBps; // Basis points (1000 = 10%)
    uint256 public constant MAX_FEE_BPS = 2000;
    uint256 public minStake;
    uint256 public maxStake;
    uint256 public totalGamesPlayed;
    uint256 public totalVolume;

    mapping(uint256 => Game) public games;
    mapping(uint256 => mapping(address => uint256)) public pendingWithdrawals;
    mapping(address => bool) public authorizedCallers;
    mapping(address => uint256) public playerGameCount;
    mapping(address => uint256) public playerWinCount;

    // ============ Events ============

    event GameCreated(uint256 indexed gameId, address indexed creator, uint256 stake);
    event GameJoined(uint256 indexed gameId, address indexed player);
    event GameStarted(uint256 indexed gameId, address playerWhite, address playerBlack);
    event GameFinished(uint256 indexed gameId, GameResult result, uint256 moveCount);
    event GameCancelled(uint256 indexed gameId, address indexed cancelledBy);
    event WithdrawalAvailable(uint256 indexed gameId, address indexed player, uint256 amount);
    event Withdrawn(address indexed player, uint256 amount, uint256 gameId);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event FeeUpdated(uint16 oldFee, uint16 newFee);
    event CallerAuthorized(address indexed caller, bool authorized);
    event StakeLimitsUpdated(uint256 minStake, uint256 maxStake);

    // ============ Errors ============

    error Unauthorized();
    error InvalidAddress();
    error InvalidFee();
    error InvalidStake();
    error GameNotFound();
    error GameNotPending();
    error GameNotActive();
    error NotGamePlayer();
    error AlreadyJoined();
    error NoFundsToWithdraw();
    error TransferFailed();
    error StakeMismatch();

    // ============ Modifiers ============

    modifier onlyAuthorized() {
        if (!authorizedCallers[msg.sender] && msg.sender != owner()) revert Unauthorized();
        _;
    }

    modifier gameExists(uint256 _gameId) {
        if (_gameId >= gameIdCounter) revert GameNotFound();
        _;
    }

    // ============ Constructor ============

    constructor(
        address _treasury,
        uint16 _treasuryFeeBps,
        uint256 _minStake,
        uint256 _maxStake
    ) Ownable(msg.sender) {
        if (_treasury == address(0)) revert InvalidAddress();
        if (_treasuryFeeBps > MAX_FEE_BPS) revert InvalidFee();

        treasury = _treasury;
        treasuryFeeBps = _treasuryFeeBps;
        minStake = _minStake;
        maxStake = _maxStake;
    }

    // ============ Core Game Functions ============

    /**
     * @notice Create a new chess game with optional stake
     * @return gameId The ID of the created game
     */
    function createGame() external payable whenNotPaused returns (uint256 gameId) {
        if (msg.value > 0) {
            if (msg.value < minStake || msg.value > maxStake) revert InvalidStake();
        }

        gameId = gameIdCounter++;

        Game storage game = games[gameId];
        game.creator = msg.sender;
        game.stakePerPlayer = msg.value;
        game.status = GameStatus.PENDING;
        game.createdAt = uint64(block.timestamp);

        emit GameCreated(gameId, msg.sender, msg.value);
    }

    /**
     * @notice Join an existing pending game
     * @param _gameId The ID of the game to join
     */
    function joinGame(uint256 _gameId) external payable whenNotPaused gameExists(_gameId) nonReentrant {
        Game storage game = games[_gameId];

        if (game.status != GameStatus.PENDING) revert GameNotPending();
        if (msg.sender == game.creator) revert AlreadyJoined();
        if (msg.value != game.stakePerPlayer) revert StakeMismatch();

        // Assign colors (creator = white, joiner = black)
        game.playerWhite = game.creator;
        game.playerBlack = msg.sender;
        game.status = GameStatus.ACTIVE;
        game.startedAt = uint64(block.timestamp);

        emit GameJoined(_gameId, msg.sender);
        emit GameStarted(_gameId, game.playerWhite, game.playerBlack);
    }

    /**
     * @notice Finalize a game and distribute winnings
     * @param _gameId The ID of the game
     * @param _result The game result
     * @param _moveCount Total moves played
     * @param _finalBoardHash Hash of the final board state
     */
    function finishGame(
        uint256 _gameId,
        GameResult _result,
        uint32 _moveCount,
        bytes32 _finalBoardHash
    ) external onlyAuthorized gameExists(_gameId) nonReentrant {
        Game storage game = games[_gameId];

        if (game.status != GameStatus.ACTIVE) revert GameNotActive();

        game.result = _result;
        game.status = GameStatus.FINISHED;
        game.finishedAt = uint64(block.timestamp);
        game.moveCount = _moveCount;
        game.finalBoardHash = _finalBoardHash;

        totalGamesPlayed++;
        playerGameCount[game.playerWhite]++;
        playerGameCount[game.playerBlack]++;

        uint256 totalPot = game.stakePerPlayer * 2;
        totalVolume += totalPot;

        if (totalPot > 0) {
            _distributePayout(_gameId, game, _result, totalPot);
        }

        emit GameFinished(_gameId, _result, _moveCount);
    }

    /**
     * @notice Cancel a pending game (creator only or authorized)
     * @param _gameId The ID of the game to cancel
     */
    function cancelGame(uint256 _gameId) external gameExists(_gameId) nonReentrant {
        Game storage game = games[_gameId];

        if (game.status != GameStatus.PENDING) revert GameNotPending();
        if (msg.sender != game.creator && !authorizedCallers[msg.sender] && msg.sender != owner()) {
            revert Unauthorized();
        }

        game.status = GameStatus.CANCELLED;
        game.result = GameResult.CANCELLED;
        game.finishedAt = uint64(block.timestamp);

        // Refund creator's stake
        if (game.stakePerPlayer > 0) {
            pendingWithdrawals[_gameId][game.creator] += game.stakePerPlayer;
            emit WithdrawalAvailable(_gameId, game.creator, game.stakePerPlayer);
        }

        emit GameCancelled(_gameId, msg.sender);
    }

    /**
     * @notice Withdraw pending funds (pull payment pattern)
     * @param _gameId The game ID to withdraw from
     */
    function withdraw(uint256 _gameId) external gameExists(_gameId) nonReentrant {
        uint256 amount = pendingWithdrawals[_gameId][msg.sender];
        if (amount == 0) revert NoFundsToWithdraw();

        pendingWithdrawals[_gameId][msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit Withdrawn(msg.sender, amount, _gameId);
    }

    // ============ Internal Functions ============

    function _distributePayout(
        uint256 _gameId,
        Game storage game,
        GameResult _result,
        uint256 totalPot
    ) internal {
        uint256 treasuryFee = (totalPot * treasuryFeeBps) / 10000;
        uint256 winnerPayout = totalPot - treasuryFee;

        if (_result == GameResult.WHITE_WIN) {
            pendingWithdrawals[_gameId][game.playerWhite] += winnerPayout;
            playerWinCount[game.playerWhite]++;
            emit WithdrawalAvailable(_gameId, game.playerWhite, winnerPayout);
        } else if (_result == GameResult.BLACK_WIN) {
            pendingWithdrawals[_gameId][game.playerBlack] += winnerPayout;
            playerWinCount[game.playerBlack]++;
            emit WithdrawalAvailable(_gameId, game.playerBlack, winnerPayout);
        } else if (_result == GameResult.DRAW) {
            uint256 halfPot = totalPot / 2;
            pendingWithdrawals[_gameId][game.playerWhite] += halfPot;
            pendingWithdrawals[_gameId][game.playerBlack] += halfPot;
            emit WithdrawalAvailable(_gameId, game.playerWhite, halfPot);
            emit WithdrawalAvailable(_gameId, game.playerBlack, halfPot);
            treasuryFee = totalPot - (halfPot * 2); // Handle rounding
        }

        // Transfer treasury fee directly
        if (treasuryFee > 0) {
            (bool success, ) = payable(treasury).call{value: treasuryFee}("");
            if (!success) revert TransferFailed();
        }
    }

    // ============ Admin Functions ============

    function setAuthorizedCaller(address _caller, bool _authorized) external onlyOwner {
        if (_caller == address(0)) revert InvalidAddress();
        authorizedCallers[_caller] = _authorized;
        emit CallerAuthorized(_caller, _authorized);
    }

    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert InvalidAddress();
        address old = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(old, _treasury);
    }

    function setTreasuryFee(uint16 _feeBps) external onlyOwner {
        if (_feeBps > MAX_FEE_BPS) revert InvalidFee();
        uint16 old = treasuryFeeBps;
        treasuryFeeBps = _feeBps;
        emit FeeUpdated(old, _feeBps);
    }

    function setStakeLimits(uint256 _min, uint256 _max) external onlyOwner {
        minStake = _min;
        maxStake = _max;
        emit StakeLimitsUpdated(_min, _max);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ============ View Functions ============

    function getGame(uint256 _gameId) external view gameExists(_gameId) returns (Game memory) {
        return games[_gameId];
    }

    function getPlayerStats(address _player) external view returns (
        uint256 gamesPlayed,
        uint256 wins,
        uint256 winRate
    ) {
        gamesPlayed = playerGameCount[_player];
        wins = playerWinCount[_player];
        winRate = gamesPlayed > 0 ? (wins * 10000) / gamesPlayed : 0;
    }

    function getPendingWithdrawal(uint256 _gameId, address _player) external view returns (uint256) {
        return pendingWithdrawals[_gameId][_player];
    }

    receive() external payable {}
}
