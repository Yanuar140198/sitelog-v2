-- Add `category` filter column to ahsp_item, then populate by jenis keywords.
-- Idempotent: re-running keeps existing assignments.

ALTER TABLE ahsp_item ADD COLUMN IF NOT EXISTS category varchar(64);
CREATE INDEX IF NOT EXISTS ahsp_item_category_idx ON ahsp_item(category);

-- Populate category from jenis keywords (specific → generic order)
UPDATE ahsp_item SET category = 'galian'
  WHERE category IS NULL AND lower(jenis) LIKE '%galian%';

UPDATE ahsp_item SET category = 'timbunan'
  WHERE category IS NULL AND lower(jenis) LIKE '%timbunan%';

UPDATE ahsp_item SET category = 'perkerasan'
  WHERE category IS NULL AND (
    lower(jenis) LIKE '%perkerasan%'
    OR lower(jenis) LIKE '%aspal%'
    OR lower(jenis) LIKE '%laston%'
    OR lower(jenis) LIKE '%lapis pondasi%'
    OR lower(jenis) LIKE '%subbase%'
    OR lower(jenis) LIKE '%base course%'
  );

UPDATE ahsp_item SET category = 'drainase'
  WHERE category IS NULL AND (
    lower(jenis) LIKE '%drainase%'
    OR lower(jenis) LIKE '%saluran%'
    OR lower(jenis) LIKE '%culvert%'
    OR lower(jenis) LIKE '%ditch%'
    OR lower(jenis) LIKE '%gorong%'
    OR lower(jenis) LIKE '%levee%'
    OR lower(jenis) LIKE '%pocket pond%'
    OR lower(jenis) LIKE '%hdpe%'
  );

UPDATE ahsp_item SET category = 'struktur'
  WHERE category IS NULL AND (
    lower(jenis) LIKE '%beton%'
    OR lower(jenis) LIKE '%pasangan batu%'
    OR lower(jenis) LIKE '%baja%'
    OR lower(jenis) LIKE '%struktur%'
    OR lower(jenis) LIKE '%geotek%'
    OR lower(jenis) LIKE '%geogrid%'
  );

UPDATE ahsp_item SET category = 'pembersihan'
  WHERE category IS NULL AND (
    lower(jenis) LIKE '%clearing%'
    OR lower(jenis) LIKE '%topsoil%'
    OR lower(jenis) LIKE '%tree%'
    OR lower(jenis) LIKE '%pembersihan%'
    OR lower(jenis) LIKE '%biomass%'
    OR lower(jenis) LIKE '%log%'
    OR lower(jenis) LIKE '%pengupasan%'
  );

UPDATE ahsp_item SET category = 'haul'
  WHERE category IS NULL AND (
    lower(jenis) LIKE '%haul%'
    OR lower(jenis) LIKE '%angkut%'
    OR lower(jenis) LIKE '%pengangkutan%'
  );

UPDATE ahsp_item SET category = 'finishing'
  WHERE category IS NULL AND (
    lower(jenis) LIKE '%riprap%'
    OR lower(jenis) LIKE '%slope%'
    OR lower(jenis) LIKE '%finishing%'
    OR lower(jenis) LIKE '%geotekstil%'
    OR lower(jenis) LIKE '%protect%'
    OR lower(jenis) LIKE '%safety berm%'
  );

UPDATE ahsp_item SET category = 'overhead'
  WHERE category IS NULL AND (
    lower(jenis) LIKE '%indirect%'
    OR lower(jenis) LIKE '%ohp%'
    OR lower(jenis) LIKE '%mobilisation%'
    OR lower(jenis) LIKE '%mobilization%'
    OR lower(jenis) LIKE '%clearance%'
    OR lower(jenis) LIKE '%inspection%'
    OR lower(jenis) LIKE '%handover%'
    OR lower(jenis) LIKE '%estimate%'
    OR lower(jenis) LIKE '%schedule%'
    OR lower(jenis) LIKE '%punch list%'
    OR lower(jenis) LIKE '%take off%'
    OR lower(jenis) LIKE '%risk%'
    OR lower(jenis) LIKE '%man power%'
    OR lower(jenis) LIKE '%meals%'
    OR lower(jenis) LIKE '%density test%'
    OR lower(jenis) LIKE '%engineering drawing%'
    OR lower(jenis) LIKE '%grading%'
    OR lower(jenis) LIKE '%compaction%'
    OR lower(jenis) LIKE '%penyiapan%'
    OR lower(jenis) LIKE '%quarry%'
    OR lower(jenis) LIKE '%milling%'
    OR lower(jenis) LIKE '%pembuangan%'
  );

UPDATE ahsp_item SET category = 'lain-lain' WHERE category IS NULL;
