export const upsertUserAndStats = (
  nk: nkruntime.Nakama,
  userId: string,
  username: string
): void => {
  nk.sqlExec(
    "INSERT INTO app_users (id, username) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username",
    [userId, username]
  );

  nk.sqlExec(
    "INSERT INTO player_stats (user_id, wins, losses, draws, elo) VALUES ($1, 0, 0, 0, 1000) ON CONFLICT (user_id) DO NOTHING",
    [userId]
  );
};

export const recordMatchHistory = (
  nk: nkruntime.Nakama,
  params: {
    matchId: string;
    mode: string;
    playerX: string;
    playerO: string;
    winnerId: string | null;
    resultType: string;
    moveCount: number;
  }
): void => {
  nk.sqlExec(
    "INSERT INTO match_history (match_id, mode, player_x, player_o, winner_id, result_type, move_count) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [params.matchId, params.mode, params.playerX, params.playerO, params.winnerId, params.resultType, params.moveCount]
  );
};

export const applyResultToStats = (
  nk: nkruntime.Nakama,
  params: {
    winnerId?: string;
    loserId?: string;
    playerX: string;
    playerO: string;
    isDraw: boolean;
  }
): void => {
  if (params.isDraw) {
    nk.sqlExec("UPDATE player_stats SET draws = draws + 1, updated_at = now() WHERE user_id IN ($1, $2)", [
      params.playerX,
      params.playerO
    ]);
    return;
  }

  if (!params.winnerId || !params.loserId) {
    return;
  }

  nk.sqlExec("UPDATE player_stats SET wins = wins + 1, elo = elo + 10, updated_at = now() WHERE user_id = $1", [
    params.winnerId
  ]);
  nk.sqlExec("UPDATE player_stats SET losses = losses + 1, elo = GREATEST(100, elo - 10), updated_at = now() WHERE user_id = $1", [
    params.loserId
  ]);
};

export const fetchLeaderboard = (
  nk: nkruntime.Nakama,
  limit: number
): Array<Record<string, unknown>> => {
  const rows = nk.sqlQuery(
    "SELECT u.id AS user_id, u.username, s.wins, s.losses, s.draws, s.elo FROM player_stats s JOIN app_users u ON u.id = s.user_id ORDER BY s.wins DESC, s.elo DESC, u.created_at ASC LIMIT $1",
    [limit]
  );
  return rows;
};

export const fetchPlayerStats = (
  nk: nkruntime.Nakama,
  userId: string
): Record<string, unknown> | null => {
  const rows = nk.sqlQuery(
    "SELECT u.id AS user_id, u.username, s.wins, s.losses, s.draws, s.elo, s.updated_at FROM player_stats s JOIN app_users u ON u.id = s.user_id WHERE s.user_id = $1",
    [userId]
  );
  if (!rows.length) {
    return null;
  }
  return rows[0];
};
