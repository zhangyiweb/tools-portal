"""QuickShare - 局域网快速传文件工具"""

import os
import socket
import sys
import threading
import tkinter as tk
from tkinter import filedialog, messagebox
from typing import Optional

import customtkinter as ctk

from config import APP_NAME, APP_VERSION, DOWNLOAD_DIR, HTTP_PORT
from discovery import DiscoveryService, Peer
from transfer import TransferServer, find_available_port, format_size, send_file

# 外观设置
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")


class QuickShareApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title(f"{APP_NAME} v{APP_VERSION}")
        self.geometry("720x580")
        self.minsize(640, 520)

        self.device_name = socket.gethostname()
        self.http_port = find_available_port(HTTP_PORT)
        self.selected_peer: Optional[Peer] = None
        self.selected_files: list[str] = []
        self.is_sending = False

        self._build_ui()
        self._start_services()

        self.protocol("WM_DELETE_WINDOW", self._on_close)

    def _build_ui(self):
        # 顶部信息栏
        header = ctk.CTkFrame(self, fg_color="transparent")
        header.pack(fill="x", padx=20, pady=(16, 8))

        title = ctk.CTkLabel(
            header,
            text="⚡ QuickShare 快传",
            font=ctk.CTkFont(size=22, weight="bold"),
        )
        title.pack(side="left")

        self.status_label = ctk.CTkLabel(
            header,
            text="● 运行中",
            text_color="#4ade80",
            font=ctk.CTkFont(size=13),
        )
        self.status_label.pack(side="right")

        # 本机信息
        info_frame = ctk.CTkFrame(self)
        info_frame.pack(fill="x", padx=20, pady=8)

        ctk.CTkLabel(
            info_frame,
            text=f"本机名称: {self.device_name}    |    端口: {self.http_port}",
            font=ctk.CTkFont(size=13),
            text_color="gray70",
        ).pack(padx=12, pady=8)

        # 主内容区 - 左右分栏
        main = ctk.CTkFrame(self, fg_color="transparent")
        main.pack(fill="both", expand=True, padx=20, pady=8)
        main.columnconfigure(0, weight=1)
        main.columnconfigure(1, weight=1)
        main.rowconfigure(0, weight=1)

        # 左侧 - 局域网设备
        left = ctk.CTkFrame(main)
        left.grid(row=0, column=0, sticky="nsew", padx=(0, 8))

        ctk.CTkLabel(
            left,
            text="局域网设备",
            font=ctk.CTkFont(size=15, weight="bold"),
        ).pack(anchor="w", padx=12, pady=(12, 4))

        ctk.CTkLabel(
            left,
            text="同一 WiFi/局域网内的同事会自动出现",
            font=ctk.CTkFont(size=11),
            text_color="gray60",
        ).pack(anchor="w", padx=12, pady=(0, 8))

        self.peer_listbox = tk.Listbox(
            left,
            font=("Microsoft YaHei UI", 11),
            bg="#2b2b2b",
            fg="white",
            selectbackground="#1f6aa5",
            selectforeground="white",
            borderwidth=0,
            highlightthickness=0,
            activestyle="none",
        )
        self.peer_listbox.pack(fill="both", expand=True, padx=12, pady=(0, 8))
        self.peer_listbox.bind("<<ListboxSelect>>", self._on_peer_select)

        refresh_btn = ctk.CTkButton(
            left,
            text="刷新设备列表",
            command=self._refresh_peers,
            height=32,
            fg_color="transparent",
            border_width=1,
        )
        refresh_btn.pack(padx=12, pady=(0, 12))

        # 右侧 - 文件选择与发送
        right = ctk.CTkFrame(main)
        right.grid(row=0, column=1, sticky="nsew", padx=(8, 0))

        ctk.CTkLabel(
            right,
            text="发送文件",
            font=ctk.CTkFont(size=15, weight="bold"),
        ).pack(anchor="w", padx=12, pady=(12, 4))

        btn_row = ctk.CTkFrame(right, fg_color="transparent")
        btn_row.pack(fill="x", padx=12, pady=4)

        ctk.CTkButton(
            btn_row,
            text="选择文件",
            command=self._select_files,
            width=100,
            height=32,
        ).pack(side="left", padx=(0, 8))

        ctk.CTkButton(
            btn_row,
            text="选择文件夹",
            command=self._select_folder,
            width=100,
            height=32,
            fg_color="transparent",
            border_width=1,
        ).pack(side="left")

        self.file_listbox = tk.Listbox(
            right,
            font=("Microsoft YaHei UI", 10),
            bg="#2b2b2b",
            fg="white",
            selectbackground="#1f6aa5",
            borderwidth=0,
            highlightthickness=0,
            activestyle="none",
        )
        self.file_listbox.pack(fill="both", expand=True, padx=12, pady=8)

        self.send_btn = ctk.CTkButton(
            right,
            text="发送到选中设备",
            command=self._send_files,
            height=40,
            font=ctk.CTkFont(size=14, weight="bold"),
        )
        self.send_btn.pack(fill="x", padx=12, pady=(0, 8))

        # 进度条
        self.progress_frame = ctk.CTkFrame(self)
        self.progress_frame.pack(fill="x", padx=20, pady=(0, 8))

        self.progress_label = ctk.CTkLabel(
            self.progress_frame,
            text="就绪",
            font=ctk.CTkFont(size=12),
            text_color="gray70",
        )
        self.progress_label.pack(anchor="w", padx=12, pady=(8, 2))

        self.progress_bar = ctk.CTkProgressBar(self.progress_frame, height=8)
        self.progress_bar.pack(fill="x", padx=12, pady=(0, 8))
        self.progress_bar.set(0)

        # 底部 - 接收目录
        bottom = ctk.CTkFrame(self, fg_color="transparent")
        bottom.pack(fill="x", padx=20, pady=(0, 16))

        ctk.CTkLabel(
            bottom,
            text=f"接收文件保存至: {DOWNLOAD_DIR}",
            font=ctk.CTkFont(size=11),
            text_color="gray60",
        ).pack(side="left")

        ctk.CTkButton(
            bottom,
            text="打开接收文件夹",
            command=self._open_download_dir,
            width=120,
            height=28,
            font=ctk.CTkFont(size=11),
            fg_color="transparent",
            border_width=1,
        ).pack(side="right")

        # 日志区
        self.log_text = ctk.CTkTextbox(self, height=80, font=ctk.CTkFont(size=11))
        self.log_text.pack(fill="x", padx=20, pady=(0, 16))
        self.log_text.configure(state="disabled")

    def _log(self, message: str):
        def update():
            self.log_text.configure(state="normal")
            self.log_text.insert("end", message + "\n")
            self.log_text.see("end")
            self.log_text.configure(state="disabled")

        self.after(0, update)

    def _start_services(self):
        self.transfer_server = TransferServer(
            port=self.http_port,
            on_receive_start=self._on_receive_start,
            on_receive_progress=self._on_receive_progress,
            on_receive_complete=self._on_receive_complete,
            on_receive_error=self._on_receive_error,
        )
        self.transfer_server.start()

        self.discovery = DiscoveryService(
            device_name=self.device_name,
            http_port=self.http_port,
            on_peer_found=self._on_peer_found,
            on_peer_lost=self._on_peer_lost,
        )
        self.discovery.start()

        self._log(f"服务已启动，等待局域网设备... (端口 {self.http_port})")

    def _on_peer_found(self, peer: Peer):
        self.after(0, lambda: self._add_peer_to_list(peer))

    def _on_peer_lost(self, address: str):
        self.after(0, lambda: self._remove_peer_from_list(address))

    def _add_peer_to_list(self, peer: Peer):
        for i in range(self.peer_listbox.size()):
            if peer.address in self.peer_listbox.get(i):
                return
        self.peer_listbox.insert("end", str(peer))
        self._log(f"发现设备: {peer.name} ({peer.ip})")

    def _remove_peer_from_list(self, address: str):
        for i in range(self.peer_listbox.size()):
            if address.split(":")[0] in self.peer_listbox.get(i):
                self.peer_listbox.delete(i)
                self._log(f"设备离线: {address}")
                break

    def _refresh_peers(self):
        self.peer_listbox.delete(0, "end")
        for peer in self.discovery.get_peers():
            self.peer_listbox.insert("end", str(peer))
        self._log("已刷新设备列表")

    def _on_peer_select(self, event):
        selection = self.peer_listbox.curselection()
        if selection:
            text = self.peer_listbox.get(selection[0])
            peers = self.discovery.get_peers()
            for peer in peers:
                if peer.name in text and peer.ip in text:
                    self.selected_peer = peer
                    break

    def _select_files(self):
        files = filedialog.askopenfilenames(title="选择要发送的文件")
        if files:
            self.selected_files.extend(files)
            self._update_file_list()

    def _select_folder(self):
        folder = filedialog.askdirectory(title="选择要发送的文件夹")
        if folder:
            for root, _, filenames in os.walk(folder):
                for name in filenames:
                    self.selected_files.append(os.path.join(root, name))
            self._update_file_list()

    def _update_file_list(self):
        self.file_listbox.delete(0, "end")
        for f in self.selected_files:
            size = format_size(os.path.getsize(f))
            self.file_listbox.insert("end", f"{os.path.basename(f)}  ({size})")

    def _send_files(self):
        if self.is_sending:
            messagebox.showwarning("提示", "正在传输中，请稍候...")
            return

        if not self.selected_peer:
            messagebox.showwarning("提示", "请先选择要发送到的局域网设备")
            return

        if not self.selected_files:
            messagebox.showwarning("提示", "请先选择要发送的文件")
            return

        self.is_sending = True
        self.send_btn.configure(state="disabled", text="传输中...")

        thread = threading.Thread(
            target=self._do_send,
            args=(self.selected_peer, list(self.selected_files)),
            daemon=True,
        )
        thread.start()

    def _do_send(self, peer: Peer, files: list[str]):
        total_files = len(files)
        success_count = 0
        failed_file = ""
        error_msg = ""

        for idx, file_path in enumerate(files):
            filename = os.path.basename(file_path)
            file_size = os.path.getsize(file_path)

            self.after(0, lambda f=filename, i=idx: self.progress_label.configure(
                text=f"正在发送 ({i + 1}/{total_files}): {f}"
            ))

            def make_progress(file_idx, fsize):
                def on_progress(sent, total):
                    overall = (file_idx + sent / total) / total_files
                    self.after(0, lambda: self.progress_bar.set(overall))
                    self.after(0, lambda s=sent, t=total: self.progress_label.configure(
                        text=f"正在发送 ({file_idx + 1}/{total_files}): "
                             f"{os.path.basename(files[file_idx])} - {format_size(s)}/{format_size(t)}"
                    ))
                return on_progress

            done_event = threading.Event()
            result = {"ok": False, "error": ""}

            def on_complete():
                result["ok"] = True
                done_event.set()

            def on_error(msg):
                result["error"] = msg
                done_event.set()

            send_file(
                peer.ip,
                peer.port,
                file_path,
                on_progress=make_progress(idx, file_size),
                on_complete=on_complete,
                on_error=on_error,
            )
            done_event.wait(timeout=3600)

            if result["ok"]:
                success_count += 1
                self.after(0, lambda f=filename: self._log(f"✓ 已发送: {f} → {peer.name}"))
            else:
                failed_file = filename
                error_msg = result["error"]
                self.after(0, lambda f=filename, e=result["error"]: self._log(
                    f"✗ 发送失败: {f} - {e}"
                ))
                break

        self.after(0, lambda: self._send_complete(
            peer, success_count, total_files, failed_file, error_msg
        ))

    def _send_complete(
        self,
        peer: Peer,
        success_count: int,
        total_files: int,
        failed_file: str,
        error_msg: str,
    ):
        self.is_sending = False
        self.send_btn.configure(state="normal", text="发送到选中设备")
        self.progress_bar.set(1)
        self.progress_label.configure(text="传输完成")
        self.selected_files.clear()
        self.file_listbox.delete(0, "end")

        if failed_file:
            messagebox.showerror(
                "发送失败",
                f"文件「{failed_file}」发送失败：{error_msg}\n"
                f"已成功发送 {success_count}/{total_files} 个文件",
            )
        elif success_count > 0:
            messagebox.showinfo(
                "发送完成",
                f"已成功将 {success_count} 个文件发送到 {peer.name}",
            )

    def _on_receive_start(self, filename: str, size: int):
        self.after(0, lambda: self._log(f"↓ 正在接收: {filename} ({format_size(size)})"))
        self.after(0, lambda: self.progress_label.configure(text=f"正在接收: {filename}"))
        self.after(0, lambda: self.progress_bar.set(0))

    def _on_receive_progress(self, transfer_id: str, received: int, total: int):
        progress = received / total if total > 0 else 0
        self.after(0, lambda: self.progress_bar.set(progress))

    def _on_receive_complete(self, filename: str, save_path: str):
        def update():
            self._log(f"✓ 接收完成: {filename}")
            self.progress_label.configure(text=f"已接收: {filename}")
            self.progress_bar.set(1)
            messagebox.showinfo(
                "接收完成",
                f"已接收文件：{filename}\n保存位置：{save_path}",
            )

        self.after(0, update)

    def _on_receive_error(self, filename: str, error: str):
        self.after(0, lambda: self._log(f"✗ 接收失败: {filename} - {error}"))

    def _open_download_dir(self):
        os.startfile(DOWNLOAD_DIR)

    def _on_close(self):
        self.discovery.stop()
        self.transfer_server.stop()
        self.destroy()


def main():
    app = QuickShareApp()
    app.mainloop()


if __name__ == "__main__":
    main()
