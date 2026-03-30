-- Maps 4-digit room codes to Nakama match ids (cleared when match ends in runtime finalize).
CREATE TABLE IF NOT EXISTS room_join_codes (
  code TEXT PRIMARY KEY,
  match_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_room_join_codes_match_id ON room_join_codes(match_id);
