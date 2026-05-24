-- Normalize ahsp_item.satuan values to canonical lowercase forms.
-- Canonical set: m3, m2, m, m3/km, ls
-- See agent task: normalize 8 satuan variations + fill 21 blanks.

BEGIN;

-- 1) Lowercase / canonicalize the known variants.
UPDATE ahsp_item SET satuan = 'm3'    WHERE satuan IN ('M3', 'm3');
UPDATE ahsp_item SET satuan = 'm2'    WHERE satuan IN ('M2', 'm2');
UPDATE ahsp_item SET satuan = 'm'     WHERE satuan IN ('m', 'M');
UPDATE ahsp_item SET satuan = 'm3/km' WHERE satuan IN ('M3 / Km', 'M3/Km', 'm3 / km', 'm3/Km', 'M3/km');

-- 2) Fill blanks by category heuristic (best-effort).
UPDATE ahsp_item SET satuan = 'm3'
  WHERE (satuan IS NULL OR TRIM(satuan) = '')
    AND category IN ('galian','timbunan','struktur','perkerasan');

UPDATE ahsp_item SET satuan = 'm'
  WHERE (satuan IS NULL OR TRIM(satuan) = '')
    AND category = 'drainase';

UPDATE ahsp_item SET satuan = 'm2'
  WHERE (satuan IS NULL OR TRIM(satuan) = '')
    AND category IN ('pembersihan','finishing');

UPDATE ahsp_item SET satuan = 'ls'
  WHERE (satuan IS NULL OR TRIM(satuan) = '')
    AND category = 'overhead';

-- Catch-all for anything still blank.
UPDATE ahsp_item SET satuan = 'ls'
  WHERE satuan IS NULL OR TRIM(satuan) = '';

COMMIT;

-- Verification (no-op if everything is normalized).
SELECT satuan, COUNT(*) FROM ahsp_item GROUP BY satuan ORDER BY 2 DESC;
