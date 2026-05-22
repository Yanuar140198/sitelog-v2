"""
Classify remaining unclassified AHSP items.

Strategy:
  1. Load D:/sitelog-v2/scripts/bina-marga-jenis.json
  2. Query DB for items with jenis LIKE '%belum terklasifikasi%'
  3. For each: try item-code re-extract from source_kode (xlsx headers were
     mostly blank, so this rarely hits — but we keep the path for the few
     items whose source_kode does contain a 3.x / 5.x reference).
  4. Heuristic classification by satuan + dominant resource codes.
  5. Emit + run UPDATE statements via docker exec psql (no psycopg2 needed).
  6. Print summary.

Run: D:/FORM/.venv/Scripts/python.exe D:/sitelog-v2/scripts/classify-ahsp-remaining.py
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path
from collections import Counter

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).parent
LOOKUP_PATH = ROOT / "bina-marga-jenis.json"
LOOKUP: dict[str, str] = {
    k: v for k, v in json.loads(LOOKUP_PATH.read_text(encoding="utf-8")).items()
    if not k.startswith("_")
}

PSQL_ARGS = [
    "docker", "exec", "-i", "sitelog-pg",
    "psql", "-U", "postgres", "-d", "sitelog",
    "-At", "-F", "\t",
]


def psql(sql: str, capture: bool = True) -> str:
    env = {**os.environ, "PGPASSWORD": "dev"}
    p = subprocess.run(
        PSQL_ARGS if capture else PSQL_ARGS[:-4],
        input=sql,
        capture_output=True,
        text=True,
        env=env,
        encoding="utf-8",
    )
    if p.returncode != 0:
        raise SystemExit(f"psql failed: {p.stderr}")
    return p.stdout


# ----- 1. Fetch unclassified rows + their resources ------------------------

rows = psql(
    "SELECT id::text, kode, satuan, COALESCE(source_kode,'') "
    "FROM ahsp_item WHERE jenis LIKE '%belum terklasifikasi%' ORDER BY kode;"
).strip().splitlines()

items: list[dict] = []
for line in rows:
    parts = line.split("\t")
    if len(parts) < 4:
        continue
    items.append({
        "id": parts[0],
        "kode": parts[1],
        "satuan": parts[2],
        "source": parts[3],
    })

print(f"Fetched {len(items)} unclassified items")

if not items:
    print("Nothing to do.")
    raise SystemExit(0)

# Fetch resources grouped per item
ids_sql = ",".join(f"'{i['id']}'" for i in items)
res_rows = psql(
    f"SELECT ahsp_item_id::text, resource_code, COALESCE(uraian,''), category "
    f"FROM ahsp_resource WHERE ahsp_item_id IN ({ids_sql}) "
    f"ORDER BY ahsp_item_id, ordinal;"
).strip().splitlines()

by_item: dict[str, list[tuple[str, str, str]]] = {}
for line in res_rows:
    parts = line.split("\t")
    if len(parts) < 4:
        continue
    by_item.setdefault(parts[0], []).append((parts[1], parts[2], parts[3]))


# ----- 2. Classification helpers ------------------------------------------

ITEM_CODE_RE = re.compile(r"(\d+\.\d+(?:\s*\(\d+[a-z]?\))?[a-z]?)")


def lookup_jenis(source: str) -> str | None:
    m = ITEM_CODE_RE.search(source)
    if not m:
        return None
    key = m.group(1).replace(" ", "")
    # normalize: "3.1(1)" -> "3.1 (1)"
    norm = re.sub(r"(\d+\.\d+)\((\d+[a-z]?)\)", r"\1 (\2)", key)
    return LOOKUP.get(norm) or LOOKUP.get(key)


def classify_heuristic(satuan: str, resources: list[tuple[str, str, str]]) -> str:
    """Return jenis based on resource fingerprint + satuan."""
    codes = {r[0] for r in resources}
    uraian_blob = " ".join(r[1].lower() for r in resources)
    sat = (satuan or "").lower()

    has_excavator = any(c in codes for c in {"E10", "E15"})
    has_dt        = any(c in codes for c in {"E08", "E09"})
    has_bulldozer = "E04" in codes or "bulldozer" in uraian_blob
    has_grader    = "E13" in codes
    has_vibro     = "E19" in codes or "vibratory" in uraian_blob or "vibrating" in uraian_blob
    has_water     = "E23" in codes or "water" in uraian_blob
    has_drill     = "E37" in codes or "drill" in uraian_blob or "breaker" in uraian_blob
    has_compactor = "compactor" in uraian_blob or "tamper" in uraian_blob
    has_chainsaw  = "E41" in codes or "chain saw" in uraian_blob
    has_asphalt   = any(c in codes for c in {"E45", "E47"}) or "aspal" in uraian_blob
    has_geotex    = any(c.startswith("M29") for c in codes) or "geotex" in uraian_blob or "geotekstil" in uraian_blob
    has_pipe      = any(c in codes for c in {"M46"}) or "pipa" in uraian_blob or "baja bergelombang" in uraian_blob

    # Haul: only DT, satuan contains /km
    if "/km" in sat.replace(" ", "") or sat.endswith("km"):
        if has_chainsaw or has_geotex:
            return "Pengangkutan Log/Geotekstil ke Lokasi (Haul)"
        return "Pengangkutan Bahan dengan Dump Truck (Add Haul)"

    # Tree/log clearing with chainsaw
    if has_chainsaw:
        return "Pembersihan dan Pengupasan Lahan (Pohon)"

    # Drill/breaker on rock
    if has_drill:
        return "Galian Batu"

    # Pipe culvert install
    if has_pipe:
        return "Gorong-gorong Pipa Baja Bergelombang"

    # Asphalt
    if has_asphalt:
        return "Lapis Perkerasan Aspal"

    # M2 grading patterns
    if sat == "m2":
        if has_grader and has_vibro and has_water:
            return "Penyiapan Badan Jalan"
        if has_bulldozer and has_excavator and has_dt:
            return "Pembersihan dan Pengupasan Lahan"
        return "Penyiapan Badan Jalan"

    # m (linear) — drainage trench
    if sat in {"m"}:
        if has_excavator and has_dt:
            return "Galian untuk Selokan Drainase dan Saluran Air"
        return "Pekerjaan Drainase Linier"

    # M3 with full timbunan kit (bulldozer + compactor/vibro + water)
    if sat == "m3":
        if (has_bulldozer or has_grader) and (has_vibro or has_compactor) and has_water:
            if has_excavator:
                return "Timbunan Biasa dari Sumber Galian"
            return "Pemadatan Timbunan / Lapis Pondasi"
        if has_grader and has_vibro and has_water and has_excavator and has_dt:
            return "Lapis Pondasi Agregat"
        if has_vibro and has_water and not has_dt:
            return "Pemadatan Timbunan"
        if has_excavator and has_dt:
            return "Galian Biasa"
        if has_bulldozer and has_dt:
            return "Timbunan / Penyebaran Material"

    # Fallback
    return f"Pekerjaan Konstruksi ({satuan})"


# ----- 3. Classify each row -----------------------------------------------

by_lookup = 0
by_heuristic = 0
still_unknown = 0
updates: list[tuple[str, str]] = []

for it in items:
    jenis = lookup_jenis(it["source"])
    if jenis:
        by_lookup += 1
        method = "lookup"
    else:
        res = by_item.get(it["id"], [])
        jenis = classify_heuristic(it["satuan"], res)
        if jenis.startswith("Pekerjaan Konstruksi"):
            still_unknown += 1
            method = "fallback"
        else:
            by_heuristic += 1
            method = "heuristic"
    it["jenis"] = jenis
    print(f"  {it['kode']:>8}  [{method:>9}]  {jenis}")
    updates.append((it["id"], jenis))


# ----- 4. Apply updates ---------------------------------------------------

def esc(s: str) -> str:
    return s.replace("'", "''")


sql_chunks = []
for iid, jenis in updates:
    sql_chunks.append(f"UPDATE ahsp_item SET jenis='{esc(jenis)}', updated_at=now() WHERE id='{iid}';")
sql_doc = "BEGIN;\n" + "\n".join(sql_chunks) + "\nCOMMIT;\n"

psql(sql_doc)


# ----- 5. Summary ---------------------------------------------------------

print()
print("=== Summary ===")
print(f"  classified_by_lookup    : {by_lookup}")
print(f"  classified_by_heuristic : {by_heuristic}")
print(f"  still_unknown (fallback): {still_unknown}")
print(f"  total updated           : {len(updates)}")

# Verify
remaining = psql(
    "SELECT COUNT(*) FROM ahsp_item WHERE jenis LIKE '%belum%';"
).strip()
print(f"  remaining %belum%       : {remaining}")
