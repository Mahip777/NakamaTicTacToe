type Cell = "empty" | "X" | "O";
type MatchMode = "classic" | "timed";
type MatchStatus = "waiting" | "playing" | "finished";

type PlayerState = {
  presence: nkruntime.Presence | null;
  userId: string;
  username: string;
  role: "X" | "O";
};

type MatchState = nkruntime.MatchState & {
  mode: MatchMode;
  status: MatchStatus;
  board: Cell[];
  players: Record<string, PlayerState>;
  playerOrder: string[];
  turnUserId: string;
  moveNumber: number;
  timeLimitMs: number;
  turnDeadlineMs: number;
  timeoutArmed: boolean;
  graceTicksRemaining: number;
  reconnectWindowMs: number;
  reconnectDeadlineByUser: Record<string, number>;
  winnerUserId?: string;
  result?: "win" | "draw" | "forfeit";
  forfeitReason?: string;
};

const OP = {
  MATCH_START: 1,
  STATE_UPDATE: 2,
  STATE_SYNC: 3,
  PLAYER_MOVE: 4,
  MATCH_END: 5
};

const TICK_RATE = 5;
const TIME_LIMIT_MS = 30000;
const RECONNECT_WINDOW_MS = 10000;
const GRACE_TICKS = 1;

/** Short room codes (1000–9999); stored in Postgres (`room_join_codes`) so joins work across Nakama/JS restarts. */
const JOIN_CODE_MIN = 1000;
const JOIN_CODE_MAX = 9999;

function allocateJoinCode(nk: nkruntime.Nakama, matchId: string): string {
  const span = JOIN_CODE_MAX - JOIN_CODE_MIN + 1;
  for (let i = 0; i < 256; i++) {
    const n = JOIN_CODE_MIN + Math.floor(Math.random() * span);
    const code = String(n);
    try {
      nk.sqlExec("INSERT INTO room_join_codes (code, match_id) VALUES ($1, $2)", [code, matchId]);
      return code;
    } catch {
      // duplicate code or missing table — retry with another code
    }
  }
  throw new Error("no room codes available");
}

function releaseJoinCodeForMatch(nk: nkruntime.Nakama, matchId: string): void {
  nk.sqlExec("DELETE FROM room_join_codes WHERE match_id = $1", [matchId]);
}

function lookupMatchIdByJoinCode(nk: nkruntime.Nakama, code: string): string | null {
  const rows = nk.sqlQuery("SELECT match_id FROM room_join_codes WHERE code = $1", [code]);
  const row = rows[0] as { match_id?: string } | undefined;
  return row?.match_id ? String(row.match_id) : null;
}

function lookupJoinCodeByMatchId(nk: nkruntime.Nakama, matchId: string): string | null {
  const rows = nk.sqlQuery("SELECT code FROM room_join_codes WHERE match_id = $1 LIMIT 1", [matchId]);
  const row = rows[0] as { code?: string } | undefined;
  return row?.code ? String(row.code) : null;
}

function emptyBoard(): Cell[] {
  return ["empty", "empty", "empty", "empty", "empty", "empty", "empty", "empty", "empty"];
}

function winner(board: Cell[]): "X" | "O" | null {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];
  for (const line of lines) {
    const [a, b, c] = line;
    if (board[a] !== "empty" && board[a] === board[b] && board[b] === board[c]) {
      return board[a] as "X" | "O";
    }
  }
  return null;
}

function full(board: Cell[]): boolean {
  return board.every((c) => c !== "empty");
}

function payloadState(state: MatchState, matchId: string) {
  const players = state.playerOrder.map((id) => {
    const p = state.players[id];
    return { userId: p.userId, username: p.username, role: p.role, connected: Boolean(p.presence) };
  });
  return {
    matchId,
    board: state.board,
    players,
    turnUserId: state.turnUserId,
    moveNumber: state.moveNumber,
    mode: state.mode,
    status: state.status,
    timeLimitMs: state.mode === "timed" ? state.timeLimitMs : undefined,
    turnDeadlineMs: state.mode === "timed" ? state.turnDeadlineMs : undefined,
    result: state.result,
    winnerUserId: state.winnerUserId,
    forfeitReason: state.forfeitReason
  };
}

function finalize(nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, state: MatchState, matchId: string, result: "win" | "draw" | "forfeit", winnerUserId?: string, forfeitReason?: string): MatchState {
  state.status = "finished";
  state.result = result;
  state.winnerUserId = winnerUserId;
  state.forfeitReason = forfeitReason;

  dispatcher.broadcastMessage(OP.MATCH_END, JSON.stringify({
    board: state.board,
    status: "finished",
    result,
    winnerUserId,
    forfeitReason,
    moveNumber: state.moveNumber
  }), null, null, true);

  if (state.playerOrder.length === 2) {
    const px = state.playerOrder[0];
    const po = state.playerOrder[1];
    const ux = state.players[px];
    const uo = state.players[po];

    nk.sqlExec("INSERT INTO app_users (id, username) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username", [px, ux.username]);
    nk.sqlExec("INSERT INTO app_users (id, username) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username", [po, uo.username]);
    nk.sqlExec("INSERT INTO player_stats (user_id, wins, losses, draws, elo) VALUES ($1,0,0,0,1000) ON CONFLICT (user_id) DO NOTHING", [px]);
    nk.sqlExec("INSERT INTO player_stats (user_id, wins, losses, draws, elo) VALUES ($1,0,0,0,1000) ON CONFLICT (user_id) DO NOTHING", [po]);
    nk.sqlExec(
      "INSERT INTO match_history (match_id, mode, player_x, player_o, winner_id, result_type, move_count) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [matchId, state.mode, px, po, winnerUserId || null, result, state.moveNumber]
    );

    if (result === "draw") {
      nk.sqlExec("UPDATE player_stats SET draws = draws + 1, updated_at = now() WHERE user_id IN ($1,$2)", [px, po]);
    } else if (winnerUserId) {
      const loserId = winnerUserId === px ? po : px;
      nk.sqlExec("UPDATE player_stats SET wins = wins + 1, elo = elo + 10, updated_at = now() WHERE user_id = $1", [winnerUserId]);
      nk.sqlExec("UPDATE player_stats SET losses = losses + 1, elo = GREATEST(100, elo - 10), updated_at = now() WHERE user_id = $1", [loserId]);
    }
  }

  releaseJoinCodeForMatch(nk, matchId);
  return state;
}

function matchInit(ctx: nkruntime.Context, _l: nkruntime.Logger, _nk: nkruntime.Nakama, params: Record<string, unknown>) {
  const mode: MatchMode = params.mode === "timed" ? "timed" : "classic";
  const state: MatchState = {
    mode,
    status: "waiting",
    board: emptyBoard(),
    players: {},
    playerOrder: [],
    turnUserId: "",
    moveNumber: 0,
    timeLimitMs: Number(params.timeLimitMs ?? TIME_LIMIT_MS),
    turnDeadlineMs: 0,
    timeoutArmed: false,
    graceTicksRemaining: 0,
    reconnectWindowMs: Number(params.reconnectWindowMs ?? RECONNECT_WINDOW_MS),
    reconnectDeadlineByUser: {}
  };
  const label = JSON.stringify({
    isPrivate: params.isPrivate === true,
    mode,
    playerCount: 0,
    requiredPlayerCount: 2,
    status: "waiting"
  });
  if (ctx.executionMode === 1) {}
  return { state, tickRate: TICK_RATE, label };
}

function matchJoinAttempt(_ctx: nkruntime.Context, _l: nkruntime.Logger, _nk: nkruntime.Nakama, _d: nkruntime.MatchDispatcher, _t: number, state: MatchState, presence: nkruntime.Presence, _metadata: Record<string, unknown>) {
  if (!state.players[presence.userId] && state.playerOrder.length >= 2) {
    return { state, accept: false, rejectMessage: "match is full" };
  }
  if (!state.players[presence.userId]) {
    const role: "X" | "O" = state.playerOrder.length === 0 ? "X" : "O";
    state.players[presence.userId] = { presence: null, userId: presence.userId, username: presence.username || "guest", role };
    state.playerOrder.push(presence.userId);
  }
  return { state, accept: true };
}

function matchJoin(ctx: nkruntime.Context, _l: nkruntime.Logger, _nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, _t: number, state: MatchState, presences: nkruntime.Presence[]) {
  for (const p of presences) {
    state.players[p.userId].presence = p;
    delete state.reconnectDeadlineByUser[p.userId];
  }
  if (state.playerOrder.length === 2 && state.status === "waiting") {
    state.status = "playing";
    state.turnUserId = state.playerOrder[0];
    state.turnDeadlineMs = Date.now() + state.timeLimitMs;
    dispatcher.broadcastMessage(OP.MATCH_START, JSON.stringify(payloadState(state, ctx.matchId || "")), null, null, true);
  } else {
    dispatcher.broadcastMessage(OP.STATE_SYNC, JSON.stringify(payloadState(state, ctx.matchId || "")), presences, null, true);
  }
  dispatcher.matchLabelUpdate(JSON.stringify({ isPrivate: false, mode: state.mode, playerCount: state.playerOrder.length, requiredPlayerCount: 2, status: state.status }));
  return { state };
}

function matchLeave(_ctx: nkruntime.Context, _l: nkruntime.Logger, _nk: nkruntime.Nakama, _d: nkruntime.MatchDispatcher, _t: number, state: MatchState, presences: nkruntime.Presence[]) {
  for (const p of presences) {
    if (state.players[p.userId]) {
      state.players[p.userId].presence = null;
      state.reconnectDeadlineByUser[p.userId] = Date.now() + state.reconnectWindowMs;
    }
  }
  return { state };
}

function matchLoop(ctx: nkruntime.Context, logger2: nkruntime.Logger, nk2: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, _t: number, state: MatchState, messages: nkruntime.MatchData[]) {
  const now = Date.now();
  for (const id of state.playerOrder) {
    if (!state.players[id].presence && state.reconnectDeadlineByUser[id] && now > state.reconnectDeadlineByUser[id]) {
      const opp = state.playerOrder.find((u) => u !== id);
      if (opp) return { state: finalize(nk2, dispatcher, state, ctx.matchId || "", "forfeit", opp, "disconnect timeout") };
    }
  }
  let moved = false;
  for (const m of messages) {
    if (m.opCode !== OP.PLAYER_MOVE || state.status !== "playing") continue;
    const move = JSON.parse(nk2.binaryToString(m.data)) as { cellIndex: number };
    if (m.sender.userId !== state.turnUserId) continue;
    if (!Number.isInteger(move.cellIndex) || move.cellIndex < 0 || move.cellIndex > 8) continue;
    if (state.board[move.cellIndex] !== "empty") continue;
    const mark = state.players[m.sender.userId].role;
    state.board[move.cellIndex] = mark;
    state.moveNumber += 1;
    moved = true;
    const w = winner(state.board);
    if (w) {
      const winnerId = state.playerOrder.find((id) => state.players[id].role === w);
      return { state: finalize(nk2, dispatcher, state, ctx.matchId || "", "win", winnerId) };
    }
    if (full(state.board)) return { state: finalize(nk2, dispatcher, state, ctx.matchId || "", "draw") };
    state.turnUserId = state.playerOrder.find((id) => id !== state.turnUserId) || state.turnUserId;
    state.timeoutArmed = false;
    state.graceTicksRemaining = 0;
    state.turnDeadlineMs = Date.now() + state.timeLimitMs;
    dispatcher.broadcastMessage(OP.STATE_UPDATE, JSON.stringify(payloadState(state, ctx.matchId || "")), null, null, true);
  }
  if (state.mode === "timed" && state.status === "playing" && !moved) {
    if (now > state.turnDeadlineMs && !state.timeoutArmed) {
      state.timeoutArmed = true;
      state.graceTicksRemaining = GRACE_TICKS;
    } else if (state.timeoutArmed) {
      if (state.graceTicksRemaining > 0) state.graceTicksRemaining -= 1;
      else {
        const winId = state.playerOrder.find((id) => id !== state.turnUserId);
        if (winId) return { state: finalize(nk2, dispatcher, state, ctx.matchId || "", "forfeit", winId, "turn timeout") };
      }
    }
  }
  if (state.status === "finished") return null;
  if (logger2 && ctx.executionMode === 1) {}
  return { state };
}

function matchTerminate(ctx: nkruntime.Context, _l: nkruntime.Logger, nk3: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, _t: number, state: MatchState, _graceSeconds: number) {
  if (state.status !== "finished") finalize(nk3, dispatcher, state, ctx.matchId || "", "forfeit", undefined, "terminated");
  return { state };
}

function matchSignal(_ctx: nkruntime.Context, _l: nkruntime.Logger, _nk: nkruntime.Nakama, _d: nkruntime.MatchDispatcher, _t: number, state: MatchState, data: string) {
  return { state, data: data || "ok" };
}

// Top-level `var` is required: goja puts only `var` in Program.DeclarationList (Nakama looks up the handler object there).
// Use identifier keys (`matchInit: matchInit`) so PropertyKeyed keys match Nakama's AST walk (quoted keys can fail key.Literal).
var tictactoeMatchHandler: nkruntime.MatchHandler<MatchState> = {
  matchInit: matchInit,
  matchJoinAttempt: matchJoinAttempt,
  matchJoin: matchJoin,
  matchLeave: matchLeave,
  matchLoop: matchLoop,
  matchTerminate: matchTerminate,
  matchSignal: matchSignal
};

// Nakama extracts RPC / RT hook callbacks by global function name — they cannot be nested inside InitModule.
function hookBeforeMatchmakerAdd(_ctx: nkruntime.Context, _l: nkruntime.Logger, _nk: nkruntime.Nakama, envelope: nkruntime.EnvelopeMatchmakerAdd): nkruntime.EnvelopeMatchmakerAdd {
  envelope.matchmakerAdd.stringProperties = envelope.matchmakerAdd.stringProperties || {};
  if (!envelope.matchmakerAdd.stringProperties.mode) envelope.matchmakerAdd.stringProperties.mode = "classic";
  return envelope;
}

function hookMatchmakerMatched(_ctx: nkruntime.Context, _l: nkruntime.Logger, nk: nkruntime.Nakama, matchedUsers: nkruntime.MatchmakerUser[]): string {
  const mode = matchedUsers[0]?.properties?.mode === "timed" ? "timed" : "classic";
  return nk.matchCreate("tictactoe", { isPrivate: false, mode });
}

function rpcCreatePrivate(ctx: nkruntime.Context, _l: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  const body = payload ? JSON.parse(payload) : {};
  const mode = body.mode === "timed" ? "timed" : "classic";
  const matchId = nk.matchCreate("tictactoe", { isPrivate: true, mode, timeLimitMs: body.timeLimitMs ?? TIME_LIMIT_MS });
  const joinCode = allocateJoinCode(nk, matchId);
  return JSON.stringify({ matchId, joinCode, createdBy: ctx.userId });
}

function rpcCreatePublic(ctx: nkruntime.Context, _l: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  const body = payload ? JSON.parse(payload) : {};
  const mode = body.mode === "timed" ? "timed" : "classic";
  const matchId = nk.matchCreate("tictactoe", { isPrivate: false, mode, timeLimitMs: body.timeLimitMs ?? TIME_LIMIT_MS });
  const joinCode = allocateJoinCode(nk, matchId);
  return JSON.stringify({ matchId, joinCode, createdBy: ctx.userId });
}

function rpcResolveJoinCode(_ctx: nkruntime.Context, _l: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  const body = payload ? JSON.parse(payload) : {};
  const raw = String(body.code ?? "").trim().replace(/\s/g, "");
  if (!/^\d{4}$/.test(raw)) {
    return JSON.stringify({ ok: false, error: "Enter a 4-digit room code (1000–9999)." });
  }
  const n = Number(raw);
  if (n < JOIN_CODE_MIN || n > JOIN_CODE_MAX) {
    return JSON.stringify({ ok: false, error: "Invalid room code." });
  }
  const matchId = lookupMatchIdByJoinCode(nk, raw);
  if (!matchId) {
    return JSON.stringify({ ok: false, error: "No room found for that code." });
  }
  return JSON.stringify({ ok: true, matchId });
}

function rpcJoinById(_ctx: nkruntime.Context, _l: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  const body = payload ? JSON.parse(payload) : {};
  const list = nk.matchList(10, true, null, null, 0, 2, "");
  return JSON.stringify({ matchId: body.matchId, exists: list.some((m) => m.matchId === body.matchId) });
}

function rpcListPublic(_ctx: nkruntime.Context, _l: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  const body = payload ? JSON.parse(payload) : {};
  const limit = Math.max(1, Math.min(body.limit ?? 20, 100));
  const list = nk.matchList(limit, true, null, null, 0, 2, "+label.isPrivate:false +label.status:waiting");
  return JSON.stringify({
    matches: list.map((m) => ({
      matchId: m.matchId,
      joinCode: lookupJoinCodeByMatchId(nk, m.matchId),
      size: m.size,
      label: m.label
    }))
  });
}

function rpcFetchLeaderboard(_ctx: nkruntime.Context, _l: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  const body = payload ? JSON.parse(payload) : {};
  const limit = Math.max(1, Math.min(body.limit ?? 20, 100));
  const rows = nk.sqlQuery(
    "SELECT u.id AS user_id, u.username, s.wins, s.losses, s.draws, s.elo FROM player_stats s JOIN app_users u ON u.id = s.user_id ORDER BY s.wins DESC, s.elo DESC, u.created_at ASC LIMIT $1",
    [limit]
  );
  return JSON.stringify({ leaderboard: rows });
}

function rpcFetchPlayerStats(ctx: nkruntime.Context, _l: nkruntime.Logger, nk: nkruntime.Nakama, _payload: string): string {
  const rows = nk.sqlQuery(
    "SELECT u.id AS user_id, u.username, s.wins, s.losses, s.draws, s.elo, s.updated_at FROM player_stats s JOIN app_users u ON u.id = s.user_id WHERE s.user_id = $1",
    [ctx.userId]
  );
  return JSON.stringify({ stats: rows[0] || null });
}

function InitModule(_ctx: nkruntime.Context, logger: nkruntime.Logger, _nk: nkruntime.Nakama, initializer: nkruntime.Initializer): void {
  initializer.registerMatch("tictactoe", tictactoeMatchHandler);
  initializer.registerRtBefore("MatchmakerAdd", hookBeforeMatchmakerAdd);
  initializer.registerMatchmakerMatched(hookMatchmakerMatched);
  initializer.registerRpc("create_private_match", rpcCreatePrivate);
  initializer.registerRpc("create_public_match", rpcCreatePublic);
  initializer.registerRpc("join_match_by_id", rpcJoinById);
  initializer.registerRpc("resolve_join_code", rpcResolveJoinCode);
  initializer.registerRpc("list_public_matches", rpcListPublic);
  initializer.registerRpc("fetch_leaderboard", rpcFetchLeaderboard);
  initializer.registerRpc("fetch_player_stats", rpcFetchPlayerStats);
  logger.info("TicTacToe Nakama module loaded.");
}
