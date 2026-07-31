"""
vercel-crawler.py — LCIS Knowledge Engine: Vercel platform documentation.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from base_crawler import BaseCrawler

URLS = [
    "https://vercel.com/docs/deployments/overview",
    "https://vercel.com/docs/edge-network/overview",
    "https://vercel.com/docs/functions/serverless-functions",
    "https://vercel.com/docs/functions/edge-functions",
    "https://vercel.com/docs/storage/vercel-blob",
    "https://vercel.com/docs/environment-variables",
    "https://vercel.com/docs/deployments/build-step",
]

if __name__ == "__main__":
    BaseCrawler("vercel", URLS, 150, "knowledge").run()
