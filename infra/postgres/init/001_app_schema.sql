CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS player_stats (
  user_id UUID PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  draws INT NOT NULL DEFAULT 0,
  elo INT NOT NULL DEFAULT 1000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS match_history (
  id BIGSERIAL PRIMARY KEY,
  match_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  player_x UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  player_o UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  winner_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  result_type TEXT NOT NULL,
  move_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_history_match_id ON match_history(match_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_wins_elo ON player_stats(wins DESC, elo DESC);
