-- Optional formula behind each AHSP resource koefisien (e.g. "1 / (Q × n)").
ALTER TABLE ahsp_resource ADD COLUMN IF NOT EXISTS formula text;
