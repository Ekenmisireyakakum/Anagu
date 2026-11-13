# ANAGU Deployment Guide

## Development (Local)

### Prerequisites
- Docker Desktop 4.x+
- Node.js 20+ and npm 10+
- Git

### Quick Start

```bash
# Clone and enter the repo
git clone <repo-url>
cd anagu

# Windows PowerShell:
.\scripts\setup.ps1

# Linux / macOS:
./scripts/setup.sh
```

### Manual Steps

```bash
# 1. Install dependencies
npm install

# 2. Start infrastructure
docker compose up postgres redis minio mosquitto -d

# 3. Run database migrations
cd packages/database
npx prisma migrate dev
cd ../..

# 4. Compile smart contracts
cd packages/contracts
npm run compile
cd ../..

# 5. Start services
npm run dev:api   # Terminal 1
npm run dev:web   # Terminal 2
```

## Production Deployment

### Environment Variables

Set all variables from `.env.example` in your production environment:
- Use a secrets manager (AWS Secrets Manager, HashiCorp Vault) for sensitive values
- **Never** commit `.env` to git
- Generate a strong `JWT_SECRET` (minimum 64 characters)

### Docker Compose (Production)

```bash
# Build images
docker compose build api web

# Start all services
docker compose up -d

# View logs
docker compose logs -f api
```

### MQTT Security (Production)

1. Set `allow_anonymous false` in `mosquitto.conf`
2. Create a password file: `mosquitto_passwd -c /mosquitto/config/passwd <username>`
3. Add to `mosquitto.conf`: `password_file /mosquitto/config/passwd`
4. Update `MQTT_USERNAME` and `MQTT_PASSWORD` in `.env`

### Besu Network (Production)

1. Generate real validator keys: `./scripts/generate-besu-keys.sh`
2. Update `genesis.json` extraData with real validator addresses
3. Set `allow_anonymous=false` for Besu RPC in production
4. Enable TLS on Besu RPC endpoints
