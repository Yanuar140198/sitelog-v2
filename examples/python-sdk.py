#!/usr/bin/env python3
"""
Sitelog REST API v1 — Python example.

Install:  pip install httpx
Run:      SITELOG_API_KEY=sk_live_xxx python examples/python-sdk.py
"""
import os
import sys

try:
    import httpx
except ImportError:
    print("Install httpx first: pip install httpx", file=sys.stderr)
    sys.exit(1)

API_BASE = os.environ.get("SITELOG_API_BASE", "https://api.sitelog.app/api/v1")
API_KEY = os.environ.get("SITELOG_API_KEY")
if not API_KEY:
    print("Set SITELOG_API_KEY env var (generate at /app/settings/api-keys)", file=sys.stderr)
    sys.exit(1)


class SitelogClient:
    """Thin client over Sitelog REST v1."""

    def __init__(self, api_key: str, base_url: str = API_BASE) -> None:
        self.http = httpx.Client(
            base_url=base_url,
            headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"},
            timeout=30.0,
        )

    def me(self) -> dict:
        return self.http.get("/me").raise_for_status().json()["data"]

    def list_projects(self) -> list[dict]:
        return self.http.get("/projects").raise_for_status().json()["data"]

    def get_project(self, project_id: str) -> dict:
        return self.http.get(f"/projects/{project_id}").raise_for_status().json()["data"]

    def project_entries(self, project_id: str) -> list[dict]:
        return self.http.get(f"/projects/{project_id}/entries").raise_for_status().json()["data"]

    def get_entry(self, entry_id: str) -> dict:
        return self.http.get(f"/entries/{entry_id}").raise_for_status().json()["data"]

    def ahsp_catalog(self) -> list[dict]:
        return self.http.get("/ahsp").raise_for_status().json()["data"]


def fmt_idr(n: int) -> str:
    return f"Rp {n:,}".replace(",", ".")


def main() -> None:
    client = SitelogClient(API_KEY)

    me = client.me()
    print(f"Authenticated: org={me['orgId']} scope={me['scope']}")
    print()

    projects = client.list_projects()
    print(f"Projects ({len(projects)}):")
    for p in projects:
        print(f"  {p['code']:12} {p['name'][:40]:40} status={p['status']}")
    print()

    if projects:
        first = projects[0]
        detail = client.get_project(first["id"])
        print(f"Detail for {first['code']}:")
        t = detail["totals"]
        print(f"  Subtotal:    {fmt_idr(t['subtotal'])}")
        print(f"  + Markup:    {fmt_idr(t['markup'])}")
        print(f"  + Conting:   {fmt_idr(t['contingency'])}")
        print(f"  + PPN:       {fmt_idr(t['ppn'])}")
        print(f"  GRAND TOTAL: {fmt_idr(t['grandTotal'])}")
        print()

        entries = client.project_entries(first["id"])
        print(f"Recent entries: {len(entries)}")
        for e in entries[:5]:
            print(f"  {e['entryDate']} shift={e['shift']} hours={e['effectiveHours']} workforce={e['workforce']}")
        print()

    catalog = client.ahsp_catalog()
    print(f"AHSP catalog: {len(catalog)} items")
    for item in catalog[:3]:
        print(f"  {item['kode']:12} {item['jenis'][:50]:50} satuan={item['satuan']}")


if __name__ == "__main__":
    main()
