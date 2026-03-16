# ♟️ Bonuz Chess — Web3 Competitive Chess Platform

Stake crypto, play chess, win on-chain. A decentralized PvP chess platform with smart contract escrow, real-time gameplay via WebSocket, and a modern Next.js frontend.

## Stack (2026 Edition)

| Layer | Tech | Version |
|-------|------|---------|
| Smart Contracts | Solidity + OpenZeppelin | 0.8.28 / v5.6 |
| Contract Tooling | Hardhat | v2.22 |
| Backend | Node.js + Express + TypeScript | Node 22 / Express 5 |
| Database | PostgreSQL + Prisma | PG 17 / Prisma 6 |
| Real-time | WebSocket (ws) | v8.18 |
| Blockchain Client | Viem | v2.23 |
| Frontend | Next.js + React + Tailwind CSS | Next 16 / React 19 / TW 4 |
| Web3 Frontend | Wagmi + RainbowKit | Wagmi 3.5 / RK 2.2 |
| Chess Engine | chess.js | v1.0 |
| Chess UI | react-chessboard | v4.7 |
| Target Chain | Base (L2) | — |

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────┐
│   Frontend   │────▶│   Backend    │────▶│ Database │
│  Next.js 16  │ WS  │  Express 5   │     │ Postgres │
│  Wagmi 3     │◀────│  chess.js    │     └──────────┘
└──────┬──────┘     └──────┬───────┘
       │                    │
       │                    ▼
       │            ┌──────────────┐
       └───────────▶│  Base Chain  │
        Viem/Wagmi  │ BonuzChess.sol│
                    └──────────────┘
```

**Key design decision**: Moves happen off-chain (WebSocket) for speed. Only game creation, joining, and result finalization hit the blockchain. This keeps gas costs minimal while maintaining trustless payouts.

## Quick Start

### Prerequisites

- Node.js 22+
- PostgreSQL 17+
- MetaMask or any Web3 wallet

### 1. Clone & Install

```bash
git clone <repo-url> && cd bonuz-chess
npm install        # root workspace
cd contracts && npm install && cd ..
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### 2. Configure Environment

```bash
cp contracts/.env.example contracts/.env
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
# Edit each with your values
```

### 3. Database

```bash
createdb bonuzchess
cd backend
npx prisma migrate dev
npx prisma generate
```

### 4. Run Everything

```bash
# Terminal 1 — Local blockchain
cd contracts && npx hardhat node

# Terminal 2 — Deploy contract
cd contracts && npx hardhat run scripts/deploy.ts --network localhost

# Terminal 3 — Backend API
cd backend && npm run dev

# Terminal 4 — Timeout worker
cd backend && npm run worker

# Terminal 5 — Frontend
cd frontend && npm run dev
```

Open **http://localhost:3000** and connect your wallet.

### Docker Alternative

```bash
docker compose up -d
```

## Project Structure

```
bonuz-chess/
├── contracts/               # Solidity smart contracts
│   ├── contracts/BonuzChess.sol
│   ├── scripts/deploy.ts
│   ├── test/BonuzChess.test.ts
│   └── hardhat.config.ts
├── backend/                 # Node.js API server
│   ├── prisma/schema.prisma
│   └── src/
│       ├── config/
│       ├── middleware/
│       ├── routes/
│       ├── services/        # Game, Chess Engine, Contract, WS
│       ├── workers/         # Timeout monitor
│       └── index.ts
├── frontend/                # Next.js 16 app
│   └── src/
│       ├── app/             # Pages (home, lobby, game, profile)
│       ├── components/      # UI, Layout, Web3
│       ├── hooks/           # useGameSocket, useContract
│       ├── lib/             # API client
│       └── config/          # Wagmi/Web3 config
├── docker-compose.yml
└── package.json             # Workspace root
```

## Smart Contract

**BonuzChess.sol** — deployed on Base L2.

- Create games with optional ETH stake
- Join games by matching the stake
- Backend finalizes results on-chain
- Pull-payment pattern for secure withdrawals
- 90/10 split: winner gets 90%, treasury gets 10%
- ReentrancyGuard, Pausable, Ownable (OpenZeppelin v5)

```bash
cd contracts
npx hardhat test        # Run test suite
npx hardhat coverage    # Coverage report
```

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/health | Health check + WS stats |
| POST | /api/games | Create a game |
| GET | /api/games/lobby | List pending games |
| GET | /api/games/active | List active games |
| GET | /api/games/:id | Get game details + moves |
| POST | /api/games/:id/join | Join a game |
| POST | /api/games/:id/move | Make a move |
| POST | /api/games/:id/cancel | Cancel pending game |
| GET | /api/games/:id/messages | Get chat messages |
| POST | /api/games/:id/messages | Send chat message |
| GET | /api/users/:wallet | Get user profile |
| GET | /api/users/:wallet/games | Get user's games |

## WebSocket

Connect to `ws://localhost:3001/ws?gameId=<id>&wallet=<address>` for real-time events:

- `game:move` — opponent made a move
- `game:joined` — opponent joined
- `game:finished` — game ended
- `game:timeout` — player timed out
- `chat:message` — new chat message
- `player:connected` / `player:disconnected`

## Deployment

### Testnet (Base Sepolia)

1. Get testnet ETH from a faucet
2. Set `BASE_SEPOLIA_RPC_URL` and `DEPLOYER_PRIVATE_KEY` in contracts/.env
3. `npm run deploy:testnet`
4. Copy contract address to backend/.env and frontend/.env.local

### Production

1. Deploy contract to Base mainnet
2. Run `docker compose up -d` on your server
3. Point your domain to the frontend (port 3000)
4. Set up SSL with nginx/Caddy

## License

MIT
