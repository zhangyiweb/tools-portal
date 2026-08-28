"""局域网设备发现 - UDP 广播"""

import socket
import threading
import time
from dataclasses import dataclass
from typing import Callable, Optional

from config import BROADCAST_INTERVAL, DISCOVERY_PORT, DISCOVERY_PREFIX


@dataclass
class Peer:
    name: str
    ip: str
    port: int
    last_seen: float

    @property
    def address(self) -> str:
        return f"{self.ip}:{self.port}"

    def __str__(self) -> str:
        return f"{self.name} ({self.ip})"


class DiscoveryService:
    """通过 UDP 广播发现局域网内的其他 QuickShare 实例"""

    def __init__(
        self,
        device_name: str,
        http_port: int,
        on_peer_found: Optional[Callable[[Peer], None]] = None,
        on_peer_lost: Optional[Callable[[str], None]] = None,
    ):
        self.device_name = device_name
        self.http_port = http_port
        self.on_peer_found = on_peer_found
        self.on_peer_lost = on_peer_lost

        self._peers: dict[str, Peer] = {}
        self._running = False
        self._threads: list[threading.Thread] = []
        self._local_ip = self._get_local_ip()

    @staticmethod
    def _get_local_ip() -> str:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except OSError:
            return "127.0.0.1"

    def _make_message(self) -> str:
        return f"{DISCOVERY_PREFIX}|{self.device_name}|{self._local_ip}|{self.http_port}"

    def _parse_message(self, data: str, sender_ip: str) -> Optional[Peer]:
        try:
            parts = data.split("|")
            if len(parts) != 4 or parts[0] != DISCOVERY_PREFIX:
                return None
            name, ip, port_str = parts[1], parts[2], parts[3]
            port = int(port_str)
            # 忽略自己
            if ip == self._local_ip and port == self.http_port:
                return None
            return Peer(name=name, ip=ip, port=port, last_seen=time.time())
        except (ValueError, IndexError):
            return None

    def _broadcast_loop(self):
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

        message = self._make_message().encode("utf-8")

        while self._running:
            try:
                sock.sendto(message, ("<broadcast>", DISCOVERY_PORT))
            except OSError:
                pass
            time.sleep(BROADCAST_INTERVAL)

        sock.close()

    def _listen_loop(self):
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind(("", DISCOVERY_PORT))
        sock.settimeout(1.0)

        while self._running:
            try:
                data, addr = sock.recvfrom(1024)
                peer = self._parse_message(data.decode("utf-8", errors="ignore"), addr[0])
                if peer:
                    key = peer.address
                    is_new = key not in self._peers
                    self._peers[key] = peer
                    if is_new and self.on_peer_found:
                        self.on_peer_found(peer)
            except socket.timeout:
                continue
            except OSError:
                break

        sock.close()

    def _cleanup_loop(self):
        while self._running:
            time.sleep(5)
            now = time.time()
            expired = [
                key for key, peer in self._peers.items()
                if now - peer.last_seen > BROADCAST_INTERVAL * 4
            ]
            for key in expired:
                del self._peers[key]
                if self.on_peer_lost:
                    self.on_peer_lost(key)

    def get_peers(self) -> list[Peer]:
        return list(self._peers.values())

    def start(self):
        if self._running:
            return
        self._running = True
        for target in (self._broadcast_loop, self._listen_loop, self._cleanup_loop):
            t = threading.Thread(target=target, daemon=True)
            t.start()
            self._threads.append(t)

    def stop(self):
        self._running = False
