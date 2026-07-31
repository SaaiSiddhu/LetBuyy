"""
base_crawler.py — LCIS Knowledge Engine base crawler.
Crawl4AI is a hidden implementation detail; never expose it to callers.
"""

import asyncio
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
    _CRAWL4AI_AVAILABLE = True
except ImportError:
    _CRAWL4AI_AVAILABLE = False

# Resolve output dir: four levels up from this file → project root/graphify-out/knowledge-crawls/
_THIS_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _THIS_DIR.parent.parent.parent.parent
OUTPUT_DIR = _PROJECT_ROOT / "graphify-out" / "knowledge-crawls"


def _sha256_prefix(url: str, content_prefix: str, length: int = 16) -> str:
    raw = f"{url}:{content_prefix}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:length]


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


class BaseCrawler:
    """
    Base crawler that drives Crawl4AI headless browser sessions.
    Subclasses instantiate with their source-specific parameters.
    """

    def __init__(
        self,
        source_key: str,
        urls: list[str],
        max_pages: int,
        collection: str,
    ) -> None:
        self.source_key = source_key
        self.urls = urls
        self.max_pages = max_pages
        self.collection = collection

    async def crawl(self) -> None:
        if not _CRAWL4AI_AVAILABLE:
            error_payload = {
                "status": "error",
                "source": self.source_key,
                "error": (
                    "crawl4ai is not installed. "
                    "Install it with: pip install 'crawl4ai>=0.4.0'"
                ),
                "documentsCount": 0,
                "errorsCount": 1,
            }
            print(json.dumps(error_payload), flush=True)
            sys.exit(1)

        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

        browser_config = BrowserConfig(headless=True)
        run_config = CrawlerRunConfig(
            cache_mode=CacheMode.BYPASS,
            page_timeout=30000,
        )

        documents: list[dict] = []
        errors: list[dict] = []
        crawled_at = _utcnow()

        # Honour max_pages across all urls
        urls_to_crawl = self.urls[: self.max_pages]

        async with AsyncWebCrawler(config=browser_config) as crawler:
            for url in urls_to_crawl:
                try:
                    result = await crawler.arun(url=url, config=run_config)

                    content: str = (
                        result.markdown
                        if isinstance(result.markdown, str)
                        else (result.markdown.raw_markdown if result.markdown else "")
                    )

                    if not content or len(content) < 100:
                        continue

                    doc_id = _sha256_prefix(url, content[:100])
                    documents.append(
                        {
                            "id": doc_id,
                            "url": url,
                            "content": content,
                            "source": self.source_key,
                            "collection": self.collection,
                            "timestamp": _utcnow(),
                            "contentLength": len(content),
                        }
                    )

                except Exception as exc:  # noqa: BLE001
                    errors.append({"url": url, "error": str(exc)})

        output = {
            "source": self.source_key,
            "collection": self.collection,
            "crawledAt": crawled_at,
            "documentsCount": len(documents),
            "errorsCount": len(errors),
            "documents": documents,
            "errors": errors,
        }

        output_path = OUTPUT_DIR / f"{self.source_key}-latest.json"
        output_path.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")

        status = {
            "status": "ok",
            "source": self.source_key,
            "collection": self.collection,
            "crawledAt": crawled_at,
            "documentsCount": len(documents),
            "errorsCount": len(errors),
            "outputPath": str(output_path),
        }
        print(json.dumps(status), flush=True)

    def run(self) -> None:
        asyncio.run(self.crawl())
