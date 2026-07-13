#!/usr/bin/env python3
"""Daily open-CFP radar from developers.events (stdlib only).

Fetches the public all-cfps.json feed, keeps open USA/online CFPs that match
topic keywords, and emits a markdown table and/or TSV sorted by close date.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable
from urllib.parse import urlparse

FEED_URL = "https://developers.events/all-cfps.json"

TOPIC_KEYWORDS = (
    "ai",
    "agent",
    "mcp",
    "sre",
    "platform",
    "observability",
    "devops",
    "security",
    "go",
    "golang",
    "mlops",
    "chaos",
    "prompt",
    "data",
    "kubernetes",
    "conf42",
    "llm",
    "finops",
)

US_STATES = (
    "alabama",
    "alaska",
    "arizona",
    "arkansas",
    "california",
    "colorado",
    "connecticut",
    "delaware",
    "florida",
    "georgia",
    "hawaii",
    "idaho",
    "illinois",
    "indiana",
    "iowa",
    "kansas",
    "kentucky",
    "louisiana",
    "maine",
    "maryland",
    "massachusetts",
    "michigan",
    "minnesota",
    "mississippi",
    "missouri",
    "montana",
    "nebraska",
    "nevada",
    "new hampshire",
    "new jersey",
    "new mexico",
    "new york",
    "north carolina",
    "north dakota",
    "ohio",
    "oklahoma",
    "oregon",
    "pennsylvania",
    "rhode island",
    "south carolina",
    "south dakota",
    "tennessee",
    "texas",
    "utah",
    "vermont",
    "virginia",
    "washington",
    "west virginia",
    "wisconsin",
    "wyoming",
    "district of columbia",
)

US_STATE_ABBREVS = (
    "al",
    "ak",
    "az",
    "ar",
    "ca",
    "co",
    "ct",
    "de",
    "fl",
    "ga",
    "hi",
    "id",
    "il",
    "in",
    "ia",
    "ks",
    "ky",
    "la",
    "me",
    "md",
    "ma",
    "mi",
    "mn",
    "ms",
    "mo",
    "mt",
    "ne",
    "nv",
    "nh",
    "nj",
    "nm",
    "ny",
    "nc",
    "nd",
    "oh",
    "ok",
    "or",
    "pa",
    "ri",
    "sc",
    "sd",
    "tn",
    "tx",
    "ut",
    "vt",
    "va",
    "wa",
    "wv",
    "wi",
    "wy",
    "dc",
)

US_CITIES = (
    "new york",
    "san francisco",
    "seattle",
    "austin",
    "boston",
    "chicago",
    "denver",
    "atlanta",
    "dallas",
    "houston",
    "miami",
    "portland",
    "phoenix",
    "philadelphia",
    "los angeles",
    "san diego",
    "san jose",
    "minneapolis",
    "detroit",
    "columbus",
    "cleveland",
    "pittsburgh",
    "raleigh",
    "durham",
    "nashville",
    "salt lake city",
    "kansas city",
    "tulsa",
    "bloomington",
    "troy",
)

ONLINE_RE = re.compile(r"\b(online|virtual|remote)\b", re.IGNORECASE)
USA_COUNTRY_RE = re.compile(
    r"\b(usa|u\.s\.a\.|u\.s\.|united states)\b", re.IGNORECASE
)

TOPIC_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(
        rf"\b{re.escape(keyword)}\b" if len(keyword) <= 3 else re.escape(keyword),
        re.IGNORECASE,
    )
    for keyword in TOPIC_KEYWORDS
)


@dataclass(frozen=True)
class CfpRow:
    until_date_ms: int
    close_label: str
    conference: str
    location: str
    mode: str
    closes_in_days: int
    submit_link: str


def fetch_feed(url: str = FEED_URL, timeout: int = 60) -> list[dict]:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "cfp-radar/1.0 (+https://productionnotes.dev)"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        payload = response.read().decode("utf-8")
    data = json.loads(payload)
    if not isinstance(data, list):
        raise ValueError("expected a JSON array from developers.events feed")
    return data


def is_online_location(location: str) -> bool:
    return bool(ONLINE_RE.search(location))


def is_usa_location(location: str) -> bool:
    lowered = location.lower()
    if USA_COUNTRY_RE.search(lowered):
        return True
    if re.search(r"\(\s*usa\s*\)", lowered):
        return True
    for state in US_STATES:
        if state in lowered:
            return True
    for abbrev in US_STATE_ABBREVS:
        if re.search(rf"\b{abbrev}\b", lowered):
            return True
    for city in US_CITIES:
        if city in lowered:
            return True
    return False


def derive_mode(location: str) -> str | None:
    if is_online_location(location):
        return "Online"
    if is_usa_location(location):
        return "USA"
    return None


def matches_topic(haystack: str) -> bool:
    for pattern in TOPIC_PATTERNS:
        if pattern.search(haystack):
            return True
    return False


def conference_name(entry: dict) -> str:
    conf = entry.get("conf") or {}
    name = (conf.get("name") or "").strip()
    if name:
        return name
    link = (entry.get("link") or "").strip()
    if not link:
        return "(unknown)"
    host = urlparse(link).netloc
    return host.removeprefix("www.") or link


def format_close_label(until: str | None, until_ms: int) -> str:
    if until and until.strip():
        return until.strip()
    dt = datetime.fromtimestamp(until_ms / 1000, tz=timezone.utc)
    return dt.strftime("%Y-%m-%d")


def days_until(until_ms: int, now_ms: int) -> int:
    return max(0, int((until_ms - now_ms) / (24 * 60 * 60 * 1000)))


def select_rows(
    entries: Iterable[dict],
    *,
    now_ms: int,
    days_ahead: int | None,
    mode_filter: str,
) -> list[CfpRow]:
    seen_links: set[str] = set()
    rows: list[CfpRow] = []

    for entry in entries:
        link = (entry.get("link") or "").strip()
        if not link or link in seen_links:
            continue

        until_ms = entry.get("untilDate")
        if not isinstance(until_ms, (int, float)):
            continue
        until_ms = int(until_ms)
        if until_ms <= now_ms:
            continue
        if days_ahead is not None:
            horizon_ms = now_ms + days_ahead * 24 * 60 * 60 * 1000
            if until_ms > horizon_ms:
                continue

        conf = entry.get("conf") or {}
        location = (conf.get("location") or "").strip() or "—"
        mode = derive_mode(location)
        if mode is None:
            continue
        if mode_filter == "usa" and mode != "USA":
            continue
        if mode_filter == "online" and mode != "Online":
            continue

        haystack = " ".join(
            [
                conference_name(entry),
                location,
                link,
                (conf.get("hyperlink") or ""),
            ]
        )
        if not matches_topic(haystack):
            continue

        seen_links.add(link)
        rows.append(
            CfpRow(
                until_date_ms=until_ms,
                close_label=format_close_label(entry.get("until"), until_ms),
                conference=conference_name(entry),
                location=location,
                mode=mode,
                closes_in_days=days_until(until_ms, now_ms),
                submit_link=link,
            )
        )

    rows.sort(key=lambda row: row.until_date_ms)
    return rows


def escape_md_cell(value: str) -> str:
    return value.replace("|", "\\|")


def render_markdown(rows: list[CfpRow], generated_at: datetime) -> str:
    lines = [
        "# Open CFP radar",
        "",
        f"Generated: {generated_at.strftime('%Y-%m-%d %H:%M UTC')} from `{FEED_URL}`",
        "",
        "| Close date | Conference | Location | Mode | Closes in | Submit |",
        "|------------|------------|----------|------|-----------|--------|",
    ]
    for row in rows:
        submit = f"[submit]({row.submit_link})"
        lines.append(
            "| "
            + " | ".join(
                [
                    escape_md_cell(row.close_label),
                    escape_md_cell(row.conference),
                    escape_md_cell(row.location),
                    row.mode,
                    f"{row.closes_in_days}d",
                    submit,
                ]
            )
            + " |"
        )
    if not rows:
        lines.append("| _No matching open CFPs_ | | | | | |")
    lines.append("")
    lines.append(
        "_Talk letters (A–M) and fit verdicts are manual curation — not generated by this script._"
    )
    lines.append("")
    return "\n".join(lines)


def render_tsv(rows: list[CfpRow]) -> str:
    lines = ["close_date\tconference\tlocation\tmode\tcloses_in_days\tsubmit_link"]
    for row in rows:
        lines.append(
            "\t".join(
                [
                    row.close_label,
                    row.conference.replace("\t", " "),
                    row.location.replace("\t", " "),
                    row.mode,
                    str(row.closes_in_days),
                    row.submit_link,
                ]
            )
        )
    return "\n".join(lines) + "\n"


def write_output(path: str, content: str) -> None:
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(content)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="List open USA/online CFPs from developers.events."
    )
    parser.add_argument(
        "--days-ahead",
        type=int,
        default=None,
        metavar="N",
        help="Only include CFPs closing within the next N days (default: no cap)",
    )
    parser.add_argument(
        "--mode",
        choices=("all", "usa", "online"),
        default="all",
        help="Location filter: USA in-person, online, or both (default: all)",
    )
    parser.add_argument(
        "--format",
        choices=("md", "tsv", "both"),
        default="md",
        help="Output format (default: md)",
    )
    parser.add_argument("--md-out", metavar="PATH", help="Write markdown table to PATH")
    parser.add_argument("--tsv-out", metavar="PATH", help="Write TSV to PATH")
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Do not print table to stdout (use with --md-out/--tsv-out)",
    )
    parser.add_argument(
        "--feed-url",
        default=FEED_URL,
        help=argparse.SUPPRESS,
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        entries = fetch_feed(args.feed_url)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError) as err:
        print(f"cfp-radar: fetch failed: {err}", file=sys.stderr)
        return 1

    now = datetime.now(timezone.utc)
    now_ms = int(now.timestamp() * 1000)
    rows = select_rows(
        entries,
        now_ms=now_ms,
        days_ahead=args.days_ahead,
        mode_filter=args.mode,
    )

    md = render_markdown(rows, now)
    tsv = render_tsv(rows)

    if args.format in ("md", "both"):
        if args.md_out:
            write_output(args.md_out, md)
        if not args.quiet:
            print(md)

    if args.format in ("tsv", "both"):
        if args.tsv_out:
            write_output(args.tsv_out, tsv)
        if not args.quiet and args.format in ("tsv", "both"):
            if args.format == "both":
                print()
            print(tsv, end="")

    if not args.quiet:
        print(f"Matched {len(rows)} open CFP(s).", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
