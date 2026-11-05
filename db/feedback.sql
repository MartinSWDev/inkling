CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  game_id TEXT NOT NULL,          -- random per game, not per person
  kind TEXT NOT NULL,             -- 'vote', 'off', or 'country' (country-pack request)
  vote TEXT,                      -- 'up' | 'down' (kind = vote)
  off_code TEXT,                  -- subject code that felt wrong, or 'all' (kind = off)
  top TEXT NOT NULL,              -- JSON array of up to 3 subject codes, in order
  wildcard TEXT,                  -- subject code or NULL
  answers TEXT NOT NULL,          -- JSON of the Answers object; {"country": ...} when kind = country
  app_version TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS feedback_game ON feedback(game_id);
