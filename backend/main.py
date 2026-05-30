import json
import os
import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urljoin, urlparse

from anthropic import Anthropic
from bs4 import BeautifulSoup, NavigableString, Tag
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from playwright.async_api import async_playwright
from pydantic import BaseModel, field_validator

app = FastAPI(title="Rankforge SEO Page Auditor")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CLAUDE_MODEL = "claude-sonnet-4-20250514"
CRAWL_TIMEOUT_MS = 45_000


class AuditRequest(BaseModel):
    url: str

    @field_validator("url")
    @classmethod
    def validate_http_url(cls, v: str) -> str:
        v = v.strip()
        parsed = urlparse(v)
        if parsed.scheme not in ("http", "https"):
            raise ValueError("URL must use http or https")
        if not parsed.netloc:
            raise ValueError("URL must include a valid hostname")
        return v


class AuditIssue(BaseModel):
    severity: str
    check: str
    message: str
    fix: str


def _normalize_domain(netloc: str) -> str:
    host = netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def _is_internal_link(href: str, page_url: str, page_domain: str) -> bool | None:
    if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
        return None
    parsed = urlparse(urljoin(page_url, href))
    if parsed.scheme not in ("http", "https", ""):
        return None
    if not parsed.netloc:
        return True
    return _normalize_domain(parsed.netloc) == page_domain


def _visible_text_word_count(soup: BeautifulSoup) -> int:
    for tag in soup.find_all(["script", "style", "noscript"]):
        tag.decompose()
    for selector in ["nav", "footer", "header[role='banner']"]:
        for tag in soup.select(selector):
            tag.decompose()

    text = soup.get_text(separator=" ", strip=True)
    words = re.findall(r"\b[\w'-]+\b", text, flags=re.UNICODE)
    return len(words)


def _extract_headings(soup: BeautifulSoup) -> list[dict[str, str]]:
    headings: list[dict[str, str]] = []
    for tag in soup.find_all(re.compile(r"^h[1-6]$", re.I)):
        if not isinstance(tag, Tag) or not tag.name:
            continue
        text = tag.get_text(separator=" ", strip=True)
        if text:
            headings.append({"level": tag.name.lower(), "text": text})
    return headings


def _heading_levels_in_order(soup: BeautifulSoup) -> list[int]:
    levels: list[int] = []
    for tag in soup.find_all(re.compile(r"^h[1-6]$", re.I)):
        if isinstance(tag, Tag) and tag.name:
            levels.append(int(tag.name[1]))
    return levels


def _logical_hierarchy_ok(levels: list[int]) -> bool:
    if not levels:
        return True
    prev = 0
    for level in levels:
        if level > prev + 1 and prev != 0:
            return False
        prev = max(prev, level)
    return True


def _count_links(soup: BeautifulSoup, page_url: str, page_domain: str) -> dict[str, int]:
    internal = 0
    external = 0
    seen: set[str] = set()
    for anchor in soup.find_all("a", href=True):
        href = anchor["href"].strip()
        key = urljoin(page_url, href)
        if key in seen:
            continue
        classification = _is_internal_link(href, page_url, page_domain)
        if classification is None:
            continue
        seen.add(key)
        if classification:
            internal += 1
        else:
            external += 1
    return {"internal": internal, "external": external}


def _count_images(soup: BeautifulSoup) -> dict[str, int]:
    images = soup.find_all("img")
    total = len(images)
    with_alt = sum(1 for img in images if img.get("alt", "").strip())
    return {"total": total, "with_alt": with_alt, "missing_alt": total - with_alt}


def _score_and_issues(data: dict[str, Any]) -> tuple[int, list[dict[str, str]]]:
    score = 0
    issues: list[dict[str, str]] = []

    title = data["meta"]["title"]
    title_len = data["meta"]["title_length"]
    desc = data["meta"]["description"]
    desc_len = data["meta"]["description_length"]
    headings = data["headings"]
    h1_count = sum(1 for h in headings if h["level"] == "h1")
    h2_count = sum(1 for h in headings if h["level"] == "h2")
    h3_count = sum(1 for h in headings if h["level"] == "h3")
    word_count = data["word_count"]
    images = data["images"]
    links = data["links"]
    hierarchy_ok = data["heading_hierarchy_ok"]

    def add_issue(
        severity: str,
        check: str,
        message: str,
        fix: str,
        points: int,
        passed: bool,
    ) -> None:
        nonlocal score
        if passed:
            score += points
        else:
            issues.append(
                {"severity": severity, "check": check, "message": message, "fix": fix}
            )

    add_issue(
        "critical",
        "title_exists",
        "Page is missing a <title> tag",
        "Add a unique, descriptive <title> tag in the document <head>.",
        10,
        bool(title.strip()),
    )

    title_len_ok = 50 <= title_len <= 60
    add_issue(
        "warning" if title.strip() else "info",
        "title_length",
        f"Title is {title_len} characters (recommended: 50–60)",
        "Adjust the title length to 50–60 characters for optimal SERP display.",
        5,
        title_len_ok and bool(title.strip()),
    )

    add_issue(
        "critical",
        "meta_description_exists",
        "Page is missing a meta description",
        'Add <meta name="description" content="..."> in the document <head>.',
        10,
        bool(desc.strip()),
    )

    desc_len_ok = 150 <= desc_len <= 160
    add_issue(
        "warning" if desc.strip() else "info",
        "meta_description_length",
        f"Meta description is {desc_len} characters (recommended: 150–160)",
        "Expand or trim the meta description to 150–160 characters to maximize SERP snippet visibility.",
        5,
        desc_len_ok and bool(desc.strip()),
    )

    exactly_one_h1 = h1_count == 1
    add_issue(
        "critical",
        "exactly_one_h1",
        f"Page has {h1_count} H1 tag(s) (recommended: exactly 1)",
        "Use exactly one H1 per page that clearly describes the main topic.",
        10,
        exactly_one_h1,
    )

    add_issue(
        "warning",
        "heading_hierarchy",
        "Heading levels skip a rank (e.g. H1 → H3 without H2)",
        "Use a logical heading order without skipping levels (H1 → H2 → H3).",
        10,
        hierarchy_ok,
    )

    add_issue(
        "warning",
        "word_count",
        f"Page has {word_count} words (recommended: at least 300)",
        "Add more substantive content to reach at least 300 visible words.",
        10,
        word_count >= 300,
    )

    all_alt = images["total"] == 0 or images["missing_alt"] == 0
    add_issue(
        "warning",
        "images_alt",
        f"{images['missing_alt']} of {images['total']} images are missing alt text",
        "Add descriptive alt text to all images for accessibility and image search ranking.",
        10,
        all_alt,
    )

    add_issue(
        "info",
        "internal_links",
        "No internal links found on the page",
        "Add internal links to related content to improve site navigation and crawlability.",
        10,
        links["internal"] >= 1,
    )

    add_issue(
        "info",
        "external_links",
        "No external links found on the page",
        "Consider linking to authoritative external sources where relevant.",
        5,
        links["external"] >= 1,
    )

    depth_ok = h2_count >= 2 and h3_count >= 1
    add_issue(
        "warning",
        "heading_depth",
        f"Page has {h2_count} H2(s) and {h3_count} H3(s) (recommended: at least 2 H2s and 1 H3)",
        "Add more H2 and H3 subheadings to structure content for readers and search engines.",
        15,
        depth_ok,
    )

    return min(score, 100), issues


async def _crawl_page(url: str) -> str:
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            try:
                page = await browser.new_page()
                response = await page.goto(
                    url,
                    wait_until="domcontentloaded",
                    timeout=CRAWL_TIMEOUT_MS,
                )
                await page.wait_for_timeout(1500)
                if response is None:
                    raise HTTPException(
                        status_code=422,
                        detail="Page failed to load: no response received",
                    )
                if response.status >= 400:
                    raise HTTPException(
                        status_code=422,
                        detail=f"Page failed to load: HTTP {response.status}",
                    )
                html = await page.content()
                return html
            finally:
                await browser.close()
    except HTTPException:
        raise
    except Exception as exc:
        message = str(exc)
        if "Timeout" in message or "timeout" in message:
            raise HTTPException(
                status_code=422,
                detail="Page failed to load: request timed out",
            ) from exc
        if "net::ERR" in message or "SSL" in message:
            raise HTTPException(
                status_code=422,
                detail=f"Page failed to load: {message}",
            ) from exc
        raise HTTPException(
            status_code=422,
            detail=f"Page failed to load: {message}",
        ) from exc


def _parse_html(html: str, page_url: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "html.parser")
    parsed_url = urlparse(page_url)
    page_domain = _normalize_domain(parsed_url.netloc)

    title_tag = soup.find("title")
    title = title_tag.get_text(strip=True) if title_tag else ""

    desc_tag = soup.find("meta", attrs={"name": re.compile(r"^description$", re.I)})
    description = ""
    if desc_tag and desc_tag.get("content"):
        description = desc_tag["content"].strip()

    headings = _extract_headings(soup)
    hierarchy_levels = _heading_levels_in_order(soup)
    hierarchy_ok = _logical_hierarchy_ok(hierarchy_levels)

    word_soup = BeautifulSoup(html, "html.parser")
    word_count = _visible_text_word_count(word_soup)
    links = _count_links(soup, page_url, page_domain)
    images = _count_images(soup)

    return {
        "meta": {
            "title": title,
            "title_length": len(title),
            "description": description,
            "description_length": len(description),
        },
        "headings": headings,
        "word_count": word_count,
        "links": links,
        "images": images,
        "heading_hierarchy_ok": hierarchy_ok,
    }


async def _claude_summary(audit_payload: dict[str, Any]) -> dict[str, Any] | str:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return (
            "AI summary unavailable: set ANTHROPIC_API_KEY in the backend environment. "
            f"SEO score is {audit_payload['seo_score']}/100 based on automated checks."
        )

    client = Anthropic(api_key=api_key)
    prompt = f"""You are an SEO expert analyzing a page audit. Based on this audit data, provide:
1. A 2-3 sentence summary of the page's SEO health
2. Any additional issues or recommendations beyond the rubric checks already listed

Respond with ONLY a JSON object in this exact format:
{{"ai_summary": "your 2-3 sentence summary here", "additional_issues": []}}

Each item in additional_issues (if any) should have: severity ("critical"|"warning"|"info"), check (snake_case id), message, fix.

Audit data:
{json.dumps({k: v for k, v in audit_payload.items() if k != "issues"}, indent=2)}

Existing rubric issues (do not duplicate these):
{json.dumps(audit_payload.get("issues", []), indent=2)}
"""

    try:
        message = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        text = message.content[0].text if message.content else ""
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            parsed = json.loads(text[start:end])
            return parsed
        return {"ai_summary": text.strip() or "Analysis complete.", "additional_issues": []}
    except Exception:
        return {
            "ai_summary": (
                f"This page scored {audit_payload['seo_score']}/100. "
                "Review the issues below for prioritized improvements."
            ),
            "additional_issues": [],
        }


@app.post("/api/audit")
async def audit_page(body: AuditRequest):
    url = body.url
    html = await _crawl_page(url)
    parsed = _parse_html(html, url)
    seo_score, issues = _score_and_issues(parsed)

    audit_for_ai = {
        "url": url,
        "meta": parsed["meta"],
        "headings": parsed["headings"],
        "word_count": parsed["word_count"],
        "links": parsed["links"],
        "images": parsed["images"],
        "seo_score": seo_score,
        "issues": issues,
    }

    ai_result = await _claude_summary(audit_for_ai)
    if isinstance(ai_result, dict):
        ai_summary = ai_result.get("ai_summary", "")
        extra = ai_result.get("additional_issues", [])
        existing_checks = {i["check"] for i in issues}
        for item in extra:
            if isinstance(item, dict) and item.get("check") not in existing_checks:
                issues.append(
                    {
                        "severity": item.get("severity", "info"),
                        "check": item.get("check", "ai_recommendation"),
                        "message": item.get("message", ""),
                        "fix": item.get("fix", ""),
                    }
                )
    else:
        ai_summary = str(ai_result)

    severity_order = {"critical": 0, "warning": 1, "info": 2}
    issues.sort(key=lambda i: severity_order.get(i["severity"], 3))

    return {
        "url": url,
        "crawled_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "meta": parsed["meta"],
        "headings": parsed["headings"],
        "word_count": parsed["word_count"],
        "links": parsed["links"],
        "images": parsed["images"],
        "seo_score": seo_score,
        "issues": issues,
        "ai_summary": ai_summary,
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
