#!/usr/bin/env python3
"""Compare a deployed Nimbus site with the reviewed local static build.

Run after deployment from the repository root:
  rtk proxy python3 verification/nimbus-http-qa.py \
    --origin https://easytier.icebreaker.top \
    --report verification/nimbus-remote-http.json

Only public HTTPS resources are requested. TLS validation stays enabled, system
DNS is used without overrides, no credentials are read, and at most four requests
run concurrently. Browser rendering and interactive behavior are separate checks.
"""

import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
from html.parser import HTMLParser
import io
import json
from pathlib import Path
import re
import ssl
import sys
from urllib.error import HTTPError
from urllib.parse import unquote, urljoin, urlsplit
from urllib.request import build_opener, HTTPRedirectHandler, HTTPSHandler, ProxyHandler, Request
import zipfile


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "apps/docs/dist"
TIMEOUT = 15
CONCURRENCY = 4
MAX_BODY = 8 * 1024 * 1024


def digest(body):
    return hashlib.sha256(body).hexdigest()


def clean_text(parts):
    return " ".join("".join(parts).split())


class Page(HTMLParser):
    """Read public structure without executing HTML or JavaScript."""

    def __init__(self, body):
        super().__init__(convert_charrefs=True)
        self.title = []
        self.h1 = []
        self.ids = []
        self.links = []
        self.pagination = {}
        self.canonical = None
        self.lang = None
        self.diagrams = 0
        self._capture = None
        self._text = []
        self.feed(body.decode("utf-8"))
        self.close()

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if attrs.get("id"):
            self.ids.append(attrs["id"])
        if "data-mermaid" in attrs:
            self.diagrams += 1
        if tag == "html":
            self.lang = attrs.get("lang")
        if tag == "link" and "canonical" in attrs.get("rel", "").split():
            self.canonical = attrs.get("href")
        if tag in ("title", "h1"):
            self._capture, self._text = tag, []
        if tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])
            for relation in attrs.get("rel", "").split():
                if relation in ("prev", "next"):
                    self.pagination[relation] = attrs["href"]
        if tag == "img" and attrs.get("src"):
            self.links.append(attrs["src"])

    def handle_endtag(self, tag):
        if tag == self._capture:
            getattr(self, tag).append(clean_text(self._text))
            self._capture, self._text = None, []

    def handle_data(self, text):
        if self._capture:
            self._text.append(text)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        return None


@dataclass
class Response:
    status: int
    headers: dict
    body: bytes
    error: str = ""

    def public(self, path):
        record = {"path": path, "status": self.status,
                  "content_type": self.headers.get("content-type", ""),
                  "nosniff": self.headers.get("x-content-type-options", "").lower() == "nosniff"}
        if self.error:
            record["error_type"] = self.error
        return record


def fetch(origin, path):
    # A private opener for each request avoids shared mutable handler state.
    opener = build_opener(ProxyHandler({}), HTTPSHandler(context=ssl.create_default_context()), NoRedirect())
    request = Request(origin + path, headers={"User-Agent": "EasyTier-Nimbus-HTTP-QA/1",
                                             "Accept-Encoding": "identity"})
    try:
        try:
            handle = opener.open(request, timeout=TIMEOUT)
        except HTTPError as error:
            handle = error  # 404 and redirect responses still provide evidence.
        with handle:
            body = handle.read(MAX_BODY + 1)
            if len(body) > MAX_BODY:
                return Response(handle.code, {}, b"", "ResponseTooLarge")
            return Response(handle.code, {key.lower(): value for key, value in handle.headers.items()}, body)
    except Exception as error:
        # Raw networking exceptions can contain local proxy or machine details.
        return Response(0, {}, b"", type(error).__name__)


def local_file(path):
    target = (DIST / unquote(path).lstrip("/")).resolve()
    if not target.is_relative_to(DIST.resolve()):
        raise AssertionError("A public path escapes the static output directory.")
    return target


def html_file(route):
    return DIST / ("index.html" if route == "/" else route.lstrip("/") + ".html")


def markdown_links(body, origin):
    return [urljoin(origin + "/", match) for match in re.findall(r"\]\(([^)]+)\)", body.decode("utf-8"))]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--origin", required=True, help="Deployed HTTPS origin, without a path or credentials.")
    parser.add_argument("--report", required=True, type=Path, help="Destination JSON verification record.")
    args = parser.parse_args()
    parsed = urlsplit(args.origin)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.path not in ("", "/") or parsed.query or parsed.fragment:
        parser.error("--origin must be an HTTPS origin without credentials, a path, query or fragment")
    origin = args.origin.rstrip("/")
    report = {"started_at": datetime.now(timezone.utc).isoformat(), "origin": origin,
              "tls_verification": True, "dns_override": False, "proxy_bypassed": True,
              "timeout_seconds": TIMEOUT, "max_concurrency": CONCURRENCY, "ok": False,
              "errors": []}
    errors = report["errors"]

    def require(condition, message):
        if not condition:
            errors.append(message)

    try:
        manifest_bytes = (DIST / "course-manifest.json").read_bytes()
        manifest = json.loads(manifest_bytes)
        routes = [page["route"] for page in manifest["pages"]]
        require(len(routes) == 32 and len(set(routes)) == 32, "Local manifest must contain exactly 32 unique pages.")
        anchors = json.loads((ROOT / "apps/docs/public/course-anchors.json").read_text("utf-8"))
        require(sum(len(anchors.get(route, [])) for route in routes) == 371, "Historical anchor baseline must contain 371 anchors.")
        local = {route: Page(html_file(route).read_bytes()) for route in routes}
        source_origin = urlsplit(local["/"].canonical or origin)
        accepted_hosts = {urlsplit(origin).netloc, source_origin.netloc}

        def internal(href, route="/"):
            target = urlsplit(urljoin(origin + route, href))
            if target.scheme not in ("http", "https") or target.netloc not in accepted_hosts:
                return None
            return target.path or "/", unquote(target.fragment)

        endpoints = {}
        for route in routes:
            stem = "" if route == "/" else route.rstrip("/")
            for extension, media_type in (("md", "text/markdown"), ("mdx", "text/plain")):
                endpoints[f"{stem}/index.{extension}"] = media_type
        llms_paths = sorted("/" + str(path.relative_to(DIST)) for path in DIST.rglob("llms.txt"))
        for path in [*llms_paths, "/llms-full.txt", "/robots.txt"]:
            endpoints[path] = "text/plain"
        for path in ["/course-manifest.json", "/pagefind/pagefind-entry.json", "/search/chinese-index.json"]:
            endpoints[path] = "application/json"
        metadata = json.loads((DIST / "pagefind/pagefind-entry.json").read_bytes())
        pagefind_paths = {"/pagefind/pagefind.js", "/pagefind/pagefind-worker.js", "/pagefind/wasm.unknown.pagefind"}
        pagefind_paths.update(f"/pagefind/pagefind.{language['hash']}.pf_meta" for language in metadata["languages"].values())
        linked_paths = set()
        for route, page in local.items():
            for href in page.links:
                target = internal(href, route)
                if target and target[0] not in routes:
                    linked_paths.add(target[0])
        redirect_targets = {variant: route for route in routes if route != "/" for variant in (route + "/", route + ".html")}
        missing_paths = ["/missing-nimbus-qa-page", "/_headers"]
        zip_path = "/downloads/network-basics-demo.zip"
        paths = set(routes) | set(endpoints) | set(llms_paths) | pagefind_paths | linked_paths | set(redirect_targets) | set(missing_paths) | {zip_path, "/sitemap-index.xml", "/sitemap-0.xml"}
        with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
            responses = dict(zip(sorted(paths), pool.map(lambda path: fetch(origin, path), sorted(paths))))
        report["request_count"] = len(responses)

        remote = {}
        report["pages"] = []
        for route in routes:
            result = responses[route]
            expected = local[route]
            record = result.public(route)
            try:
                actual = Page(result.body)
                remote[route] = actual
                record.update({"title": actual.title, "h1": actual.h1,
                               "old_anchors_checked": len(anchors[route]), "diagrams": actual.diagrams})
                record["matches_local_structure"] = (
                    actual.title == expected.title and actual.h1 == expected.h1 and len(actual.h1) == 1
                    and actual.lang == "zh-CN" and actual.canonical == expected.canonical
                    and Counter(actual.links) == Counter(expected.links)
                    and actual.pagination == expected.pagination and actual.diagrams == expected.diagrams
                    and all(anchor in actual.ids for anchor in anchors[route])
                    and len(actual.ids) == len(set(actual.ids)))
            except Exception as error:
                record["parse_error_type"] = type(error).__name__
                record["matches_local_structure"] = False
            record["ok"] = result.status == 200 and record["nosniff"] and result.headers.get("content-type", "").split(";", 1)[0].strip() == "text/html" and record["matches_local_structure"]
            require(record["ok"], f"{route}: HTTP, title/H1, legacy anchors, navigation, links or diagram structure differs.")
            report["pages"].append(record)
        report["page_count"] = len(routes)
        report["old_anchors_checked"] = sum(len(anchors[route]) for route in routes)
        report["diagram_count"] = sum(page.diagrams for page in remote.values())
        require(report["diagram_count"] == 28, "Remote pages must retain 28 Mermaid source diagrams.")

        checked_links = 0
        for route, page in remote.items():
            for href in page.links:
                target = internal(href, route)
                if not target:
                    continue
                checked_links += 1
                path, anchor = target
                require(path in responses and responses[path].status == 200, f"{route}: internal link target unavailable: {path}")
                if anchor:
                    require(path in remote and anchor in remote[path].ids, f"{route}: linked fragment missing on {path}: #{anchor}")
        report["internal_links_checked"] = checked_links

        report["source_endpoints"] = []
        for path, media_type in sorted(endpoints.items()):
            result = responses[path]
            record = result.public(path)
            record["matches_local_bytes"] = result.body == local_file(path).read_bytes()
            record["sha256"] = digest(result.body)
            record["ok"] = result.status == 200 and record["nosniff"] and record["matches_local_bytes"] and result.headers.get("content-type", "").split(";", 1)[0].strip() == media_type
            require(record["ok"], f"{path}: public source bytes, HTTP status, MIME or nosniff mismatch.")
            report["source_endpoints"].append(record)
        report["markdown_count"] = sum(path.endswith(".md") for path in endpoints)
        report["mdx_count"] = sum(path.endswith(".mdx") for path in endpoints)

        reached, visited, queue = set(), set(), ["/llms.txt"]
        while queue:
            path = queue.pop()
            if path in visited:
                continue
            visited.add(path)
            for href in markdown_links(responses[path].body, origin):
                target = internal(href)
                if not target:
                    continue
                linked, _ = target
                if linked.endswith("/llms.txt"):
                    require(linked in responses, "LLM section index missing: " + linked)
                    if linked in responses:
                        queue.append(linked)
                elif linked.endswith("/index.md"):
                    reached.add(linked.removesuffix("/index.md") or "/")
        report["llms_tree"] = {"section_indexes": sorted(visited), "page_count": len(reached), "covers_manifest": reached == set(routes)}
        require(reached == set(routes), "Remote LLM section tree does not cover exactly the 32 courses/pages.")

        report["not_found"] = []
        for path in missing_paths:
            record = responses[path].public(path)
            record["ok"] = responses[path].status == 404 and record["nosniff"]
            require(record["ok"], path + ": must return a real HTTP 404.")
            report["not_found"].append(record)
        report["clean_url_redirects"] = []
        for path, target in sorted(redirect_targets.items()):
            result = responses[path]
            location = urljoin(origin + path, result.headers.get("location", ""))
            record = {"path": path, "status": result.status, "location": location,
                      "target_status": responses[target].status,
                      "ok": result.status in (301, 302, 307, 308) and location == origin + target and responses[target].status == 200}
            require(record["ok"], path + ": must redirect to the corresponding URL without a trailing slash or .html.")
            report["clean_url_redirects"].append(record)

        sitemap = responses["/sitemap-0.xml"]
        sitemap_paths = {urlsplit(url).path.rstrip("/") or "/" for url in re.findall(r"<loc>([^<]+)</loc>", sitemap.body.decode("utf-8"))}
        report["sitemap"] = {"status": sitemap.status, "page_count": len(sitemap_paths), "covers_manifest": sitemap_paths == set(routes)}
        require(sitemap.status == 200 and sitemap_paths == set(routes), "Remote sitemap does not cover exactly the 32 pages.")
        require(responses["/sitemap-index.xml"].status == 200, "Remote sitemap index is unavailable.")

        result = responses[zip_path]
        expected_zip = (ROOT / "apps/docs/public/downloads/network-basics-demo.zip").read_bytes()
        zip_record = result.public(zip_path)
        zip_record.update({"sha256": digest(result.body), "source_sha256": digest(expected_zip), "matches_local_archive": result.body == expected_zip})
        names = ["README.txt", "index.html", "message.txt"]
        with zipfile.ZipFile(io.BytesIO(result.body)) as archive:
            expected_names = ["network-basics-demo/" + name for name in names]
            zip_record["files"] = sorted(archive.namelist())
            zip_record["matches_example_sources"] = sorted(archive.namelist()) == sorted(expected_names) and all(archive.read("network-basics-demo/" + name) == (ROOT / "examples/network-basics-demo" / name).read_bytes() for name in names)
        zip_record["ok"] = result.status == 200 and zip_record["nosniff"] and zip_record["matches_local_archive"] and zip_record["matches_example_sources"] and result.headers.get("content-type", "").split(";", 1)[0].strip() == "application/zip"
        report["zip"] = zip_record
        require(zip_record["ok"], "Download ZIP must match the reviewed archive and all three public example source files.")

        remote_metadata = json.loads(responses["/pagefind/pagefind-entry.json"].body)
        remote_supplement = json.loads(responses["/search/chinese-index.json"].body)
        report["search_resources"] = {"pagefind_version": remote_metadata.get("version"),
                                      "languages": remote_metadata.get("languages"),
                                      "supplement_pages": len(remote_supplement.get("pages", [])), "resources": []}
        require(remote_metadata.get("version") == "1.5.2" and any(key.startswith("zh") and value.get("page_count") == 32 for key, value in remote_metadata.get("languages", {}).items()), "Pagefind must be version 1.5.2 and index all 32 Chinese pages.")
        require(remote_supplement.get("version") == 1 and {page["url"] for page in remote_supplement.get("pages", [])} == set(routes), "Supplemental search index must cover all 32 pages.")
        for path in sorted(pagefind_paths):
            result = responses[path]
            record = result.public(path)
            record["matches_local_bytes"] = result.body == local_file(path).read_bytes()
            record["ok"] = result.status == 200 and record["nosniff"] and record["matches_local_bytes"]
            require(record["ok"], path + ": Pagefind runtime resource differs from the local build or is unavailable.")
            report["search_resources"]["resources"].append(record)
    except Exception as error:
        errors.append("Acceptance operation failed: " + type(error).__name__ + "; raw machine details omitted.")

    report["finished_at"] = datetime.now(timezone.utc).isoformat()
    report["ok"] = not errors
    serialized = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(serialized, encoding="utf-8")
    print(serialized, end="")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
