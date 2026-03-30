## Module Structure

This document defines the modular boundaries for both frontend and backend.

## Frontend (`client/`)

### `src/screens`
- `LoginScreen.tsx`: guest auth and socket connection bootstrap
- `HomeScreen.tsx`: mode selection, matchmaking, create/join room
- `MatchmakingScreen.tsx`: queue state while waiting for pair
- `GameScreen.tsx`: board render + turn/timer + move intents
- `ResultScreen.tsx`: end result rendering
- `LeaderboardScreen.tsx`: leaderboard fetch and display

### `src/components`
- `Board.tsx`: stateless grid component
- `Countdown.tsx`: render-only countdown from server deadline

### `src/services`
- `nakama.ts`: Nakama client/socket integration
  - authentication
  - socket connect/reconnect
  - matchmaking
  - room create/join
  - move send (`PLAYER_MOVE`)
  - event handling (`MATCH_START`, `STATE_UPDATE`, `STATE_SYNC`, `MATCH_END`)

### `src/store`
- `useGameStore.ts`: centralized game/session state (Zustand)
- The store acts as the single state sink for socket events.

### `src/types`
- `protocol.ts`: shared event payload contracts and opcodes for client side

### Frontend design rule
- No business logic decides outcomes on the client.
- Client only:
  - emits move intent
  - renders authoritative state from server events

## Backend (`server/`)

### `src/match`
- `tictactoe.ts`: authoritative match lifecycle implementation
  - `matchInit`
  - `matchJoinAttempt`
  - `matchJoin`
  - `matchLeave`
  - `matchLoop`
  - `matchTerminate`
  - `matchSignal`

### `src/core`
- `opcodes.ts`: protocol opcode constants
- `types.ts`: authoritative state + payload contracts
- `game.ts`: rule helpers (board init, winner detection, draw detection)
- `db.ts`: PostgreSQL persistence helpers (stats, history, leaderboard)

### `src/hooks`
- `matchmaker.ts`:
  - `beforeMatchmakerAdd` to enforce/normalize mode properties
  - `onMatchmakerMatched` to create authoritative match instance

### `src/rpc`
- `index.ts`:
  - `create_private_match`
  - `join_match_by_id`
  - `fetch_leaderboard`
  - `fetch_player_stats`

### `src/index.ts`
- Central registration module for matches, hooks, and RPC functions.

## Infrastructure (`infra/`)

### `docker-compose.yml`
- PostgreSQL service
- Nakama service
- Nakama runtime mount from `server/build`

### `postgres/init/001_app_schema.sql`
- Initializes:
  - `app_users`
  - `player_stats`
  - `match_history`

## Data Ownership

- Match state (board, turns, timers, status) lives in Nakama authoritative memory.
- Persistent outcomes live in PostgreSQL.
- Client keeps a display copy only, refreshed by `STATE_SYNC` and updates.
