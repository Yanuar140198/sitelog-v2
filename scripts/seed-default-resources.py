#!/usr/bin/env python3
"""Seed default ahsp_resource rows for AHSP items that have zero resources.

For each broken AHSP, insert a small set of representative resources
(tenaga + bahan + peralatan) sized by category. lain-lain items are
archived instead of seeded.

Run with:
    D:/FORM/.venv/Scripts/python.exe D:/sitelog-v2/scripts/seed-default-resources.py
"""

from __future__ import annotations

import json
import subprocess
import sys
from dataclasses import dataclass


CONTAINER = "sitelog-pg"
PG_USER = "postgres"
PG_DB = "sitelog"
PG_PASS = "dev"


@dataclass(frozen=True)
class Resource:
    code: str          # resource_code
    cat: str           # resource_category enum: tenaga | bahan | peralatan
    uraian: str        # human label
    koef: float
    satuan: str        # 'jam', 'm3', 'kg', ...
    hsd: float


# Per spec: L01=Pekerja (tenaga), L02=Tukang, L03=Mandor,
# M*=bahan, E*/ZB*=peralatan.
TEMPLATES: dict[str, list[Resource]] = {
    "galian": [
        Resource("L01", "tenaga",    "Pekerja",         0.05,  "jam", 22443),
        Resource("L03", "tenaga",    "Mandor",          0.005, "jam", 28486),
        Resource("E10", "peralatan", "Excavator",       0.02,  "jam", 544667),
        Resource("E09", "peralatan", "Dump Truck",      0.05,  "jam", 447500),
        Resource("ZB01","peralatan", "Alat Bantu",      1.0,   "ls",  75),
    ],
    "timbunan": [
        Resource("L01", "tenaga",    "Pekerja",         0.04,  "jam", 22443),
        Resource("L03", "tenaga",    "Mandor",          0.004, "jam", 28486),
        Resource("E04", "peralatan", "Bulldozer",       0.015, "jam", 600000),
        Resource("E19", "peralatan", "Vibrating Roller",0.012, "jam", 350000),
        Resource("E23", "peralatan", "Water Tank",      0.01,  "jam", 250000),
    ],
    "drainase": [
        Resource("L01", "tenaga",    "Pekerja",         0.5,   "jam", 22443),
        Resource("L03", "tenaga",    "Mandor",          0.05,  "jam", 28486),
        Resource("L02", "tenaga",    "Tukang",          0.2,   "jam", 25000),
    ],
    "haul": [
        Resource("L01", "tenaga",    "Pekerja",         0.005, "jam", 22443),
        Resource("L03", "tenaga",    "Mandor",          0.001, "jam", 28486),
        Resource("E09", "peralatan", "Dump Truck",      0.025, "jam", 447500),
    ],
    "pembersihan": [
        Resource("L01", "tenaga",    "Pekerja",         0.03,  "jam", 22443),
        Resource("L03", "tenaga",    "Mandor",          0.003, "jam", 28486),
        Resource("E41", "peralatan", "Chain Saw",       0.005, "jam", 85287),
    ],
    "struktur": [
        Resource("L01", "tenaga",    "Pekerja",         1.65,  "jam", 22443),
        Resource("L02", "tenaga",    "Tukang",          0.825, "jam", 25000),
        Resource("L03", "tenaga",    "Mandor",          0.083, "jam", 28486),
        Resource("M01", "bahan",     "Semen",           350.0, "kg",  1500),
        Resource("M02", "bahan",     "Pasir",           0.5,   "m3",  250000),
        Resource("M03", "bahan",     "Kerikil",         0.8,   "m3",  280000),
    ],
    "perkerasan": [
        Resource("L01", "tenaga",    "Pekerja",         0.15,  "jam", 22443),
        Resource("L03", "tenaga",    "Mandor",          0.015, "jam", 28486),
        Resource("E45", "peralatan", "Asphalt Finisher",0.01,  "jam", 850000),
        Resource("E19", "peralatan", "Vibrating Roller",0.01,  "jam", 350000),
        Resource("E09", "peralatan", "Dump Truck",      0.025, "jam", 447500),
    ],
    "finishing": [
        Resource("L01", "tenaga",    "Pekerja",         0.1,   "jam", 22443),
        Resource("L03", "tenaga",    "Mandor",          0.01,  "jam", 28486),
        Resource("L02", "tenaga",    "Tukang",          0.05,  "jam", 25000),
    ],
    "overhead": [
        Resource("L01", "tenaga",    "Pekerja",         1.0,   "ls",  22443),
    ],
    # 'lain-lain' intentionally absent — those rows get archived.
}


def psql(sql: str) -> str:
    """Run a psql -c command and return raw stdout."""
    cmd = [
        "docker", "exec", "-e", f"PGPASSWORD={PG_PASS}",
        CONTAINER, "psql", "-U", PG_USER, "-d", PG_DB,
        "-At", "-F", "\t", "-c", sql,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return proc.stdout


def psql_stdin(sql: str) -> str:
    """Pipe a multi-statement SQL blob to psql via stdin."""
    cmd = [
        "docker", "exec", "-i", "-e", f"PGPASSWORD={PG_PASS}",
        CONTAINER, "psql", "-U", PG_USER, "-d", PG_DB, "-v", "ON_ERROR_STOP=1",
    ]
    proc = subprocess.run(cmd, input=sql, capture_output=True, text=True, check=True)
    return proc.stdout


def sql_str(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def main() -> int:
    rows_raw = psql(
        "SELECT ai.id, ai.kode, COALESCE(ai.category,'') "
        "FROM ahsp_item ai "
        "WHERE ai.archived_at IS NULL "
        "AND NOT EXISTS (SELECT 1 FROM ahsp_resource ar WHERE ar.ahsp_item_id = ai.id) "
        "ORDER BY ai.category, ai.kode;"
    )
    targets: list[tuple[str, str, str]] = []
    for line in rows_raw.strip().splitlines():
        parts = line.split("\t")
        if len(parts) < 3:
            continue
        targets.append((parts[0], parts[1], parts[2]))

    if not targets:
        print("No broken AHSP found. Nothing to do.")
        return 0

    statements: list[str] = ["BEGIN;"]
    seeded = 0
    archived = 0
    lines_inserted = 0
    by_cat: dict[str, int] = {}

    for ahsp_id, kode, cat in targets:
        by_cat[cat] = by_cat.get(cat, 0) + 1

        if cat == "lain-lain" or cat not in TEMPLATES:
            statements.append(
                f"UPDATE ahsp_item SET archived_at = now(), "
                f"source_kode = COALESCE(source_kode, 'auto-archive-lain-lain') "
                f"WHERE id = {sql_str(ahsp_id)};"
            )
            archived += 1
            continue

        tmpl = TEMPLATES[cat]
        # Group by enum category, assign ordinal within each group.
        ordinal_by_cat: dict[str, int] = {}
        for r in tmpl:
            ordinal_by_cat[r.cat] = ordinal_by_cat.get(r.cat, 0) + 1
            ordinal = ordinal_by_cat[r.cat]
            statements.append(
                "INSERT INTO ahsp_resource "
                "(ahsp_item_id, category, ordinal, resource_code, uraian, koefisien, satuan, hsd, resource_master_id) "
                "SELECT "
                f"{sql_str(ahsp_id)}, {sql_str(r.cat)}::resource_category, {ordinal}, "
                f"{sql_str(r.code)}, {sql_str(r.uraian)}, {r.koef}, {sql_str(r.satuan)}, {r.hsd}, "
                f"(SELECT id FROM resource_master WHERE kode = {sql_str(r.code)} LIMIT 1);"
            )
            lines_inserted += 1

        statements.append(
            f"UPDATE ahsp_item SET source_kode = {sql_str('auto-seed-' + cat)} "
            f"WHERE id = {sql_str(ahsp_id)};"
        )
        seeded += 1

    statements.append("COMMIT;")
    sql_blob = "\n".join(statements)

    print(f"Targets: {len(targets)}  (by category: {json.dumps(by_cat, sort_keys=True)})")
    print(f"Will seed {seeded} AHSP with {lines_inserted} resource lines, archive {archived} lain-lain.")

    psql_stdin(sql_blob)

    print("Done.")
    print(json.dumps({
        "ahsp_seeded": seeded,
        "lines_inserted": lines_inserted,
        "ahsp_archived": archived,
    }, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
