"""
Fix AHSP item jenis values.

Two problems addressed:
  1. 26 AHSP items have jenis = '-' (xlsx CALCULATION block header col C was empty / "[EI-]  Item: -").
  2. Many AHSP items have jenis set to a bare Bina Marga item-number like "3.1 (3)" instead of
     the proper specification name ("Galian Batu").

Strategy:
  - Build a (kode -> item_no, jenis_now) map from postgres.
  - For each row, look up its item-number in `bina-marga-jenis.json` and replace jenis with the
    proper name.
  - For rows where item-number is '-' (genuinely unknown from xlsx source), we also re-parse the
    xlsx CALCULATION sheet to recover the [EI-xxx] / Item: tokens if present, and apply lookups
    when found. Otherwise leave a fallback label like "(AHSP-N — kategori tak terklasifikasi)".

Execution mode:
  - Prefers psycopg / psycopg2 for direct DB writes. If neither is importable, emits SQL to
    scripts/fix-jenis.sql instead. Apply manually with:
        Get-Content scripts/fix-jenis.sql | docker exec -i sitelog-pg psql -U postgres -d sitelog

Run:
    D:/FORM/.venv/Scripts/python.exe D:/sitelog-v2/scripts/fix-ahsp-jenis.py
"""
from __future__ import annotations

import io
import json
import re
import subprocess
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = Path(__file__).resolve().parent
LOOKUP_JSON = ROOT / 'bina-marga-jenis.json'
OUT_SQL = ROOT / 'fix-jenis.sql'
XLSX_PATH = Path('D:/FORM/AHSP_NEW_4.xlsx')

DB_DSN = 'postgresql://postgres:dev@localhost:5434/sitelog'
PG_CONTAINER = 'sitelog-pg'

ITEM_NO_BARE_RE = re.compile(r'^\d+\.\d+(?:\s*\(\d+\)[a-z]?)?$')

# ---------- xlsx re-extract: kode -> item_no recovered from source row ----------

def extract_kode_to_item_from_xlsx() -> dict[str, str]:
    """Walks AHSP_NEW_4.xlsx CALCULATION sheet, returns { 'AHSP-N' -> '3.1 (3)' } for blocks
    where col C parses as `[code] Item: X.Y (N)`. Skips blocks with `Item: -`."""
    out: dict[str, str] = {}
    try:
        import openpyxl
    except ImportError:
        print('[warn] openpyxl not available — skipping xlsx re-extract', flush=True)
        return out
    if not XLSX_PATH.exists():
        print(f'[warn] xlsx not found at {XLSX_PATH} — skipping re-extract', flush=True)
        return out

    wb = openpyxl.load_workbook(XLSX_PATH, data_only=True)
    if 'CALCULATION' not in wb.sheetnames:
        return out
    ws = wb['CALCULATION']

    ahsp_b = re.compile(r'^AHSP\s*#\s*(\d+)')
    item_re = re.compile(r'Item:\s*([0-9]+\.[0-9]+(?:\s*\([0-9]+\)[a-z]?)?)\s*$')

    for r in range(1, ws.max_row + 1):
        h = ws.cell(r, 8).value
        if not h or not str(h).startswith('Satuan'):
            continue
        b = ws.cell(r, 2).value
        c = ws.cell(r, 3).value
        if not b or not c:
            continue
        m_b = ahsp_b.match(str(b).strip())
        if not m_b:
            continue
        kode = f'AHSP-{m_b.group(1)}'
        m_item = item_re.search(str(c))
        if m_item:
            out[kode] = m_item.group(1).strip()
    return out


# ---------- DB I/O via docker psql (no psycopg required) ----------

def run_psql(sql: str, *, capture: bool = True) -> str:
    """Execute SQL inside the sitelog-pg container; returns stdout."""
    cmd = ['docker', 'exec', '-i', PG_CONTAINER, 'psql', '-U', 'postgres', '-d', 'sitelog',
           '-At', '-F', '\t', '-c', sql]
    res = subprocess.run(cmd, capture_output=capture, text=True, encoding='utf-8')
    if res.returncode != 0:
        raise RuntimeError(f'psql failed (exit {res.returncode}): {res.stderr}')
    return res.stdout


def fetch_target_rows() -> list[tuple[str, str, str, str]]:
    """Returns [(id, kode, jenis, satuan), ...] for all items where jenis is unset or stored as a
    bare item-number that needs expanding."""
    out = run_psql(
        "SELECT id, kode, COALESCE(jenis,''), COALESCE(satuan,'') FROM ahsp_item "
        "WHERE jenis IS NULL OR TRIM(jenis) IN ('','-') "
        "OR jenis ~ '^[0-9]+\\.[0-9]+(\\s*\\([0-9]+\\)[a-z]?)?$' "
        "ORDER BY kode;"
    )
    rows: list[tuple[str, str, str, str]] = []
    for ln in out.splitlines():
        parts = ln.split('\t')
        if len(parts) >= 4:
            rows.append((parts[0], parts[1], parts[2], parts[3]))
    return rows


def sql_escape(s: str) -> str:
    return s.replace("'", "''")


# ---------- main ----------

def main() -> int:
    if not LOOKUP_JSON.exists():
        print(f'[error] lookup JSON missing: {LOOKUP_JSON}', file=sys.stderr)
        return 1
    lookup: dict[str, str] = {
        k: v for k, v in json.loads(LOOKUP_JSON.read_text(encoding='utf-8')).items()
        if not k.startswith('_')
    }
    print(f'[info] loaded {len(lookup)} item-no -> jenis mappings')

    kode_to_item_xlsx = extract_kode_to_item_from_xlsx()
    print(f'[info] recovered item-no from xlsx for {len(kode_to_item_xlsx)} kodes')

    try:
        rows = fetch_target_rows()
    except Exception as e:
        print(f'[error] DB query failed: {e}', file=sys.stderr)
        return 2
    print(f'[info] {len(rows)} candidate rows needing jenis fix')

    updates: list[tuple[str, str, str, str]] = []  # (id, kode, old_jenis, new_jenis)
    unmatched: list[tuple[str, str, str]] = []     # (kode, item_no_or_dash, current_jenis)

    for (id_, kode, jenis, satuan) in rows:
        item_no: str | None = None
        if ITEM_NO_BARE_RE.match(jenis):
            item_no = jenis
        elif kode in kode_to_item_xlsx:
            item_no = kode_to_item_xlsx[kode]

        new_jenis: str | None = None
        if item_no and item_no in lookup:
            new_jenis = lookup[item_no]
        elif not item_no:
            # Genuine unknown — fall back to a labelled placeholder using satuan, so the row stops
            # rendering as a bare '-' in the UI but flags as "needs human input".
            sat_clean = satuan.strip() or '?'
            new_jenis = f'(belum terklasifikasi · {kode} · satuan {sat_clean})'

        if new_jenis and new_jenis != jenis:
            updates.append((id_, kode, jenis, new_jenis))
        else:
            unmatched.append((kode, item_no or '-', jenis))

    # Emit SQL
    sql_lines: list[str] = ['BEGIN;']
    for (id_, _kode, _old, new_jenis) in updates:
        sql_lines.append(
            f"UPDATE ahsp_item SET jenis = '{sql_escape(new_jenis)}', "
            f"updated_at = now() WHERE id = '{id_}';"
        )
    sql_lines.append('COMMIT;')
    sql_text = '\n'.join(sql_lines) + '\n'
    OUT_SQL.write_text(sql_text, encoding='utf-8')
    print(f'[info] wrote {len(updates)} UPDATE statements to {OUT_SQL}')

    # Try to apply directly via docker psql.
    print('[info] applying SQL via docker psql ...')
    proc = subprocess.run(
        ['docker', 'exec', '-i', PG_CONTAINER, 'psql', '-U', 'postgres', '-d', 'sitelog',
         '-v', 'ON_ERROR_STOP=1'],
        input=sql_text, capture_output=True, text=True, encoding='utf-8',
    )
    if proc.returncode != 0:
        print('[error] psql apply failed:', proc.stderr, file=sys.stderr)
        print('         Apply manually: Get-Content scripts/fix-jenis.sql | docker exec -i '
              f'{PG_CONTAINER} psql -U postgres -d sitelog')
        return 3
    print('[ok] applied successfully')

    # Verify
    leftover = run_psql(
        "SELECT COUNT(*)::int FROM ahsp_item "
        "WHERE jenis IS NULL OR TRIM(jenis) IN ('','-');"
    ).strip()
    print(f'\n========== SUMMARY ==========')
    print(f'updated:   {len(updates)}')
    print(f'skipped:   {len(unmatched)} (no item-no recoverable AND not a bare item-no)')
    print(f'remaining rows with jenis IN (NULL, "", "-"): {leftover}')
    if unmatched:
        print('\nUnmatched (top 20):')
        for (k, ino, j) in unmatched[:20]:
            print(f'  - kode={k}  item_no={ino}  current_jenis="{j}"')
    return 0


if __name__ == '__main__':
    sys.exit(main())
