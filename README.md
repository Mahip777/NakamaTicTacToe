# LILA Multiplayer Tic-Tac-Toe

Production-ready full-stack multiplayer Tic-Tac-Toe using a server-authoritative architecture.

## Tech Stack

- Mobile client: React Native + TypeScript (`client/`)
- Realtime backend: Nakama authoritative multiplayer runtime (`server/`)
- Nakama runtime language: TypeScript
- Database: PostgreSQL
- Transport: Nakama realtime socket with opcode-based events

## Core Features

- Server-authoritative gameplay (client sends intent only)
- Automatic 2-player matchmaking
- Public/private room lifecycle (create, discover, join)
- Timed mode (server-enforced):
  - `tickRate = 5`
  - per-turn deadline
  - one grace tick before forfeit
- Reconnect + authoritative resync via `STATE_SYNC`
- Persistent leaderboard + player stats + match history in PostgreSQL

## Repository Structure

- `client/` React Native app
- `server/` Nakama runtime TypeScript module
- `infra/` Docker + PostgreSQL initialization scripts
- `docs/` architecture and flow documentation

## Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop

## Local Setup

### 1) Build Nakama runtime

```bash
cd server
npm install
npm run build
```

This produces runtime JS in `server/build`, mounted into Nakama.

### 2) Start PostgreSQL + Nakama

```bash
cd infra
docker compose up -d
```

Nakama endpoints:
- HTTP API: `http://localhost:7350`
- WebSocket: `ws://localhost:7350/ws`
- Console: `http://localhost:7351`

### 3) Start mobile app

```bash
cd client
npm install
npm start
```

Then run on Android/iOS emulator from Expo.

## Runtime Protocol (Opcodes)

- `1` `MATCH_START`
- `2` `STATE_UPDATE`
- `3` `STATE_SYNC`
- `4` `PLAYER_MOVE`
- `5` `MATCH_END`

All payloads are strongly typed in:
- `server/src/core/types.ts`
- `client/src/types/protocol.ts`

## RPC Endpoints

- `create_private_match`
- `join_match_by_id`
- `fetch_leaderboard`
- `fetch_player_stats`

Server registrations are in `server/src/index.ts`.

## PostgreSQL Schema + Migration

SQL migration script:
- `infra/postgres/init/001_app_schema.sql`

Tables:
- `app_users`
- `player_stats`
- `match_history`

## Timed Mode and Grace Tick

- Tick rate is set to 5 ticks/sec (~200ms per loop).
- If turn deadline is exceeded, timeout is armed.
- Server allows exactly one grace tick.
- If no valid move arrives within that grace tick, match ends as forfeit.

## Reconnect and Resync

On reconnect:
1. Client reconnects socket.
2. Client rejoins known `matchId`.
3. Server returns `STATE_SYNC` with full authoritative snapshot.
4. Client replaces local match state and resumes normal updates.

## Assignment Docs

- Data flow: `docs/DATA_FLOW.md`
- Module boundaries: `docs/MODULE_STRUCTURE.md`
