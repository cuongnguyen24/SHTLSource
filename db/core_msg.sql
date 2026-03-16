-- Core_Msg (stub)
CREATE SCHEMA IF NOT EXISTS core_msg;

CREATE TABLE IF NOT EXISTS core_msg.notifications (
    id          BIGSERIAL PRIMARY KEY,
    channel_id  INT NOT NULL,
    user_id     INT NOT NULL DEFAULT 0,
    title       TEXT NOT NULL,
    content     TEXT NULL,
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP NOT NULL DEFAULT now()
);

