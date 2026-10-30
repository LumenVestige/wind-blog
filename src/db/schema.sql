-- Wind Blog schema (SQLite)
-- All timestamps are ISO-8601 UTC strings: datetime('now').
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password      TEXT NOT NULL,              -- bcrypt(clientSHA256(password))
  name          TEXT NOT NULL DEFAULT '',
  email         TEXT NOT NULL UNIQUE,       -- lower-cased
  avatar        TEXT NOT NULL DEFAULT '',   -- path-only key or full URL
  is_site_admin INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS blog_articles (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug               TEXT NOT NULL,
  title              TEXT NOT NULL,
  summary            TEXT NOT NULL DEFAULT '',
  content            TEXT NOT NULL DEFAULT '',
  cover_url          TEXT NOT NULL DEFAULT '',
  image_hashes       TEXT NOT NULL DEFAULT '[]',   -- JSON array of content hashes
  visibility         TEXT NOT NULL DEFAULT 'public', -- public|private|password|unlisted (link-only)
  password_hash      TEXT NOT NULL DEFAULT '',     -- bcrypt
  recommend          INTEGER NOT NULL DEFAULT 0,
  sync_to_main_profile INTEGER NOT NULL DEFAULT 1,
  category_id        INTEGER,
  view_count         INTEGER NOT NULL DEFAULT 0,
  like_count         INTEGER NOT NULL DEFAULT 0,
  comment_count      INTEGER NOT NULL DEFAULT 0,
  moderation_status  TEXT NOT NULL DEFAULT 'approved', -- approved|pending|rejected
  moderation_note    TEXT NOT NULL DEFAULT '',
  moderated_at       TEXT,
  moderated_by       INTEGER NOT NULL DEFAULT 0,
  published_at       TEXT,
  pinned_at          TEXT,
  pin_order          INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_blog_art_user_created ON blog_articles(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_blog_art_visibility ON blog_articles(visibility);
CREATE INDEX IF NOT EXISTS idx_blog_art_moderation ON blog_articles(moderation_status);
CREATE INDEX IF NOT EXISTS idx_blog_art_published ON blog_articles(published_at);
CREATE INDEX IF NOT EXISTS idx_blog_art_pinned ON blog_articles(pinned_at);

CREATE TABLE IF NOT EXISTS blog_categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_default  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS blog_tags (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  name_lower  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, name_lower)
);

CREATE TABLE IF NOT EXISTS blog_article_tags (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id  INTEGER NOT NULL REFERENCES blog_articles(id) ON DELETE CASCADE,
  tag_id      INTEGER NOT NULL REFERENCES blog_tags(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(article_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_blog_art_tag_tag ON blog_article_tags(tag_id);

CREATE TABLE IF NOT EXISTS blog_pages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  slug         TEXT NOT NULL,
  content_md   TEXT NOT NULL DEFAULT '',
  image_hashes TEXT NOT NULL DEFAULT '[]',
  status       TEXT NOT NULL DEFAULT 'draft', -- draft|published
  show_in_nav  INTEGER NOT NULL DEFAULT 0,
  nav_label    TEXT NOT NULL DEFAULT '',
  nav_order    INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, slug)
);

CREATE TABLE IF NOT EXISTS blog_comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id  INTEGER NOT NULL REFERENCES blog_articles(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id   INTEGER NOT NULL DEFAULT 0,
  content     TEXT NOT NULL,
  like_count  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_blog_cmt_art ON blog_comments(article_id, created_at);

CREATE TABLE IF NOT EXISTS blog_comment_likes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id  INTEGER NOT NULL REFERENCES blog_comments(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(comment_id, user_id)
);

CREATE TABLE IF NOT EXISTS blog_likes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id  INTEGER NOT NULL REFERENCES blog_articles(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(article_id, user_id)
);

CREATE TABLE IF NOT EXISTS blog_article_view_uvs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id  INTEGER NOT NULL REFERENCES blog_articles(id) ON DELETE CASCADE,
  visitor_key TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(article_id, visitor_key)
);

CREATE TABLE IF NOT EXISTS blog_reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id  INTEGER NOT NULL REFERENCES blog_articles(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending', -- pending|resolved|dismissed
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, article_id)
);
CREATE INDEX IF NOT EXISTS idx_blog_report_status ON blog_reports(status);

CREATE TABLE IF NOT EXISTS blog_site_configs (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id               INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  theme_id              TEXT NOT NULL DEFAULT 'mizuki',  -- mizuki|chirpy|simple
  color_scheme          TEXT NOT NULL DEFAULT 'system',  -- light|dark|system
  subtitle              TEXT NOT NULL DEFAULT '',
  social_links          TEXT NOT NULL DEFAULT '[]',      -- JSON [{type,url,label}]
  about_md              TEXT NOT NULL DEFAULT '',
  home_intro_md         TEXT NOT NULL DEFAULT '',
  friends_md            TEXT NOT NULL DEFAULT '',
  activated_at          TEXT,
  agreement_version     TEXT NOT NULL DEFAULT '',
  agreement_accepted_at TEXT,
  image_upload_enabled  INTEGER NOT NULL DEFAULT 0,
  email_notify_enabled  INTEGER NOT NULL DEFAULT 0,
  email_notify_strategy TEXT NOT NULL DEFAULT 'off',
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS blog_image_assets (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_key   TEXT NOT NULL UNIQUE,
  url          TEXT NOT NULL,
  content_hash TEXT NOT NULL DEFAULT '',
  article_id   INTEGER,
  purpose      TEXT NOT NULL DEFAULT 'content', -- cover|content|misc
  status       TEXT NOT NULL DEFAULT 'ready',   -- pending|ready
  reserved_at  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_blog_img_user ON blog_image_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_blog_img_hash ON blog_image_assets(user_id, content_hash);

CREATE TABLE IF NOT EXISTS blog_image_upload_requests (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending', -- pending|approved|rejected
  review_note  TEXT NOT NULL DEFAULT '',
  reviewer_id  INTEGER NOT NULL DEFAULT 0,
  reviewed_at  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_blog_img_req_status ON blog_image_upload_requests(status);

CREATE TABLE IF NOT EXISTS blog_static_sites (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  slug        TEXT NOT NULL,
  entry       TEXT NOT NULL DEFAULT 'index.html',
  prefix      TEXT NOT NULL DEFAULT '',
  file_count  INTEGER NOT NULL DEFAULT 0,
  show_in_nav INTEGER NOT NULL DEFAULT 0,
  nav_label   TEXT NOT NULL DEFAULT '',
  nav_order   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, slug)
);

CREATE TABLE IF NOT EXISTS obsidian_plugin_meta (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  version         TEXT NOT NULL DEFAULT '',
  min_app_version TEXT NOT NULL DEFAULT '1.4.0',
  notes           TEXT NOT NULL DEFAULT '',
  released_at     INTEGER NOT NULL DEFAULT 0,
  download_base   TEXT NOT NULL DEFAULT '',
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO obsidian_plugin_meta (id) VALUES (1);

CREATE TABLE IF NOT EXISTS site_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  key        TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS security_rate_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_expiry ON security_rate_limits(expires_at);
CREATE INDEX IF NOT EXISTS idx_blog_comments_parent ON blog_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_blog_art_user_public ON blog_articles(user_id, visibility, moderation_status, published_at DESC, id DESC);

-- Editor metadata is separate so existing installations need no ALTER migration.
CREATE TABLE IF NOT EXISTS blog_article_options (
  article_id INTEGER PRIMARY KEY REFERENCES blog_articles(id) ON DELETE CASCADE,
  summary_mode TEXT NOT NULL DEFAULT 'auto',
  is_draft INTEGER NOT NULL DEFAULT 0
);

-- Visitors are not users. Negative public IDs distinguish new visitor threads
-- from legacy authenticated comments without changing the plugin contract.
CREATE TABLE IF NOT EXISTS blog_guest_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES blog_articles(id) ON DELETE CASCADE,
  parent_id INTEGER NOT NULL DEFAULT 0,
  visitor_key TEXT NOT NULL DEFAULT '',
  owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  like_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_guest_comments_article ON blog_guest_comments(article_id, status, parent_id, created_at);
CREATE TABLE IF NOT EXISTS blog_visitor_likes (
  kind TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  visitor_key TEXT NOT NULL,
  PRIMARY KEY(kind, target_id, visitor_key)
);
CREATE VIEW IF NOT EXISTS blog_comment_entries AS
  SELECT c.id, c.article_id, c.parent_id, c.user_id, c.content, c.like_count, c.created_at,
    u.id AS author_id, u.username AS author_username, u.name AS author_name, u.avatar AS author_avatar,
    'approved' AS status
  FROM blog_comments c JOIN users u ON u.id = c.user_id
  UNION ALL
  SELECT -c.id, c.article_id, c.parent_id, COALESCE(c.owner_id, 0), c.content, c.like_count, c.created_at,
    COALESCE(c.owner_id, 0), COALESCE(u.username, ''), CASE WHEN c.owner_id IS NULL THEN c.name ELSE u.name END,
    COALESCE(u.avatar, ''), c.status
  FROM blog_guest_comments c LEFT JOIN users u ON u.id = c.owner_id;
CREATE TRIGGER IF NOT EXISTS clean_visitor_article_likes AFTER DELETE ON blog_articles
BEGIN
  DELETE FROM blog_visitor_likes WHERE kind = 'article' AND target_id = OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS clean_visitor_comment_likes AFTER DELETE ON blog_comments
BEGIN
  DELETE FROM blog_visitor_likes WHERE kind = 'comment' AND target_id = OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS clean_guest_comment_likes AFTER DELETE ON blog_guest_comments
BEGIN
  DELETE FROM blog_visitor_likes WHERE kind = 'comment' AND target_id = -OLD.id;
END;
