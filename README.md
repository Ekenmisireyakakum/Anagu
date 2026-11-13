# ANAGU — Blockchain-Based Land Administration Platform

ANAGU is a blockchain-backed land title registration and administration system designed for the pilot state of Lagos, Nigeria.

## Stack

| Layer | Technology |
|-------|------------|
| Blockchain | Hyperledger Besu (QBFT, Chain ID 1337) |
| Smart Contracts | Solidity + Hardhat |
| Backend API | NestJS (TypeScript) |
| Frontend | Next.js 14 |
| Mobile | React Native / Expo |
| Database | PostgreSQL 15 + PostGIS |
| Cache | Redis 7 |
| Object Storage | MinIO |
| Messaging | Eclipse Mosquitto (MQTT) |
| Reverse Proxy | Nginx |

## Quick Start

### Prerequisites
- Docker Desktop 4.x+
- Node.js 20+
- npm 10+

### Windows (PowerShell)
```powershell
.\scripts\setup.ps1
```

### Linux / macOS
```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

## Project Structure

```
anagu/
├── apps/           # Application packages
│   ├── api/        # NestJS REST + WebSocket API
│   ├── web/        # Next.js frontend
│   └── mobile/     # React Native / Expo mobile app
├── packages/       # Shared packages
│   ├── contracts/  # Solidity smart contracts (Hardhat)
│   ├── shared/     # Shared TypeScript types
│   └── database/   # Prisma schema + migrations
├── infrastructure/ # Docker service configs
│   ├── besu/       # Hyperledger Besu network
│   ├── mosquitto/  # MQTT broker
│   ├── postgres/   # PostgreSQL init scripts
│   └── nginx/      # Reverse proxy
├── scripts/        # Setup and utility scripts
└── docs/           # Documentation
```

## Development

```bash
# Install all dependencies
npm install

# Start infrastructure services
docker compose up postgres redis minio mosquitto -d

# Start API (in a new terminal)
npm run dev:api

# Start Web (in a new terminal)
npm run dev:web
```

## Documentation

- [Architecture](./docs/architecture.md)
- [API Reference](./docs/api.md)
- [Blockchain](./docs/blockchain.md)
- [Deployment](./docs/deployment.md)
