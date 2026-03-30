import { OpCode } from "../core/opcodes";
import {
  MatchEndPayload,
  MatchPlayerState,
  MatchStartPayload,
  MatchStatus,
  MovePayload,
  PlayerInfo,
  StateSyncPayload,
  StateUpdatePayload,
  TicTacToeMatchState
} from "../core/types";
import { applyResultToStats, recordMatchHistory, upsertUserAndStats } from "../core/db";
import { checkWinner, createEmptyBoard, isBoardFull } from "../core/game";

const DEFAULT_TICK_RATE = 5;
const DEFAULT_MOVE_TIME_LIMIT_MS = 30_000;
const DEFAULT_RECONNECT_WINDOW_MS = 10_000;
const GRACE_TICKS = 1;

const playerInfos = (state: TicTacToeMatchState): PlayerInfo[] =>
  state.playerOrder.map((userId) => {
    const player = state.players[userId];
    return {
      userId: player.userId,
      username: player.username,
      role: player.role,
      connected: Boolean(player.presence)
    };
  });

const buildStateSync = (state: TicTacToeMatchState): StateSyncPayload => ({
  matchId: state.matchId ?? "",
  board: state.board,
  players: playerInfos(state),
  turnUserId: state.turnUserId,
  moveNumber: state.moveNumber,
  mode: state.mode,
  status: state.status,
  timeLimitMs: state.mode === "timed" ? state.timeLimitMs : undefined,
  turnDeadlineMs: state.mode === "timed" ? state.turnDeadlineMs : undefined,
  result: state.result,
  winnerUserId: state.winnerUserId,
  forfeitReason: state.forfeitReason
});

const broadcastSync = (
  dispatcher: nkruntime.MatchDispatcher,
  state: TicTacToeMatchState,
  presences?: nkruntime.Presence[]
): void => {
  dispatcher.broadcastMessage(OpCode.STATE_SYNC, JSON.stringify(buildStateSync(state)), presences ?? null, null, true);
};

const rotateTurn = (state: TicTacToeMatchState): void => {
  const currentIdx = state.playerOrder.findIndex((id) => id === state.turnUserId);
  const nextIdx = currentIdx === 0 ? 1 : 0;
  state.turnUserId = state.playerOrder[nextIdx];
  state.timeoutArmed = false;
  state.graceTicksRemaining = 0;
  state.turnDeadlineMs = Date.now() + state.timeLimitMs;
};

const isPlayerConnected = (state: TicTacToeMatchState, userId: string): boolean => {
  const player = state.players[userId];
  return Boolean(player?.presence);
};

const finalizeMatch = (
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  state: TicTacToeMatchState,
  result: "win" | "draw" | "forfeit",
  winnerUserId?: string,
  forfeitReason?: string
): TicTacToeMatchState => {
  state.status = "finished";
  state.result = result;
  state.winnerUserId = winnerUserId;
  state.forfeitReason = forfeitReason;

  const endPayload: MatchEndPayload = {
    board: state.board,
    status: "finished",
    result,
    winnerUserId,
    forfeitReason,
    moveNumber: state.moveNumber
  };
  dispatcher.broadcastMessage(OpCode.MATCH_END, JSON.stringify(endPayload), null, null, true);

  const playerX = state.playerOrder[0];
  const playerO = state.playerOrder[1];
  if (playerX && playerO) {
    upsertUserAndStats(nk, playerX, state.players[playerX].username);
    upsertUserAndStats(nk, playerO, state.players[playerO].username);
    recordMatchHistory(nk, {
      matchId: state.matchId ?? "",
      mode: state.mode,
      playerX,
      playerO,
      winnerId: winnerUserId ?? null,
      resultType: result,
      moveCount: state.moveNumber
    });
    applyResultToStats(nk, {
      winnerId: winnerUserId,
      loserId: winnerUserId ? (winnerUserId === playerX ? playerO : playerX) : undefined,
      playerX,
      playerO,
      isDraw: result === "draw"
    });
  }

  return state;
};

const matchInit: nkruntime.MatchInitFunction<TicTacToeMatchState> = (ctx, _logger, _nk, params) => {
  const mode = params.mode === "timed" ? "timed" : "classic";
  const state: TicTacToeMatchState = {
    matchId: ctx.matchId,
    mode,
    status: "waiting",
    board: createEmptyBoard(),
    players: {},
    playerOrder: [],
    turnUserId: "",
    moveNumber: 0,
    tickRate: DEFAULT_TICK_RATE,
    timeLimitMs: Number(params.timeLimitMs ?? DEFAULT_MOVE_TIME_LIMIT_MS),
    turnDeadlineMs: 0,
    timeoutArmed: false,
    graceTicksRemaining: 0,
    reconnectDeadlineByUser: {},
    reconnectWindowMs: Number(params.reconnectWindowMs ?? DEFAULT_RECONNECT_WINDOW_MS)
  };

  const label = JSON.stringify({
    mode: state.mode,
    isPrivate: Boolean(params.isPrivate),
    playerCount: 0,
    requiredPlayerCount: 2,
    status: state.status
  });

  return { state, tickRate: state.tickRate, label };
};

const matchJoinAttempt: nkruntime.MatchJoinAttemptFunction<TicTacToeMatchState> = (
  _ctx,
  _logger,
  _nk,
  _dispatcher,
  _tick,
  state,
  presence,
  _metadata
) => {
  const alreadyKnown = Boolean(state.players[presence.userId]);
  const activeCount = state.playerOrder.length;

  if (!alreadyKnown && activeCount >= 2) {
    return {
      state,
      accept: false,
      rejectMessage: "match is full"
    };
  }

  if (!alreadyKnown) {
    const role: "X" | "O" = state.playerOrder.length === 0 ? "X" : "O";
    state.players[presence.userId] = {
      presence: null,
      userId: presence.userId,
      username: presence.username || "guest",
      role
    };
    state.playerOrder.push(presence.userId);
  }

  return { state, accept: true };
};

const matchJoin: nkruntime.MatchJoinFunction<TicTacToeMatchState> = (_ctx, _logger, _nk, dispatcher, _tick, state, presences) => {
  for (const presence of presences) {
    const player: MatchPlayerState | undefined = state.players[presence.userId];
    if (!player) {
      continue;
    }
    player.presence = presence;
    delete state.reconnectDeadlineByUser[presence.userId];
  }

  if (state.playerOrder.length === 2 && state.status === "waiting") {
    state.status = "playing";
    state.turnUserId = state.playerOrder[0];
    state.turnDeadlineMs = Date.now() + state.timeLimitMs;

    const startPayload: MatchStartPayload = {
      matchId: state.matchId ?? "",
      board: state.board,
      players: playerInfos(state),
      turnUserId: state.turnUserId,
      moveNumber: state.moveNumber,
      mode: state.mode,
      status: state.status,
      timeLimitMs: state.mode === "timed" ? state.timeLimitMs : undefined,
      turnDeadlineMs: state.mode === "timed" ? state.turnDeadlineMs : undefined
    };
    dispatcher.broadcastMessage(OpCode.MATCH_START, JSON.stringify(startPayload), null, null, true);
  } else {
    broadcastSync(dispatcher, state, presences);
  }

  const label = JSON.stringify({
    mode: state.mode,
    isPrivate: false,
    playerCount: state.playerOrder.length,
    requiredPlayerCount: 2,
    status: state.status
  });
  dispatcher.matchLabelUpdate(label);

  return { state };
};

const matchLeave: nkruntime.MatchLeaveFunction<TicTacToeMatchState> = (_ctx, _logger, _nk, _dispatcher, _tick, state, presences) => {
  for (const presence of presences) {
    const player = state.players[presence.userId];
    if (player) {
      player.presence = null;
      state.reconnectDeadlineByUser[presence.userId] = Date.now() + state.reconnectWindowMs;
    }
  }

  return { state };
};

const validateMove = (state: TicTacToeMatchState, senderUserId: string, move: MovePayload): string | null => {
  if (state.status !== "playing") {
    return "match not active";
  }
  if (senderUserId !== state.turnUserId) {
    return "not your turn";
  }
  if (!Number.isInteger(move.cellIndex) || move.cellIndex < 0 || move.cellIndex > 8) {
    return "invalid cell index";
  }
  if (state.board[move.cellIndex] !== "empty") {
    return "cell already occupied";
  }
  return null;
};

const matchLoop: nkruntime.MatchLoopFunction<TicTacToeMatchState> = (ctx, logger, nk, dispatcher, _tick, state, messages) => {
  const now = Date.now();

  if (state.status === "playing") {
    for (const userId of state.playerOrder) {
      if (!isPlayerConnected(state, userId)) {
        const deadline = state.reconnectDeadlineByUser[userId];
        if (deadline && now > deadline) {
          const opponent = state.playerOrder.find((id) => id !== userId);
          if (opponent) {
            return { state: finalizeMatch(nk, dispatcher, state, "forfeit", opponent, "disconnect timeout") };
          }
        }
      }
    }
  }

  let movedThisTick = false;
  for (const message of messages) {
    if (message.opCode !== OpCode.PLAYER_MOVE || state.status !== "playing") {
      continue;
    }
    try {
      const payload = JSON.parse(nk.binaryToString(message.data)) as MovePayload;
      const invalidReason = validateMove(state, message.sender.userId, payload);
      if (invalidReason) {
        logger.debug("Rejected move from %s: %s", message.sender.userId, invalidReason);
        continue;
      }

      const player = state.players[message.sender.userId];
      state.board[payload.cellIndex] = player.role;
      state.moveNumber += 1;
      movedThisTick = true;

      const winnerRole = checkWinner(state.board);
      if (winnerRole) {
        const winner = state.playerOrder.find((id) => state.players[id].role === winnerRole);
        return { state: finalizeMatch(nk, dispatcher, state, "win", winner) };
      }
      if (isBoardFull(state.board)) {
        return { state: finalizeMatch(nk, dispatcher, state, "draw") };
      }

      rotateTurn(state);
      const updatePayload: StateUpdatePayload = {
        board: state.board,
        turnUserId: state.turnUserId,
        moveNumber: state.moveNumber,
        status: state.status,
        timeLimitMs: state.mode === "timed" ? state.timeLimitMs : undefined,
        turnDeadlineMs: state.mode === "timed" ? state.turnDeadlineMs : undefined
      };
      dispatcher.broadcastMessage(OpCode.STATE_UPDATE, JSON.stringify(updatePayload), null, null, true);
    } catch (error) {
      logger.error("Invalid move payload: %v", error);
    }
  }

  if (state.mode === "timed" && state.status === "playing" && !movedThisTick) {
    if (now > state.turnDeadlineMs && !state.timeoutArmed) {
      state.timeoutArmed = true;
      state.graceTicksRemaining = GRACE_TICKS;
    } else if (state.timeoutArmed) {
      if (state.graceTicksRemaining > 0) {
        state.graceTicksRemaining -= 1;
      } else {
        const winner = state.playerOrder.find((id) => id !== state.turnUserId);
        if (winner) {
          return { state: finalizeMatch(nk, dispatcher, state, "forfeit", winner, "turn timeout") };
        }
      }
    }
  }

  if (state.status === "finished") {
    return null;
  }

  if (ctx.executionMode === 1) {
    // no-op; keeps lint tools quiet about ctx usage in some TS configs.
  }
  return { state };
};

const matchTerminate: nkruntime.MatchTerminateFunction<TicTacToeMatchState> = (
  _ctx,
  _logger,
  _nk,
  dispatcher,
  _tick,
  state,
  _graceSeconds
) => {
  if (state.status !== "finished") {
    state.status = "finished";
    const payload: MatchEndPayload = {
      board: state.board,
      status: "finished",
      result: "forfeit",
      forfeitReason: "match terminated",
      moveNumber: state.moveNumber
    };
    dispatcher.broadcastMessage(OpCode.MATCH_END, JSON.stringify(payload), null, null, true);
  }
  return { state };
};

const matchSignal: nkruntime.MatchSignalFunction<TicTacToeMatchState> = (_ctx, _logger, _nk, _dispatcher, _tick, state, data) => {
  return { state, data: data || "ok" };
};

export const ticTacToeMatch: nkruntime.MatchHandler<TicTacToeMatchState> = {
  matchInit,
  matchJoinAttempt,
  matchJoin,
  matchLeave,
  matchLoop,
  matchTerminate,
  matchSignal
};
