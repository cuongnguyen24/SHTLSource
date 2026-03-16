-- Core_Log
CREATE SCHEMA IF NOT EXISTS core_log;

CREATE TABLE IF NOT EXISTS core_log.access_logs (
    id          BIGSERIAL PRIMARY KEY,
    channel_id  INT NOT NULL,
    user_id     INT NOT NULL DEFAULT 0,
    user_name   VARCHAR(100) NULL,
    path        TEXT NOT NULL,
    method      VARCHAR(10) NULL,
    status_code INT NOT NULL DEFAULT 0,
    duration_ms BIGINT NOT NULL DEFAULT 0,
    ip_address  VARCHAR(64) NULL,
    user_agent  TEXT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_access_logs_channel ON core_log.access_logs(channel_id, created_at);

CREATE TABLE IF NOT EXISTS core_log.action_logs (
    id          BIGSERIAL PRIMARY KEY,
    channel_id  INT NOT NULL,
    user_id     INT NOT NULL DEFAULT 0,
    user_name   VARCHAR(100) NULL,
    action      VARCHAR(100) NOT NULL,
    table_name  VARCHAR(100) NULL,
    record_id   VARCHAR(50) NULL,
    old_value   TEXT NULL,
    new_value   TEXT NULL,
    description TEXT NULL,
    ip_address  VARCHAR(64) NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_action_logs_channel ON core_log.action_logs(channel_id, created_at);

CREATE TABLE IF NOT EXISTS core_log.error_logs (
    id          BIGSERIAL PRIMARY KEY,
    channel_id  INT NOT NULL,
    user_id     INT NOT NULL DEFAULT 0,
    message     TEXT NOT NULL,
    stack_trace TEXT NULL,
    source      TEXT NULL,
    url         TEXT NULL,
    level       VARCHAR(20) NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT now()
);

