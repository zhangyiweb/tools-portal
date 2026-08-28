"""QuickShare 全局配置"""

import os
import sys

APP_NAME = "QuickShare"
APP_VERSION = "1.0.0"

# 网络端口
DISCOVERY_PORT = 45678
HTTP_PORT = 45888

# UDP 广播间隔（秒）
BROADCAST_INTERVAL = 2

# 发现消息前缀
DISCOVERY_PREFIX = "QUICKSHARE_V1"

# 下载保存目录
if getattr(sys, "frozen", False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DOWNLOAD_DIR = os.path.join(BASE_DIR, "QuickShare_接收文件")
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

# 分块传输大小 1MB
CHUNK_SIZE = 1024 * 1024
