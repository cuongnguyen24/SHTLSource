-- Core_Cnf
CREATE SCHEMA IF NOT EXISTS core_cnf;

CREATE TABLE IF NOT EXISTS core_cnf.channels (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    describe        TEXT NULL,
    url             TEXT NULL,
    lang            VARCHAR(10) NULL,
    logo            TEXT NULL,
    weight          INT NOT NULL DEFAULT 0,
    parent          INT NOT NULL DEFAULT 0,
    parents         TEXT NULL,
    start_date      DATE NULL,
    end_date        DATE NULL,
    account_limit   INT NOT NULL DEFAULT 0,
    storage_limit   BIGINT NOT NULL DEFAULT 0,
    document_limit  BIGINT NOT NULL DEFAULT 0,
    is_published    BOOLEAN NOT NULL DEFAULT TRUE,
    search_meta     TEXT NULL,
    created         TIMESTAMP NOT NULL DEFAULT now(),
    created_by      INT NOT NULL DEFAULT 0,
    updated         TIMESTAMP NULL,
    updated_by      INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS core_cnf.configs (
    id          SERIAL PRIMARY KEY,
    channel_id  INT NOT NULL,
    key         VARCHAR(200) NOT NULL,
    value       TEXT NULL,
    group_name  VARCHAR(100) NULL,
    description TEXT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_configs_channel_key ON core_cnf.configs(channel_id, key);

CREATE TABLE IF NOT EXISTS core_cnf.content_types (
    id          SERIAL PRIMARY KEY,
    channel_id  INT NOT NULL,
    name        VARCHAR(200) NOT NULL,
    code        VARCHAR(50) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    weight      INT NOT NULL DEFAULT 0,
    created     TIMESTAMP NOT NULL DEFAULT now(),
    created_by  INT NOT NULL DEFAULT 0,
    updated     TIMESTAMP NULL,
    updated_by  INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS core_cnf.record_types (
    id              SERIAL PRIMARY KEY,
    channel_id      INT NOT NULL,
    content_type_id INT NOT NULL DEFAULT 0,
    name            VARCHAR(200) NOT NULL,
    code            VARCHAR(50) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    weight          INT NOT NULL DEFAULT 0,
    search_meta     TEXT NULL,
    created         TIMESTAMP NOT NULL DEFAULT now(),
    created_by      INT NOT NULL DEFAULT 0,
    updated         TIMESTAMP NULL,
    updated_by      INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS core_cnf.sync_types (
    id          SERIAL PRIMARY KEY,
    channel_id  INT NOT NULL,
    name        VARCHAR(200) NOT NULL,
    code        VARCHAR(50) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    weight      INT NOT NULL DEFAULT 0,
    created     TIMESTAMP NOT NULL DEFAULT now(),
    created_by  INT NOT NULL DEFAULT 0,
    updated     TIMESTAMP NULL,
    updated_by  INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS core_cnf.export_types (
    id              SERIAL PRIMARY KEY,
    channel_id      INT NOT NULL,
    name            VARCHAR(200) NOT NULL,
    code            VARCHAR(50) NOT NULL,
    exporter_class  TEXT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    weight          INT NOT NULL DEFAULT 0,
    created         TIMESTAMP NOT NULL DEFAULT now(),
    created_by      INT NOT NULL DEFAULT 0,
    updated         TIMESTAMP NULL,
    updated_by      INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS core_cnf.translations (
    id          SERIAL PRIMARY KEY,
    channel_id  INT NOT NULL,
    lang        VARCHAR(10) NOT NULL DEFAULT 'vi',
    key         VARCHAR(200) NOT NULL,
    value       TEXT NULL
);

