-- Một database duy nhất chứa mọi schema (core_acc, core_cnf, core_stg, …).
-- Chạy trên master, sau đó lần lượt chạy core_acc.sql … core_catalog.sql với USE Core_All.

IF DB_ID(N'Core_All') IS NULL
    CREATE DATABASE Core_All;
GO
