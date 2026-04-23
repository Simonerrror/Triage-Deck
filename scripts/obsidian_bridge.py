#!/usr/bin/env python3
"""Local bridge: X userscript -> localhost -> obsidian CLI."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path, PurePosixPath


HOST = os.environ.get("XBT_BRIDGE_HOST", "127.0.0.1")
PORT = int(os.environ.get("XBT_BRIDGE_PORT", "8765"))
TOKEN = os.environ.get("XBT_BRIDGE_TOKEN", "")
OBSIDIAN_BIN = os.environ.get("XBT_OBSIDIAN_BIN", "obsidian")
DEFAULT_VAULT = os.environ.get("XBT_OBSIDIAN_VAULT", "YOUR_VAULT_NAME")
ALLOW_RESTART = os.environ.get("XBT_BRIDGE_ALLOW_RESTART", "1").lower() not in {
    "0",
    "false",
    "no",
}
ALLOWED_FOLDER_PREFIX = os.environ.get(
    "XBT_ALLOWED_FOLDER_PREFIX",
    "Inbox/X Bookmarks",
)
def resolve_vault_root(vault_name: str) -> Path:
    config_path = Path.home() / "Library/Application Support/obsidian/obsidian.json"
    data = json.loads(config_path.read_text(encoding="utf-8"))
    for vault_data in data.get("vaults", {}).values():
        if Path(vault_data.get("path", "")).name == vault_name:
            return Path(vault_data["path"])
    raise ValueError(f"Vault path not found for {vault_name!r}.")


def send_cors_headers(handler: BaseHTTPRequestHandler) -> None:
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type, X-XBT-Token")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Access-Control-Max-Age", "600")

    if handler.headers.get("Access-Control-Request-Private-Network") == "true":
        handler.send_header("Access-Control-Allow-Private-Network", "true")


def json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    send_cors_headers(handler)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def sanitize_path(folder: str, file_name: str) -> str:
    folder_path = PurePosixPath(folder)
    allowed_prefix = PurePosixPath(ALLOWED_FOLDER_PREFIX)

    if ".." in folder_path.parts or ".." in PurePosixPath(file_name).parts:
        raise ValueError("Path traversal is not allowed.")

    if not str(folder_path).startswith(str(allowed_prefix)):
        raise ValueError("Folder is outside the allowed inbox prefix.")

    clean_name = file_name.strip().replace("\x00", "")
    if not clean_name:
        raise ValueError("file_name is required.")

    if not clean_name.endswith(".md"):
        clean_name += ".md"

    return str(folder_path / clean_name)


def resolve_obsidian_bin() -> str | None:
    candidate = Path(OBSIDIAN_BIN).expanduser()

    if candidate.is_absolute():
        return str(candidate) if candidate.exists() else None

    return shutil.which(OBSIDIAN_BIN)


def health_payload() -> tuple[int, dict]:
    obsidian_bin_path = resolve_obsidian_bin()
    vault_path: str | None = None
    vault_error: str | None = None

    try:
        vault_path = str(resolve_vault_root(DEFAULT_VAULT))
    except ValueError as exc:
        vault_error = str(exc)

    checks = {
        "obsidian_cli": bool(obsidian_bin_path),
        "vault": bool(vault_path),
    }
    healthy = all(checks.values())

    return (
        200 if healthy else 503,
        {
            "ok": healthy,
            "status": "up" if healthy else "degraded",
            "host": HOST,
            "port": PORT,
            "obsidian_bin": OBSIDIAN_BIN,
            "obsidian_bin_path": obsidian_bin_path,
            "vault": DEFAULT_VAULT,
            "vault_path": vault_path,
            "vault_error": vault_error,
            "allowed_folder_prefix": ALLOWED_FOLDER_PREFIX,
            "token_required": bool(TOKEN),
            "restart_allowed": ALLOW_RESTART,
            "checks": checks,
        },
    )


def restart_process() -> None:
    time.sleep(0.2)
    os.execv(sys.executable, [sys.executable, str(Path(__file__).resolve())])


class BridgeHandler(BaseHTTPRequestHandler):
    server_version = "XBTBridge/0.1"

    def log_message(self, format: str, *args) -> None:  # noqa: A003
        return

    def do_OPTIONS(self) -> None:  # noqa: N802
        if self.path not in {"/capture", "/health", "/restart"}:
            self.send_response(404)
            send_cors_headers(self)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return

        self.send_response(204)
        send_cors_headers(self)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        if self.path != "/health":
            json_response(self, 404, {"ok": False, "error": "Not found."})
            return

        status, payload = health_payload()
        json_response(self, status, payload)

    def do_POST(self) -> None:  # noqa: N802
        if self.path == "/restart":
            if not ALLOW_RESTART:
                json_response(self, 403, {"ok": False, "error": "Bridge restart is disabled."})
                return

            json_response(self, 202, {"ok": True, "status": "restarting"})
            threading.Thread(target=restart_process, daemon=True).start()
            return

        if self.path != "/capture":
            json_response(self, 404, {"ok": False, "error": "Not found."})
            return

        if TOKEN and self.headers.get("X-XBT-Token", "") != TOKEN:
            json_response(self, 403, {"ok": False, "error": "Invalid bridge token."})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            vault = payload.get("vault") or DEFAULT_VAULT
            folder = payload["folder"]
            file_name = payload["file_name"]
            content = payload["content"]
            target_path = sanitize_path(folder, file_name)
        except (ValueError, KeyError, json.JSONDecodeError) as exc:
            json_response(self, 400, {"ok": False, "error": str(exc)})
            return

        command = [
            OBSIDIAN_BIN,
            "create",
            f"vault={vault}",
            f"path={target_path}",
            f"content={content}",
        ]

        result = subprocess.run(command, capture_output=True, text=True)
        stdout = (result.stdout or "").strip()
        stderr = (result.stderr or "").strip()

        try:
            vault_root = resolve_vault_root(vault)
            created_file = vault_root / target_path
        except ValueError as exc:
            json_response(
                self,
                500,
                {
                    "ok": False,
                    "error": str(exc),
                },
            )
            return

        if result.returncode != 0 or not created_file.exists():
            json_response(
                self,
                500,
                {
                    "ok": False,
                    "error": stderr or stdout or "obsidian create failed",
                },
            )
            return

        json_response(
            self,
            200,
            {
                "ok": True,
                "path": target_path,
                "warning": stdout or None,
            },
        )


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), BridgeHandler)
    print(
        f"XBT bridge listening on http://{HOST}:{PORT}/capture "
        f"(health: http://{HOST}:{PORT}/health)",
        flush=True,
    )
    server.serve_forever()


if __name__ == "__main__":
    main()
