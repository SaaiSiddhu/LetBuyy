"""
cloudflare-crawler.py — LCIS Knowledge Engine: Cloudflare developer documentation.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from base_crawler import BaseCrawler

URLS = [
    "https://developers.cloudflare.com/workers/",
    "https://developers.cloudflare.com/workers/runtime-apis/",
    "https://developers.cloudflare.com/workers/runtime-apis/bindings/",
    "https://developers.cloudflare.com/queues/",
    "https://developers.cloudflare.com/queues/configuration/",
    "https://developers.cloudflare.com/kv/",
    "https://developers.cloudflare.com/kv/api/",
    "https://developers.cloudflare.com/r2/",
    "https://developers.cloudflare.com/hyperdrive/",
    "https://developers.cloudflare.com/analytics/analytics-engine/",
]

if __name__ == "__main__":
    BaseCrawler("cloudflare", URLS, 200, "knowledge").run()
