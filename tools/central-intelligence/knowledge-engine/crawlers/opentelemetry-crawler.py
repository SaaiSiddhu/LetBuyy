"""
opentelemetry-crawler.py — LCIS Knowledge Engine: OpenTelemetry documentation.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from base_crawler import BaseCrawler

URLS = [
    "https://opentelemetry.io/docs/what-is-opentelemetry/",
    "https://opentelemetry.io/docs/languages/js/",
    "https://opentelemetry.io/docs/languages/js/instrumentation/",
    "https://opentelemetry.io/docs/concepts/signals/traces/",
    "https://opentelemetry.io/docs/concepts/signals/metrics/",
    "https://opentelemetry.io/docs/collector/",
]

if __name__ == "__main__":
    BaseCrawler("opentelemetry", URLS, 80, "knowledge").run()
