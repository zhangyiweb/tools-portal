package com.easyssh.ssh;

import com.easyssh.model.ServerProfile;
import com.jcraft.jsch.ChannelExec;
import com.jcraft.jsch.ChannelSftp;
import com.jcraft.jsch.JSch;
import com.jcraft.jsch.Session;
import com.jcraft.jsch.SftpATTRS;
import com.jcraft.jsch.SftpException;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;
import java.util.Vector;
import java.util.concurrent.TimeUnit;

public class SshClient implements AutoCloseable {
    private final ServerProfile profile;
    private Session session;

    public SshClient(ServerProfile profile) {
        this.profile = profile;
    }

    public synchronized void connect() throws Exception {
        if (session != null && session.isConnected()) {
            return;
        }
        JSch jsch = new JSch();
        if (profile.getAuthType() == ServerProfile.AuthType.PRIVATE_KEY
                && profile.getPrivateKeyPath() != null
                && !profile.getPrivateKeyPath().isBlank()) {
            jsch.addIdentity(profile.getPrivateKeyPath());
        }

        session = jsch.getSession(profile.getUsername(), profile.getHost(), profile.getPort());
        if (profile.getAuthType() == ServerProfile.AuthType.PASSWORD) {
            session.setPassword(profile.getPassword());
        }

        Properties config = new Properties();
        config.put("StrictHostKeyChecking", "no");
        config.put("PreferredAuthentications", "publickey,password,keyboard-interactive");
        session.setConfig(config);
        session.setTimeout(15000);
        session.connect(15000);
    }

    public synchronized boolean isConnected() {
        return session != null && session.isConnected();
    }

    public ServerProfile getProfile() {
        return profile;
    }

    public CommandResult exec(String command) throws Exception {
        return exec(command, 300);
    }

    public CommandResult exec(String command, int timeoutSeconds) throws Exception {
        ensureConnected();
        ChannelExec channel = (ChannelExec) session.openChannel("exec");
        channel.setCommand(command);
        ByteArrayOutputStream stdout = new ByteArrayOutputStream();
        ByteArrayOutputStream stderr = new ByteArrayOutputStream();
        channel.setOutputStream(stdout);
        channel.setErrStream(stderr);
        channel.connect(10000);

        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(Math.max(30, timeoutSeconds));
        while (!channel.isClosed()) {
            if (System.nanoTime() > deadline) {
                channel.disconnect();
                throw new IllegalStateException("命令执行超时（" + timeoutSeconds + "秒）");
            }
            Thread.sleep(80);
        }
        int exit = channel.getExitStatus();
        channel.disconnect();
        return new CommandResult(exit, stdout.toString(StandardCharsets.UTF_8), stderr.toString(StandardCharsets.UTF_8));
    }

    public long fileSize(String remotePath) throws Exception {
        ensureConnected();
        ChannelSftp sftp = (ChannelSftp) session.openChannel("sftp");
        sftp.connect(10000);
        try {
            return sftp.lstat(remotePath).getSize();
        } finally {
            sftp.disconnect();
        }
    }

    public void mkdir(String remotePath) throws Exception {
        ensureConnected();
        ChannelSftp sftp = (ChannelSftp) session.openChannel("sftp");
        sftp.connect(10000);
        try {
            try {
                sftp.mkdir(remotePath);
            } catch (SftpException ignored) {
                // 已存在
            }
        } finally {
            sftp.disconnect();
        }
    }

    public void mkdirs(String remotePath) throws Exception {
        if (remotePath == null || remotePath.isBlank() || "/".equals(remotePath)) {
            return;
        }
        String normalized = remotePath.replace('\\', '/');
        while (normalized.contains("//")) {
            normalized = normalized.replace("//", "/");
        }
        if (normalized.length() > 1 && normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        String[] parts = normalized.split("/");
        StringBuilder current = new StringBuilder();
        for (String part : parts) {
            if (part == null || part.isBlank()) {
                continue;
            }
            current.append('/').append(part);
            mkdir(current.toString());
        }
    }

    public List<RemoteFile> listFiles(String remotePath) throws Exception {
        ensureConnected();
        ChannelSftp sftp = (ChannelSftp) session.openChannel("sftp");
        sftp.connect(10000);
        try {
            @SuppressWarnings("unchecked")
            Vector<ChannelSftp.LsEntry> entries = sftp.ls(remotePath);
            List<RemoteFile> result = new ArrayList<>();
            for (ChannelSftp.LsEntry entry : entries) {
                String name = entry.getFilename();
                if (".".equals(name) || "..".equals(name)) {
                    continue;
                }
                SftpATTRS attrs = entry.getAttrs();
                String path = remotePath.endsWith("/") ? remotePath + name : remotePath + "/" + name;
                result.add(new RemoteFile(name, path, attrs.isDir(), attrs.getSize(), attrs.getPermissionsString(), attrs.getMtimeString()));
            }
            result.sort((a, b) -> {
                if (a.directory() != b.directory()) {
                    return a.directory() ? -1 : 1;
                }
                return a.name().compareToIgnoreCase(b.name());
            });
            return result;
        } finally {
            sftp.disconnect();
        }
    }

    public void download(String remotePath, Path localPath) throws Exception {
        ensureConnected();
        ChannelSftp sftp = (ChannelSftp) session.openChannel("sftp");
        sftp.connect(10000);
        try {
            sftp.get(remotePath, localPath.toString());
        } finally {
            sftp.disconnect();
        }
    }

    public void upload(Path localPath, String remotePath) throws Exception {
        ensureConnected();
        ChannelSftp sftp = (ChannelSftp) session.openChannel("sftp");
        sftp.connect(10000);
        try {
            sftp.put(localPath.toString(), remotePath);
        } finally {
            sftp.disconnect();
        }
    }

    /**
     * 上传文件或整个目录（递归）到远程路径。
     */
    public void uploadAny(Path localPath, String remotePath) throws Exception {
        if (localPath == null || !java.nio.file.Files.exists(localPath)) {
            throw new IllegalArgumentException("本地路径不存在");
        }
        String remote = remotePath == null ? "" : remotePath.replace('\\', '/');
        if (java.nio.file.Files.isDirectory(localPath)) {
            mkdirs(remote);
            try (var stream = java.nio.file.Files.list(localPath)) {
                for (Path child : stream.toList()) {
                    String childRemote = remote.endsWith("/")
                            ? remote + child.getFileName()
                            : remote + "/" + child.getFileName();
                    uploadAny(child, childRemote);
                }
            }
            return;
        }
        int slash = remote.lastIndexOf('/');
        if (slash > 0) {
            mkdirs(remote.substring(0, slash));
        }
        upload(localPath, remote);
    }

    public void delete(String remotePath) throws Exception {
        ensureConnected();
        ChannelSftp sftp = (ChannelSftp) session.openChannel("sftp");
        sftp.connect(10000);
        try {
            try {
                sftp.rm(remotePath);
            } catch (SftpException e) {
                sftp.rmdir(remotePath);
            }
        } finally {
            sftp.disconnect();
        }
    }

    public void readFileTo(String remotePath, OutputStream out) throws Exception {
        ensureConnected();
        ChannelSftp sftp = (ChannelSftp) session.openChannel("sftp");
        sftp.connect(10000);
        try (InputStream in = sftp.get(remotePath)) {
            in.transferTo(out);
        } finally {
            sftp.disconnect();
        }
    }

    public String readText(String remotePath, long maxBytes) throws Exception {
        ensureConnected();
        ChannelSftp sftp = (ChannelSftp) session.openChannel("sftp");
        sftp.connect(10000);
        try {
            SftpATTRS attrs = sftp.lstat(remotePath);
            if (attrs.isDir()) {
                throw new IllegalArgumentException("这是目录，不能作为文件编辑");
            }
            long size = attrs.getSize();
            if (size > maxBytes) {
                throw new IllegalArgumentException("文件过大（" + size + " 字节），超过可编辑上限 "
                        + maxBytes + " 字节，请改用下载");
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream((int) Math.max(64, size));
            try (InputStream in = sftp.get(remotePath)) {
                in.transferTo(out);
            }
            return out.toString(StandardCharsets.UTF_8);
        } finally {
            sftp.disconnect();
        }
    }

    public void writeText(String remotePath, String content) throws Exception {
        ensureConnected();
        ChannelSftp sftp = (ChannelSftp) session.openChannel("sftp");
        sftp.connect(10000);
        try {
            byte[] bytes = (content == null ? "" : content).getBytes(StandardCharsets.UTF_8);
            try (OutputStream out = sftp.put(remotePath)) {
                out.write(bytes);
                out.flush();
            }
        } finally {
            sftp.disconnect();
        }
    }

    private void ensureConnected() throws Exception {
        if (!isConnected()) {
            connect();
        }
    }

    @Override
    public synchronized void close() {
        if (session != null) {
            session.disconnect();
            session = null;
        }
    }

    public record CommandResult(int exitCode, String stdout, String stderr) {
        public String combined() {
            StringBuilder sb = new StringBuilder();
            if (stdout != null && !stdout.isBlank()) {
                sb.append(stdout.trim());
            }
            if (stderr != null && !stderr.isBlank()) {
                if (!sb.isEmpty()) {
                    sb.append('\n');
                }
                sb.append(stderr.trim());
            }
            return sb.toString();
        }

        public boolean ok() {
            return exitCode == 0;
        }
    }

    public record RemoteFile(String name, String path, boolean directory, long size, String permissions, String modified) {
    }
}
