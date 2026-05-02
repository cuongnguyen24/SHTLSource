# ETL playbook — multi-database / multi-schema → single database, flat `dbo`

## Preconditions

- Target database created (e.g. `SHTL_App`).
- EF initial migration applied so `dbo` tables match prefixed names (`acc_users`, `stg_documents`, …).

## Order of operations

1. **Freeze writes** — stop all web apps and `Service.Export`.
2. **Create empty target** — `CREATE DATABASE SHTL_App;` then `dotnet ef database update` from `SHTL.App` (or apply generated SQL script).
3. **Disable constraints** on target if you add FKs later (current model had none).
4. **Per legacy catalog** — `INSERT INTO SHTL_App.dbo.acc_users (...) SELECT ... FROM Core_Acc.core_acc.users` (repeat for every table, mapping column order).
5. **Identity / sequences** — reseed `IDENTITY` where needed (`DBCC CHECKIDENT`) after bulk insert, or use `SET IDENTITY_INSERT` during copy.
6. **Verify counts** — row counts per table vs source.
7. **Cutover** — point `ConnectionStrings:DefaultConnection` to `SHTL_App`, deploy `SHTL.App`, smoke test.

## Notes

- If sources remain six separate SQL Server databases, use **linked server** or **export BACPAC** + import into one server, then cross-database `INSERT…SELECT` where permitted.
- Collation and `NVARCHAR` lengths must match to avoid truncation.
