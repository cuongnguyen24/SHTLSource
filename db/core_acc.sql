-- Core_Acc
-- No FK. Multi-tenant via channel_id.

CREATE SCHEMA IF NOT EXISTS core_acc;

CREATE TABLE IF NOT EXISTS core_acc.users (
    id              SERIAL PRIMARY KEY,
    channel_id      INT NOT NULL,
    user_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(200) NOT NULL,
    full_name       VARCHAR(200) NOT NULL,
    password_hash   TEXT NOT NULL,
    password_salt   TEXT NULL,
    dept_id         INT NOT NULL DEFAULT 0,
    position_id     INT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_admin        BOOLEAN NOT NULL DEFAULT FALSE,
    avatar          TEXT NULL,
    phone           VARCHAR(50) NULL,
    weight          INT NOT NULL DEFAULT 0,
    search_meta     TEXT NULL,
    last_login      TIMESTAMP NULL,
    created         TIMESTAMP NOT NULL DEFAULT now(),
    created_by      INT NOT NULL DEFAULT 0,
    updated         TIMESTAMP NULL,
    updated_by      INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ix_users_channel ON core_acc.users(channel_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_channel_username ON core_acc.users(channel_id, user_name);

CREATE TABLE IF NOT EXISTS core_acc.roles (
    id              SERIAL PRIMARY KEY,
    channel_id      INT NOT NULL,
    name            VARCHAR(200) NOT NULL,
    code            VARCHAR(50) NOT NULL,
    description     TEXT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created         TIMESTAMP NOT NULL DEFAULT now(),
    created_by      INT NOT NULL DEFAULT 0,
    updated         TIMESTAMP NULL,
    updated_by      INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_roles_channel ON core_acc.roles(channel_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_roles_channel_code ON core_acc.roles(channel_id, code);

CREATE TABLE IF NOT EXISTS core_acc.role_permissions (
    id              BIGSERIAL PRIMARY KEY,
    channel_id      INT NOT NULL,
    role_id         INT NOT NULL,
    permission_code VARCHAR(100) NOT NULL,
    created         TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_role_permissions_role ON core_acc.role_permissions(channel_id, role_id);

CREATE TABLE IF NOT EXISTS core_acc.user_roles (
    id          BIGSERIAL PRIMARY KEY,
    channel_id  INT NOT NULL,
    user_id     INT NOT NULL,
    role_id     INT NOT NULL,
    created     TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_user_roles_user ON core_acc.user_roles(channel_id, user_id);

CREATE TABLE IF NOT EXISTS core_acc.depts (
    id          SERIAL PRIMARY KEY,
    channel_id  INT NOT NULL,
    name        VARCHAR(200) NOT NULL,
    code        VARCHAR(50) NOT NULL DEFAULT '',
    describe    TEXT NULL,
    parent      INT NOT NULL DEFAULT 0,
    parents     TEXT NULL,
    weight      INT NOT NULL DEFAULT 0,
    search_meta TEXT NULL,
    created     TIMESTAMP NOT NULL DEFAULT now(),
    created_by  INT NOT NULL DEFAULT 0,
    updated     TIMESTAMP NULL,
    updated_by  INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_depts_channel ON core_acc.depts(channel_id);

CREATE TABLE IF NOT EXISTS core_acc.positions (
    id          SERIAL PRIMARY KEY,
    channel_id  INT NOT NULL,
    name        VARCHAR(200) NOT NULL,
    describe    TEXT NULL,
    weight      INT NOT NULL DEFAULT 0,
    created     TIMESTAMP NOT NULL DEFAULT now(),
    created_by  INT NOT NULL DEFAULT 0,
    updated     TIMESTAMP NULL,
    updated_by  INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS core_acc.teams (
    id          SERIAL PRIMARY KEY,
    channel_id  INT NOT NULL,
    name        VARCHAR(200) NOT NULL,
    describe    TEXT NULL,
    weight      INT NOT NULL DEFAULT 0,
    created     TIMESTAMP NOT NULL DEFAULT now(),
    created_by  INT NOT NULL DEFAULT 0,
    updated     TIMESTAMP NULL,
    updated_by  INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS core_acc.user_sessions (
    id          BIGSERIAL PRIMARY KEY,
    channel_id  INT NOT NULL,
    user_id     INT NOT NULL,
    token       TEXT NOT NULL,
    ip_address  VARCHAR(64) NULL,
    user_agent  TEXT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT now(),
    expires_at  TIMESTAMP NULL,
    is_revoked  BOOLEAN NOT NULL DEFAULT FALSE
);

