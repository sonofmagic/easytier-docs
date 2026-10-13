#!/usr/bin/env python3
"""Verify the downloadable local lab with only Python's standard library.

Run ``python3 verification/local-lab-qa.py`` from the repository root.
Every request connects directly to 127.0.0.1, bypassing proxy settings. This
checks HTTP behavior, not browser caching: disabling the browser cache and
observing the browser Network panel are separate browser acceptance checks.
Only child processes created by this script are stopped. Existing EasyTier
processes, interfaces, routes, and unrelated listeners are never changed.
"""

import datetime
import http.client
import json
import signal
import socket
import subprocess
import sys
import tempfile
import time
import zipfile
from pathlib import Path


HOST = "127.0.0.1"
REQUEST_TIMEOUT_SECONDS = 1
STARTUP_TIMEOUT_SECONDS = 5
ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "apps/website/public/downloads/network-basics-demo.zip"
EXAMPLE = ROOT / "examples/network-basics-demo"
RESULT = ROOT / "verification/local-lab-results.json"
NAMES = {"index.html", "message.txt", "README.txt"}


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def fetch(port, resource):
    """A fresh, bounded, proxy-free HTTP connection for each observation."""
    connection = http.client.HTTPConnection(
        HOST, port, timeout=REQUEST_TIMEOUT_SECONDS
    )
    try:
        connection.request("GET", resource)
        response = connection.getresponse()
        return response.status, response.read()
    finally:
        connection.close()


def pick_port():
    """Observe availability by binding locally; never remove another listener."""
    observations = []
    for candidate in (8877, 8878):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            try:
                probe.bind((HOST, candidate))
                observations.append({"port": candidate, "available": True})
                return candidate, "preferred", observations
            except OSError:
                observations.append({"port": candidate, "available": False})
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind((HOST, 0))
        return probe.getsockname()[1], "ephemeral_fallback", observations


def stop_owned(process):
    """Stop one explicitly owned child, with bounded escalation if needed."""
    if process.poll() is not None:
        return "already_exited"
    try:
        process.send_signal(signal.SIGINT)
        process.wait(timeout=3)
        return "SIGINT"
    except (OSError, ValueError, subprocess.TimeoutExpired):
        pass
    try:
        process.terminate()
        process.wait(timeout=2)
        return "terminate"
    except (OSError, subprocess.TimeoutExpired):
        pass
    process.kill()
    process.wait(timeout=2)
    return "kill"


def start_owned(port, directory, children, capture=False):
    stream = subprocess.PIPE if capture else subprocess.DEVNULL
    process = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "http.server",
            str(port),
            "--bind",
            HOST,
            "--directory",
            str(directory),
        ],
        stdin=subprocess.DEVNULL,
        stdout=stream,
        stderr=stream,
        text=True,
    )
    children.append(process)
    return process


def wait_for_server(process, port):
    deadline = time.monotonic() + STARTUP_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        require(process.poll() is None, "Owned server exited during startup.")
        try:
            status, body = fetch(port, "/?qa=startup")
            if status == 200 and "这是我电脑上的网页" in body.decode("utf-8"):
                return
        except (OSError, http.client.HTTPException):
            pass
        time.sleep(0.05)
    raise AssertionError("Owned server did not become ready within 5 seconds.")


def verify_archive(directory):
    expected = {"network-basics-demo/" + name for name in NAMES}
    with zipfile.ZipFile(ARCHIVE) as archive:
        entries = archive.infolist()
        require(len(entries) == 3, "Archive must contain exactly three files.")
        require(
            {entry.filename for entry in entries} == expected,
            "Archive has unexpected file paths.",
        )
        require(not any(entry.is_dir() for entry in entries), "Unexpected directory entry.")
        for name in NAMES:
            content = archive.read("network-basics-demo/" + name)
            require(content == (EXAMPLE / name).read_bytes(), "Archive/source mismatch: " + name)
            # Paths were validated against a fixed set before extracting.
            (directory / name).write_bytes(content)
    return {"files": sorted(NAMES), "file_count": 3, "matches_examples": True}


def main():
    children = []
    temporary_path = None
    temporary = None
    report = {
        "started_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "ok": False,
        "scope": "dedicated loopback HTTP lab; existing EasyTier unchanged",
        "host": HOST,
        "browser_cache_tested": False,
        "request_timeout_seconds": REQUEST_TIMEOUT_SECONDS,
        "startup_timeout_seconds": STARTUP_TIMEOUT_SECONDS,
        "checks": {},
        "cleanup": {"post_stop_http_connection_failed": False},
    }
    try:
        temporary = tempfile.TemporaryDirectory(prefix="easytier-local-lab-")
        temporary_path = Path(temporary.name)
        directory = temporary_path / "network-basics-demo"
        directory.mkdir()
        report["archive"] = verify_archive(directory)

        # A different process could claim a selected port between probe and
        # startup. A failed owned startup is cleaned, then a new port is tried.
        for attempt in range(3):
            port, strategy, probes = pick_port()
            report["port"] = port
            report["port_selection"] = strategy
            report.setdefault("port_probes", []).extend(probes)
            server = start_owned(port, directory, children)
            try:
                wait_for_server(server, port)
                break
            except AssertionError:
                stop_owned(server)
                if attempt == 2:
                    raise

        status, body = fetch(port, "/?qa=homepage")
        require(status == 200, "Homepage did not return HTTP 200.")
        require("这是我电脑上的网页" in body.decode("utf-8"), "Homepage text missing.")
        report["checks"]["homepage"] = {"status": status, "expected_text_found": True}

        status, body = fetch(port, "/message.txt?qa=message")
        require(status == 200, "message.txt did not return HTTP 200.")
        require(body == (EXAMPLE / "message.txt").read_bytes(), "message.txt content mismatch.")
        report["checks"]["message"] = {"status": status, "content_matches": True}

        status, _ = fetch(port, "/not-here.txt?qa=missing")
        require(status == 404, "Missing file did not return HTTP 404.")
        report["checks"]["missing"] = {"status": status}

        duplicate = start_owned(port, directory, children, capture=True)
        _, error_output = duplicate.communicate(timeout=STARTUP_TIMEOUT_SECONDS)
        require(duplicate.returncode != 0, "Duplicate server unexpectedly started.")
        require(
            "Address already in use" in error_output
            or "WinError 10048" in error_output,
            "Duplicate startup failed for an unexpected reason.",
        )
        report["checks"]["occupied_port"] = {
            "second_start_failed": True,
            "exit_code": duplicate.returncode,
            "reason": "address_in_use",
        }

        require(server.poll() is None, "First server exited after duplicate attempt.")
        status, _ = fetch(port, "/?qa=after-duplicate")
        require(status == 200, "First server stopped serving after duplicate attempt.")
        report["checks"]["first_server_after_duplicate"] = {"status": status}

        report["cleanup"]["server_stop_method"] = stop_owned(server)
        require(server.poll() is not None, "Owned server did not exit.")
        try:
            fetch(port, "/message.txt?qa=after-stop")
        except (OSError, http.client.HTTPException):
            report["cleanup"]["post_stop_http_connection_failed"] = True
        else:
            raise AssertionError("HTTP still answered after stopping the owned server.")
        report["ok"] = True
    except Exception as error:
        # Assertions contain only our fixed descriptions. Raw OS/subprocess
        # exceptions can include personal paths, so do not publish those.
        message = (
            str(error)
            if isinstance(error, AssertionError)
            else "Local lab operation failed; raw machine details omitted."
        )
        report["error"] = {"type": type(error).__name__, "message": message}
    finally:
        cleanup_errors = []
        for child in children:
            try:
                stop_owned(child)
            except Exception as error:
                cleanup_errors.append(type(error).__name__)
            for stream in (child.stdout, child.stderr):
                if stream is not None:
                    try:
                        stream.close()
                    except Exception as error:
                        cleanup_errors.append(type(error).__name__)
        if temporary is not None:
            try:
                temporary.cleanup()
            except Exception as error:
                cleanup_errors.append(type(error).__name__)
        report["cleanup"].update(
            {
                "owned_child_count": len(children),
                "all_owned_children_exited": all(child.poll() is not None for child in children),
                "temporary_directory_removed": temporary_path is None or not temporary_path.exists(),
                "errors": cleanup_errors,
            }
        )
        if cleanup_errors or not report["cleanup"]["all_owned_children_exited"]:
            report["ok"] = False
        if not report["cleanup"]["temporary_directory_removed"]:
            report["ok"] = False

    serialized = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    RESULT.write_text(serialized, encoding="utf-8")
    print(serialized, end="")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
