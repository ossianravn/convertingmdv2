-- Frankensurf fallback reads are budgeted like Browser Run, per day and month.
ALTER TABLE usage_counters ADD COLUMN frankensurf_requests INTEGER NOT NULL DEFAULT 0;
