import { fetchLeaderboard, fetchPlayerStats } from "../core/db";

interface CreatePrivateMatchRequest {
  mode?: "classic" | "timed";
  timeLimitMs?: number;
}

interface JoinMatchByIdRequest {
  matchId: string;
}

interface LeaderboardRequest {
  limit?: number;
}

export const rpcCreatePrivateMatch: nkruntime.RpcFunction = (ctx, logger, nk, payload) => {
  const body: CreatePrivateMatchRequest = payload ? JSON.parse(payload) : {};
  const mode = body.mode === "timed" ? "timed" : "classic";
  const matchId = nk.matchCreate("tictactoe", {
    isPrivate: true,
    mode,
    timeLimitMs: body.timeLimitMs ?? 30000
  });
  logger.info("private match created by %s: %s", ctx.userId, matchId);
  return JSON.stringify({ matchId });
};

export const rpcCreatePublicMatch: nkruntime.RpcFunction = (ctx, logger, nk, payload) => {
  const body: CreatePrivateMatchRequest = payload ? JSON.parse(payload) : {};
  const mode = body.mode === "timed" ? "timed" : "classic";
  const matchId = nk.matchCreate("tictactoe", {
    isPrivate: false,
    mode,
    timeLimitMs: body.timeLimitMs ?? 30000
  });
  logger.info("public match created by %s: %s", ctx.userId, matchId);
  return JSON.stringify({ matchId });
};

export const rpcJoinMatchById: nkruntime.RpcFunction = (_ctx, _logger, nk, payload) => {
  if (!payload) {
    throw new Error("payload is required");
  }
  const body = JSON.parse(payload) as JoinMatchByIdRequest;
  if (!body.matchId) {
    throw new Error("matchId is required");
  }

  const matches = nk.matchList(10, true, body.matchId, null, 1, 2, "");
  const exists = matches.some((m) => m.matchId === body.matchId);
  return JSON.stringify({ matchId: body.matchId, exists });
};

export const rpcFetchLeaderboard: nkruntime.RpcFunction = (_ctx, _logger, nk, payload) => {
  const body: LeaderboardRequest = payload ? JSON.parse(payload) : {};
  const limit = Math.max(1, Math.min(body.limit ?? 20, 100));
  const leaderboard = fetchLeaderboard(nk, limit);
  return JSON.stringify({ leaderboard });
};

export const rpcFetchPlayerStats: nkruntime.RpcFunction = (ctx, _logger, nk) => {
  const stats = fetchPlayerStats(nk, ctx.userId);
  return JSON.stringify({ stats });
};

export const rpcListPublicMatches: nkruntime.RpcFunction = (_ctx, _logger, nk, payload) => {
  const body: LeaderboardRequest = payload ? JSON.parse(payload) : {};
  const limit = Math.max(1, Math.min(body.limit ?? 20, 100));
  const matches = nk.matchList(limit, true, null, null, 0, 2, "+label.isPrivate:false +label.status:waiting");
  return JSON.stringify({
    matches: matches.map((m) => ({ matchId: m.matchId, size: m.size, label: m.label }))
  });
};
