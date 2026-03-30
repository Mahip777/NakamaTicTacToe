## Multiplayer Tic-Tac-Toe Data Flow (React Native <-> Nakama)

This document defines the data flow for a server-authoritative multiplayer Tic-Tac-Toe game.

### Core principle (server authoritative)
- The client is responsible only for sending *inputs* (e.g., “place mark at cell X”).
- The Nakama match runtime is responsible for:
  - validating every input server-side
  - maintaining the authoritative board state
  - deciding turn order, win/draw, and timeouts
  - broadcasting the resulting state back to clients

---

## Entities

### Client (React Native app)
- Maintains UI state (screens) and local rendering of server broadcasts.
- Holds the current match context:
  - `matchId`
  - `playerRole` (`X` or `O`)
  - last received authoritative game state (board, turn, timer)

### Nakama components
- **Matchmaking (matchmaker tickets)**: automatically pairs players.
- **Room / Match runtime (authoritative match handler)**: `TicTacToeRoom`
  - runs the gameplay lifecycle and tick loop
- **Persistence layer** (PostgreSQL via Nakama):
  - stores leaderboard/stats

---

## Message Contracts (conceptual)

### Client -> Nakama (socket match data messages)
Use an opcode-based protocol for small payloads.

1. `READY` (optional)
   - payload: `{}` or `{ clientSideReadySeq }`
2. `MOVE`
   - payload: `{ cellIndex: 0..8, moveSeq?: number }`
   - meaning: attempt to place the current player's mark at the given cell
3. `PING/PONG` (optional)
   - payload: `{}` (or latency info)

### Nakama -> Client (socket match state / broadcasts)
Nakama authoritative broadcasts use opcodes + JSON payloads.

1. `MATCH_START`
   - payload:
     - `matchId`
     - `players: { [userId]: { role: "X"|"O" } }`
     - `board: string[9]` (values: `"empty"|"X"|"O"`)
     - `turnUserId`
     - `mode: "classic"|"timed"`
     - optional timed fields:
       - `timeLimitMs`
       - `turnDeadlineMs` (server-derived timestamp)
2. `STATE_UPDATE`
   - payload:
     - updated `board`
     - `turnUserId`
     - optional timed fields:
       - `turnDeadlineMs`
3. `MATCH_END`
   - payload:
     - `result: "win"|"draw"|"forfeit"`
     - `winnerUserId` (if result is win/forfeit)
     - `forfeitReason` (if forfeit)
     - final `board`
4. `STATE_SYNC` (snapshot for join/reconnect/resync)
   - payload:
     - `matchId`
     - `players`
     - full `board`
     - `turnUserId`
     - `mode`
     - timed fields (if mode is timed): `timeLimitMs`, `turnDeadlineMs`
     - match status: `waiting | in_progress | ended`
     - final result fields if match already ended

---

## High-level Flow (step-by-step)

### A) Authentication (setup before gameplay)
1. Client authenticates with Nakama (HTTP or socket-auth flow depending on your chosen approach).
2. Client opens a socket connection.

### B) Game pairing / room discovery
There are two entry paths that converge into the same authoritative match runtime:

#### Path 1: Automatic matchmaking
1. Client submits a matchmaker ticket with properties:
   - `mode: "classic" | "timed"`
   - (optional) other properties: region, skill band, etc.
2. Nakama matchmaker pairs compatible players.
3. For the matched pair, the backend creates or assigns an authoritative `TicTacToeRoom` match instance.
4. Nakama returns the assigned `matchId` to both clients.
5. Clients join the match by `matchId`.

#### Path 2: Room discovery / manual joining
1. Client creates a new match (“game room”) as a `TicTacToeRoom` with params:
   - `isPrivate` (or public/private flag)
   - `mode`
2. Nakama surfaces discoverable matches using match labels.
3. Another client lists matches by label criteria and obtains a `matchId`.
4. Client joins the selected `matchId`.

### C) Authoritative match runtime (TicTacToeRoom)

#### 1. `MATCH_INIT`
- Server creates initial state:
  - empty board
  - player assignments (`X`/`O`)
  - `turnUserId`
  - if timed mode:
    - `timeLimitMs`
    - set `turnDeadlineMs = serverNow + timeLimitMs`

#### 2. `MATCH_JOIN_ATTEMPT` / `MATCH_JOIN`
- Server validates join rules:
  - capacity (2 players)
  - compatibility (e.g., correct mode)
- Server registers each player's presence and prepares to start gameplay.

#### 3. Start broadcast
- When the room is ready to play, server broadcasts:
  - `MATCH_START` with board, roles, turn, and timed fields (if applicable)
  - If a player joins after start/reconnects, server sends `STATE_SYNC` so the client gets the latest authoritative snapshot before rendering gameplay UI.

#### 4. Gameplay ticks: `MATCH_LOOP` (server authoritative)
For each tick (configured at `tickRate = 5` ticks/sec):
1. Server reads the queued inputs from clients since last tick.
2. For each `MOVE` message:
   - validates:
     - sender is a current participant
     - it is sender’s turn
     - `cellIndex` is in `[0..8]`
     - target cell is empty
     - if timed mode: deadline/grace rules allow the move
   - applies move if valid
   - updates board and checks for win/draw
   - sets next `turnUserId` and resets `turnDeadlineMs` (timed mode)
   - broadcasts `STATE_UPDATE` to clients
3. Timeout enforcement (timed mode only, with 1 grace tick):
   - Grace policy (B):
     - If `serverNow > turnDeadlineMs`, the server arms a timeout.
     - It does not forfeit until the next tick after the deadline.
     - If a valid move is applied within that grace tick, the timeout is canceled by turn advancement.
     - If no valid move is applied during the grace tick, server broadcasts `MATCH_END` as `forfeit` and terminates the match.

#### 5. Disconnects / `MATCH_LEAVE`
- If a participant disconnects:
  - server keeps match state authoritative and waits for reconnect within a short reconnect window.
  - if user reconnects and rejoins in time, server emits `STATE_SYNC` and gameplay continues.
  - if reconnect window expires, server ends match as `forfeit`, broadcasts `MATCH_END`, then terminates and persists leaderboard updates.

#### 5a. Reconnect and resync flow (explicit)
1. Client reconnects socket and attempts to rejoin known `matchId`.
2. On successful rejoin, server sends `STATE_SYNC` snapshot immediately.
3. Client replaces local match state with `STATE_SYNC` data (no merge with stale local board).
4. Client resumes receiving normal `STATE_UPDATE` events.
5. If rejoin fails (match already ended), client requests result and transitions to result/lobby screen.

#### 6. `MATCH_TERMINATE` + persistence
- Server finalizes match outcome:
  - updates leaderboard/stats for involved users (wins/losses/draws, streaks)
- Persistence writes are performed here so the database is updated only from authoritative results.

---

## Data Flow Summary (who sends what)
1. Client authenticates and connects socket to Nakama.
2. Client requests pairing (matchmaker ticket) or creates/list/join rooms (match listing).
3. Clients join the authoritative `TicTacToeRoom` match.
4. Clients send only `MOVE` inputs to the server.
5. Server validates and broadcasts authoritative `MATCH_START`, `STATE_UPDATE`, and `MATCH_END`.
6. On join/rejoin or missed state risk, server sends `STATE_SYNC` snapshot.
7. Server persists leaderboard updates at termination.

---

## Tick Rate Note (for timed mode documentation)
- `tickRate = 5` means each server `match_loop` executes about every ~200ms.
- With grace policy B, the forfeit occurs approximately one tick (~200ms) after the deadline unless the player submits a valid move during that grace tick.

