"""HTTP 文件传输服务"""

import json
import os
import socket
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Callable, Optional
from urllib.parse import parse_qs, unquote, urlparse

from config import CHUNK_SIZE, DOWNLOAD_DIR


class TransferServer:
    """接收文件的 HTTP 服务器"""

    def __init__(
        self,
        port: int,
        on_receive_start: Optional[Callable[[str, int], None]] = None,
        on_receive_progress: Optional[Callable[[str, int, int], None]] = None,
        on_receive_complete: Optional[Callable[[str, str], None]] = None,
        on_receive_error: Optional[Callable[[str, str], None]] = None,
    ):
        self.port = port
        self.on_receive_start = on_receive_start
        self.on_receive_progress = on_receive_progress
        self.on_receive_complete = on_receive_complete
        self.on_receive_error = on_receive_error
        self._server: Optional[HTTPServer] = None
        self._thread: Optional[threading.Thread] = None
        self._running = False

    def start(self):
        if self._running:
            return

        handler = self._create_handler()
        self._server = HTTPServer(("0.0.0.0", self.port), handler)
        self._running = True
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False
        if self._server:
            self._server.shutdown()
            self._server = None

    def _create_handler(self):
        server = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, format, *args):
                pass

            def do_GET(self):
                parsed = urlparse(self.path)
                if parsed.path == "/ping":
                    self._send_json({"status": "ok", "app": "QuickShare"})
                elif parsed.path == "/info":
                    self._send_json({"download_dir": DOWNLOAD_DIR})
                else:
                    self.send_error(404)

            def do_POST(self):
                parsed = urlparse(self.path)
                if parsed.path == "/upload":
                    self._handle_upload()
                else:
                    self.send_error(404)

            def _handle_upload(self):
                content_length = int(self.headers.get("Content-Length", 0))
                filename = unquote(self.headers.get("X-Filename", "unknown"))
                transfer_id = self.headers.get("X-Transfer-Id", str(uuid.uuid4())[:8])

                # 处理重名文件
                save_path = os.path.join(DOWNLOAD_DIR, filename)
                if os.path.exists(save_path):
                    base, ext = os.path.splitext(filename)
                    counter = 1
                    while os.path.exists(save_path):
                        save_path = os.path.join(DOWNLOAD_DIR, f"{base}_{counter}{ext}")
                        counter += 1

                received = 0
                if server.on_receive_start:
                    server.on_receive_start(filename, content_length)

                try:
                    with open(save_path, "wb") as f:
                        while received < content_length:
                            chunk = self.rfile.read(min(CHUNK_SIZE, content_length - received))
                            if not chunk:
                                break
                            f.write(chunk)
                            received += len(chunk)
                            if server.on_receive_progress:
                                server.on_receive_progress(transfer_id, received, content_length)

                    self._send_json({
                        "status": "ok",
                        "saved_path": save_path,
                        "size": received,
                    })
                    if server.on_receive_complete:
                        server.on_receive_complete(filename, save_path)
                except Exception as e:
                    if os.path.exists(save_path):
                        os.remove(save_path)
                    if server.on_receive_error:
                        server.on_receive_error(filename, str(e))
                    self._send_json({"status": "error", "message": str(e)}, 500)

            def _send_json(self, data: dict, code: int = 200):
                body = json.dumps(data, ensure_ascii=False).encode("utf-8")
                self.send_response(code)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

        return Handler


def find_available_port(start: int = 45888, max_tries: int = 100) -> int:
    """查找可用端口"""
    for port in range(start, start + max_tries):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.bind(("0.0.0.0", port))
            s.close()
            return port
        except OSError:
            continue
    raise RuntimeError("无法找到可用端口")


def send_file(
    peer_ip: str,
    peer_port: int,
    file_path: str,
    on_progress: Optional[Callable[[int, int], None]] = None,
    on_complete: Optional[Callable[[], None]] = None,
    on_error: Optional[Callable[[str], None]] = None,
) -> bool:
    """向对端发送文件"""
    import requests

    filename = os.path.basename(file_path)
    file_size = os.path.getsize(file_path)
    transfer_id = str(uuid.uuid4())[:8]

    url = f"http://{peer_ip}:{peer_port}/upload"

    class ProgressReader:
        def __init__(self, filepath, total, callback):
            self.file = open(filepath, "rb")
            self.total = total
            self.sent = 0
            self.callback = callback

        def read(self, size=-1):
            data = self.file.read(size if size > 0 else CHUNK_SIZE)
            self.sent += len(data)
            if self.callback:
                self.callback(self.sent, self.total)
            return data

        def __len__(self):
            return self.total

    try:
        # 先 ping 检查连通性
        ping_url = f"http://{peer_ip}:{peer_port}/ping"
        resp = requests.get(ping_url, timeout=3)
        if resp.status_code != 200:
            raise ConnectionError("无法连接到对方设备")

        reader = ProgressReader(file_path, file_size, on_progress)

        headers = {
            "X-Filename": filename,
            "X-Transfer-Id": transfer_id,
            "Content-Type": "application/octet-stream",
            "Content-Length": str(file_size),
        }

        resp = requests.post(url, data=reader, headers=headers, timeout=None)
        reader.file.close()

        if resp.status_code == 200:
            if on_complete:
                on_complete()
            return True
        else:
            error_msg = resp.json().get("message", "传输失败")
            if on_error:
                on_error(error_msg)
            return False

    except Exception as e:
        if on_error:
            on_error(str(e))
        return False


def format_size(size: int) -> str:
    """格式化文件大小"""
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if size < 1024:
            return f"{size:.1f} {unit}" if unit != "B" else f"{size} B"
        size /= 1024
    return f"{size:.1f} PB"
