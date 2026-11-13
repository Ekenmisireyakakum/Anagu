# ANAGU System Architecture

## Overview

ANAGU (a name meaning 'bright future') is a blockchain-backed land title registration and administration system built for the Lagos, Nigeria pilot. It digitizes and immutably records land ownership on a permissioned Hyperledger Besu blockchain, while providing a modern web and mobile interface for citizens, surveyors, registrars, and government administrators.

## System Diagram (ASCII)

```
                         ┌─────────────────────────────────────────────────┐
                         │                   INTERNET                      │
                         └──────────────┬──────────────────────────────────┘
                                        │ HTTPS :443 / HTTP :80
                         ┌──────────────▼──────────────┐
                         │        Nginx Reverse Proxy  │
                         │       (Load balancer/TLS)   │
                         └───┬──────────────────────┬──┘
               /api/*        │                      │   /*
       ┌───────▼─────────┐   │          ┌───────────▼──────────┐
       │   NestJS API    │   │          │    Next.js Frontend  │
       │   :3001         │   │          │    :3000             │
       │ REST + WS + MQTT│   │          │  SSR + React         │
       └──┬──┬──┬────┬───┘   │          └──────────────────────┘
          │  │  │    │
     ┌────┘  │  │    └──────────────────┐
     │       │  │                       │
┌────▼────┐ ┌▼──────┐ ┌──────────┐ ┌───▼──────────────────────┐
│PostgreSQL│ │ Redis  │ │  MinIO   │ │  Hyperledger Besu        │
│+PostGIS │ │ Cache  │ │ Storage  │ │  QBFT Consensus          │
│ :5432   │ │ :6379  │ │:9000/9001│ │  node1:8545/8546/30303   │
└─────────┘ └────────┘ └──────────┘ │  node2:8547/30304        │
                                     │  node3:8548/30305        │
       ┌──────────────────┐          │  node4:8549/30306        │
       │ Eclipse Mosquitto│          └──────────────────────────┘
       │ MQTT :1883       │
       │ WebSocket :9001  │
       └──────────────────┘
```

## Services and Responsibilities

| Service | Technology | Responsibility |
|---------|-----------|----------------|
| **api** | NestJS 10 | REST API, WebSocket, JWT auth, business logic, MQTT publisher |
| **web** | Next.js 14 | SSR frontend, citizen and admin portals |
| **mobile** | Expo 51 / React Native | iOS and Android mobile apps (Expo Go) |
| **postgres** | PostgreSQL 15 + PostGIS | Persistent relational data, spatial geometry |
| **redis** | Redis 7 | Session cache, job queues, pub/sub |
| **minio** | MinIO | Document object storage (max 10 MB/file) |
| **mosquitto** | Eclipse Mosquitto 2 | MQTT broker for real-time event delivery |
| **besu-node1–4** | Hyperledger Besu | 4-validator QBFT blockchain, chain ID 1337 |
| **nginx** | Nginx Alpine | Reverse proxy, TLS termination, WebSocket upgrade |

## Data Flow: Land Registration

```
1. CITIZEN submits application (web/mobile)
   └─► POST /api/applications
       └─► Postgres: creates Application record
       └─► MinIO: stores uploaded documents
       └─► MQTT: publishes anagu/application/submitted

2. REGISTRAR reviews documents
   └─► PATCH /api/applications/:id/status → UNDER_REVIEW
       └─► Postgres: updates status
       └─► MQTT: publishes anagu/application/status-changed

3. SURVEYOR performs spatial verification
   └─► POST /api/applications/:id/spatial-verification
       └─► PostGIS: checks geometry for overlaps
       └─► Postgres: creates SpatialVerification record
       └─► MQTT: publishes anagu/verification/spatial-complete

4. REGISTRAR performs ownership verification
   └─► POST /api/applications/:id/ownership-verification
       └─► Postgres: creates OwnershipVerification record
       └─► MQTT: publishes anagu/verification/ownership-complete

5. LAND_ADMINISTRATOR approves
   └─► PATCH /api/applications/:id/status → PENDING_APPROVAL

6. GOVERNOR gives final approval
   └─► PATCH /api/applications/:id/approve
       └─► Postgres: status → APPROVED

7. SYSTEM mints land title NFT
   └─► Besu: calls LandTitleNFT.mint(ownerAddress, tokenURI)
       └─► Tx confirmed on QBFT blockchain
       └─► Postgres: creates LandTitle record with txHash + tokenId
       └─► MQTT: publishes anagu/title/minted
       └─► Notification: sent to citizen
```

## Blockchain Architecture

- **Consensus**: QBFT (Quorum Byzantine Fault Tolerant) — 4 validators
- **Chain ID**: 1337
- **Block time**: 1 second
- **Gas price**: 0 (permissioned network, no gas fees)
- **Smart contracts**:
  - `LandRegistry.sol` — Parcel registration and ownership records
  - `LandTitleNFT.sol` — ERC-721 NFT representing a land title deed
- **Key generation**: `besu operator generate-blockchain-config`
- **RPC**: besu-node1 exposes :8545 (HTTP) and :8546 (WebSocket)

## Security Model

- **Authentication**: Self-hosted JWT (NestJS Passport), access + refresh tokens
- **Authorization**: Role-based access control (CITIZEN, SURVEYOR, REGISTRAR, LAND_ADMINISTRATOR, GOVERNOR)
- **Transport**: TLS via Nginx in production (terminate at proxy)
- **Secrets**: `.env` file (never committed); vault integration planned for Phase 5
- **File uploads**: Max 10 MB, allowed types: pdf, jpg, jpeg, png, doc, docx
- **Rate limiting**: NestJS Throttler on all API endpoints
- **Audit trail**: All state changes written to `audit_logs` table + blockchain events
- **MQTT**: Dev uses `allow_anonymous=true`; production requires auth plugin

## MQTT Topic Structure

| Topic | Publisher | Payload |
|-------|-----------|--------|
| `anagu/application/submitted` | API | `{ applicationId, applicantId, timestamp }` |
| `anagu/application/status-changed` | API | `{ applicationId, previousStatus, newStatus, timestamp }` |
| `anagu/document/uploaded` | API | `{ applicationId, documentId, fileName }` |
| `anagu/verification/spatial-complete` | API | `{ applicationId, isValid, overlapDetected }` |
| `anagu/verification/ownership-complete` | API | `{ applicationId, outcome }` |
| `anagu/title/minted` | API | `{ applicationId, tokenId, txHash, ownerAddress }` |
| `anagu/title/revoked` | API | `{ titleId, grounds, txHash }` |
| `anagu/notification` | API | `{ userId, type, title, body }` |
