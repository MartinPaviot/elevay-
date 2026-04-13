# Manual data migrations

SQL files in this folder are **data-only** cleanups that are *not* tracked by
drizzle-kit. They are safe to apply idempotently and must be run by an
operator against each environment (local, staging, prod) once.

Apply with:

```bash
psql "$DATABASE_URL" -f drizzle/manual/NNNN_<name>.sql
```

Add a log line to `_reports/prod-migrations-applied.md` after running in
prod.

## Log

| File | Purpose | Applied local | Applied prod |
|---|---|---|---|
| `0001_fix_challenge_label.sql` | Normalise legacy `"Finding the right leads"` primaryChallenge values to `"Finding leads"` so the home subtitle renders. | pending | pending |
