"""
supabase-crawler.py — LCIS Knowledge Engine: Supabase documentation.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from base_crawler import BaseCrawler

URLS = [
    "https://supabase.com/docs/guides/database/overview",
    "https://supabase.com/docs/guides/auth/row-level-security",
    "https://supabase.com/docs/guides/database/postgres/triggers",
    "https://supabase.com/docs/guides/database/functions",
    "https://supabase.com/docs/guides/auth",
    "https://supabase.com/docs/guides/auth/managing-user-data",
    "https://supabase.com/docs/reference/javascript/introduction",
    "https://supabase.com/docs/guides/realtime",
]

if __name__ == "__main__":
    BaseCrawler("supabase", URLS, 200, "knowledge").run()
