-- Core_Catalog (stub)
CREATE SCHEMA IF NOT EXISTS core_catalog;

CREATE TABLE IF NOT EXISTS core_catalog.provinces (
    id          INT PRIMARY KEY,
    name        VARCHAR(200) NOT NULL
);

CREATE TABLE IF NOT EXISTS core_catalog.districts (
    id          INT PRIMARY KEY,
    province_id INT NOT NULL,
    name        VARCHAR(200) NOT NULL
);

CREATE TABLE IF NOT EXISTS core_catalog.wards (
    id          INT PRIMARY KEY,
    district_id INT NOT NULL,
    name        VARCHAR(200) NOT NULL
);

