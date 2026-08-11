package com.easyssh.service;

import com.easyssh.model.DiskInfo;
import com.easyssh.model.FileEntry;
import com.easyssh.model.ProcessInfo;
import com.easyssh.model.SystemStats;
import com.easyssh.ssh.SshClient;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class ServerOpsService {
    private final SshClient client;

    public ServerOpsService(SshClient client) {
        this.client = client;
    }

    public SystemStats fetchStats() throws Exception {
        String script = String.join("\n",
                "echo '===HOST==='",
                "hostname",
                "echo '===IP==='",
                "hostname -I 2>/dev/null | awk '{print $1}'",
                "ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i==\"src\"){print $(i+1); exit}}'",
                "echo '===OS==='",
                "uname -a",
                "echo '===UPTIME==='",
                "uptime -p 2>/dev/null || uptime",
                "echo '===LOAD==='",
                "cat /proc/loadavg 2>/dev/null || echo '0 0 0'",
                "echo '===CPU==='",
                "grep 'cpu ' /proc/stat | awk '{u=$2+$4; t=$2+$3+$4+$5; if(t>0) printf \"%.0f\", 100*u/t; else print 0}'",
                "echo '===MEM==='",
                "free -m | awk '/Mem:/ {printf \"%s|%s|%.0f\\n\", $3, $2, ($2==0?0:100*$3/$2)}'",
                "echo '===SWAP==='",
                "free -m | awk '/Swap:/ {printf \"%s|%s|%.0f\\n\", $3, $2, ($2==0?0:100*$3/$2)}'",
                "echo '===DISK==='",
                "df -h -x tmpfs -x devtmpfs -x squashfs 2>/dev/null | awk 'NR>1 {print $6\"|\"$2\"|\"$3\"|\"$4\"|\"$5}'",
                "echo '===PS==='",
                "ps -eo user,pid,pcpu,pmem,comm --sort=-pmem 2>/dev/null | awk 'NR>1 && NR<=9 {print $1\"|\"$2\"|\"$3\"|\"$4\"|\"$5}'",
                "echo '===END==='"
        );

        SshClient.CommandResult result = client.exec("bash -lc " + shellQuote(script));
        SystemStats stats = parseStats(result.combined());
        stats.setSyncTip("已同步");
        stats.setCpuUsage(stats.getCpuPercent() + "%");
        stats.setMemoryUsage(stats.getMemDetail());
        stats.setLoadAverage(stats.getLoad1() + " / " + stats.getLoad5() + " / " + stats.getLoad15());
        if (!stats.getDisks().isEmpty()) {
            DiskInfo root = stats.getDisks().stream()
                    .filter(d -> "/".equals(d.getMount()))
                    .findFirst()
                    .orElse(stats.getDisks().get(0));
            stats.setDiskUsage(root.getUsed() + " / " + root.getSize() + "，已用 " + root.getUsePercent());
        }
        return stats;
    }

    public List<FileEntry> listFiles(String remotePath) throws Exception {
        List<FileEntry> files = new ArrayList<>();
        for (SshClient.RemoteFile remote : client.listFiles(remotePath)) {
            FileEntry entry = new FileEntry();
            entry.setName(remote.name());
            entry.setPath(remote.path());
            entry.setDirectory(remote.directory());
            entry.setSize(remote.size());
            entry.setPermissions(remote.permissions());
            entry.setModified(remote.modified());
            files.add(entry);
        }
        return files;
    }

    public List<FileEntry> listDirectories(String remotePath) throws Exception {
        List<FileEntry> dirs = new ArrayList<>();
        for (FileEntry entry : listFiles(remotePath)) {
            if (entry.isDirectory()) {
                dirs.add(entry);
            }
        }
        return dirs;
    }

    public void download(String remotePath, Path localPath) throws Exception {
        client.download(remotePath, localPath);
    }

    /** 读取远程文本文件（UTF-8），默认上限 2MB。 */
    public String readText(String remotePath) throws Exception {
        return client.readText(remotePath, 2L * 1024 * 1024);
    }

    public void writeText(String remotePath, String content) throws Exception {
        client.writeText(remotePath, content);
    }

    public void upload(Path localPath, String remotePath) throws Exception {
        client.upload(localPath, remotePath);
    }

    public void uploadAny(Path localPath, String remotePath) throws Exception {
        client.uploadAny(localPath, remotePath);
    }

    public String uploadBatch(List<Path> localPaths, String remoteDir) throws Exception {
        if (localPaths == null || localPaths.isEmpty()) {
            throw new IllegalArgumentException("请选择要上传的文件或文件夹");
        }
        String base = normalizePath(remoteDir == null || remoteDir.isBlank() ? "/" : remoteDir);
        StringBuilder report = new StringBuilder();
        int ok = 0;
        for (Path local : localPaths) {
            String name = local.getFileName() == null ? local.toString() : local.getFileName().toString();
            String remote = "/".equals(base) ? "/" + name : base + "/" + name;
            client.uploadAny(local, remote);
            report.append("已上传：").append(local).append(" -> ").append(remote).append('\n');
            ok++;
        }
        return "批量上传完成，共 " + ok + " 项\n目标目录：" + base + "\n\n" + report;
    }

    public void mkdir(String remotePath) throws Exception {
        client.mkdirs(remotePath);
    }

    public void delete(String remotePath) throws Exception {
        client.delete(remotePath);
    }

    public String installDocker() throws Exception {
        String cmd = String.join(" && ",
                "if command -v docker >/dev/null 2>&1; then echo 'Docker 已安装'; docker --version; exit 0; fi",
                "export DEBIAN_FRONTEND=noninteractive",
                "(sudo apt-get update -y || true)",
                "(sudo yum makecache -y || true)",
                "curl -fsSL https://get.docker.com | sudo sh",
                "sudo systemctl enable docker",
                "sudo systemctl start docker",
                "docker --version || sudo docker --version"
        );
        return runLong(cmd, "Docker 安装完成");
    }

    public boolean isDockerInstalled() throws Exception {
        SshClient.CommandResult version = client.exec(
                "docker --version 2>/dev/null || sudo docker --version 2>/dev/null",
                30
        );
        String text = version.combined() == null ? "" : version.combined().toLowerCase();
        return version.ok() && text.contains("docker") && !text.contains("not found") && !text.contains("未安装");
    }

    public String installNginx() throws Exception {
        String cmd = String.join(" && ",
                "if command -v nginx >/dev/null 2>&1; then echo 'Nginx 已安装'; nginx -v 2>&1; exit 0; fi",
                "export DEBIAN_FRONTEND=noninteractive",
                "(sudo apt-get update -y && sudo apt-get install -y nginx) || (sudo yum install -y nginx)",
                "sudo systemctl enable nginx",
                "sudo systemctl start nginx",
                "nginx -v 2>&1 || true",
                "systemctl is-active nginx || true"
        );
        return runLong(cmd, "Nginx 安装完成");
    }

    public String deployNginxStatic(String siteName, String domain, int listenPort, String rootPath) throws Exception {
        String safeName = sanitizeName(siteName);
        String serverName = domain == null || domain.isBlank() ? "_" : domain.trim();
        String root = normalizePath(rootPath);
        String confPath = "/etc/nginx/conf.d/" + safeName + ".conf";

        String conf = String.join("\n",
                "server {",
                "    listen " + listenPort + ";",
                "    server_name " + serverName + ";",
                "    root " + root + ";",
                "    index index.html index.htm;",
                "    location / {",
                "        try_files $uri $uri/ /index.html;",
                "    }",
                "    access_log /var/log/nginx/" + safeName + ".access.log;",
                "    error_log /var/log/nginx/" + safeName + ".error.log;",
                "}"
        );

        String cmd = String.join(" && ",
                "sudo mkdir -p " + shellQuote(root),
                "echo " + shellQuote(conf) + " | sudo tee " + shellQuote(confPath) + " >/dev/null",
                "if [ ! -f " + shellQuote(root + "/index.html") + " ]; then echo " + shellQuote(defaultIndex(serverName)) + " | sudo tee " + shellQuote(root + "/index.html") + " >/dev/null; fi",
                "sudo nginx -t",
                "sudo systemctl reload nginx || sudo nginx -s reload",
                "echo '部署成功: " + confPath + "'",
                "echo '站点目录: " + root + "'",
                "echo '访问端口: " + listenPort + "'"
        );
        return runLong(cmd, "静态站点已部署");
    }

    public String deployNginxProxy(String siteName, String domain, int listenPort, String proxyTarget) throws Exception {
        String safeName = sanitizeName(siteName);
        String serverName = domain == null || domain.isBlank() ? "_" : domain.trim();
        String target = proxyTarget == null || proxyTarget.isBlank() ? "http://127.0.0.1:3000" : proxyTarget.trim();
        String confPath = "/etc/nginx/conf.d/" + safeName + ".conf";

        String conf = String.join("\n",
                "server {",
                "    listen " + listenPort + ";",
                "    server_name " + serverName + ";",
                "    location / {",
                "        proxy_pass " + target + ";",
                "        proxy_http_version 1.1;",
                "        proxy_set_header Host $host;",
                "        proxy_set_header X-Real-IP $remote_addr;",
                "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
                "        proxy_set_header Upgrade $http_upgrade;",
                "        proxy_set_header Connection \"upgrade\";",
                "    }",
                "    access_log /var/log/nginx/" + safeName + ".access.log;",
                "    error_log /var/log/nginx/" + safeName + ".error.log;",
                "}"
        );

        String cmd = String.join(" && ",
                "echo " + shellQuote(conf) + " | sudo tee " + shellQuote(confPath) + " >/dev/null",
                "sudo nginx -t",
                "sudo systemctl reload nginx || sudo nginx -s reload",
                "echo '反向代理已部署: " + confPath + "'",
                "echo '代理目标: " + target + "'"
        );
        return runLong(cmd, "反向代理已部署");
    }

    public String runQuickAction(String actionId) throws Exception {
        return switch (actionId) {
            case "nginx-reload" -> run("sudo nginx -t && (sudo systemctl reload nginx || sudo nginx -s reload)", "Nginx 已重载");
            case "nginx-restart" -> run("sudo systemctl restart nginx", "Nginx 已重启");
            case "nginx-status" -> run("systemctl status nginx --no-pager -l | head -n 40", null);
            case "nginx-error-log" -> run("sudo tail -n 100 /var/log/nginx/error.log 2>/dev/null || echo '未找到 nginx 错误日志'", null);
            case "nginx-access-log" -> run("sudo tail -n 100 /var/log/nginx/access.log 2>/dev/null || echo '未找到 nginx 访问日志'", null);
            case "disk-cleanup-tmp" -> run("sudo find /tmp -type f -mtime +7 -delete 2>/dev/null; df -h /", "已清理 /tmp 中超过 7 天的临时文件");
            case "restart-docker" -> run("sudo systemctl restart docker", "Docker 服务已重启");
            case "check-ports" -> run("ss -tulnp 2>/dev/null || netstat -tulnp 2>/dev/null || echo '无法读取端口信息'", null);
            case "top-processes" -> run("ps aux --sort=-%mem | head -n 15", null);
            case "update-apt" -> run("sudo apt-get update", "软件源已更新");
            case "docker-status" -> run("docker info 2>/dev/null || sudo docker info 2>/dev/null || echo 'Docker 未安装或无权限'", null);
            default -> throw new IllegalArgumentException("未知操作: " + actionId);
        };
    }

    private SystemStats parseStats(String text) {
        SystemStats stats = new SystemStats();
        String section = "";
        for (String raw : text.split("\\R")) {
            String line = raw.trim();
            if (line.startsWith("===") && line.endsWith("===")) {
                section = line.replace("=", "");
                continue;
            }
            if (line.isEmpty()) {
                continue;
            }
            switch (section) {
                case "HOST" -> stats.setHostname(line);
                case "IP" -> {
                    if ("-".equals(stats.getIpAddress()) || stats.getIpAddress() == null || stats.getIpAddress().isBlank()) {
                        if (line.matches("\\d+\\.\\d+\\.\\d+\\.\\d+")) {
                            stats.setIpAddress(line);
                        }
                    }
                }
                case "OS" -> stats.setOsInfo(line);
                case "UPTIME" -> stats.setUptime(line);
                case "LOAD" -> {
                    String[] parts = line.split("\\s+");
                    if (parts.length >= 3) {
                        stats.setLoad1(parts[0]);
                        stats.setLoad5(parts[1]);
                        stats.setLoad15(parts[2]);
                    }
                }
                case "CPU" -> {
                    try {
                        stats.setCpuPercent(Integer.parseInt(line.replace("%", "")));
                    } catch (NumberFormatException ignored) {
                        stats.setCpuPercent(0);
                    }
                }
                case "MEM" -> applyMem(stats, line, false);
                case "SWAP" -> applyMem(stats, line, true);
                case "DISK" -> {
                    String[] p = line.split("\\|", -1);
                    if (p.length >= 5) {
                        DiskInfo disk = new DiskInfo();
                        disk.setMount(p[0]);
                        disk.setSize(p[1]);
                        disk.setUsed(p[2]);
                        disk.setAvail(p[3]);
                        disk.setUsePercent(p[4]);
                        stats.getDisks().add(disk);
                    }
                }
                case "PS" -> {
                    String[] p = line.split("\\|", -1);
                    if (p.length >= 5) {
                        ProcessInfo ps = new ProcessInfo();
                        ps.setUser(p[0]);
                        ps.setPid(p[1]);
                        ps.setCpu(p[2]);
                        ps.setMem(p[3]);
                        ps.setCommand(p[4]);
                        stats.getTopProcesses().add(ps);
                    }
                }
                default -> {
                }
            }
        }
        return stats;
    }

    private static void applyMem(SystemStats stats, String line, boolean swap) {
        String[] p = line.split("\\|", -1);
        if (p.length < 3) {
            return;
        }
        String used = p[0] + "M";
        String total = p[1] + "M";
        int percent = 0;
        try {
            percent = (int) Double.parseDouble(p[2]);
        } catch (NumberFormatException ignored) {
        }
        if (swap) {
            stats.setSwapDetail(used + " / " + total);
            stats.setSwapPercent(percent);
        } else {
            stats.setMemDetail(used + " / " + total);
            stats.setMemPercent(percent);
        }
    }

    private String run(String command, String successMessage) throws Exception {
        SshClient.CommandResult result = client.exec(command);
        if (!result.ok()) {
            throw new IllegalStateException(result.combined().isBlank() ? "操作失败" : result.combined());
        }
        if (successMessage != null && result.combined().isBlank()) {
            return successMessage;
        }
        if (successMessage != null) {
            return successMessage + "\n\n" + result.combined();
        }
        return result.combined();
    }

    private String runLong(String command, String successMessage) throws Exception {
        SshClient.CommandResult result = client.exec("bash -lc " + shellQuote(command));
        String out = result.combined();
        if (!result.ok()) {
            throw new IllegalStateException(out.isBlank() ? successMessage + "失败" : out);
        }
        return successMessage + "\n\n" + (out.isBlank() ? "(无输出)" : out);
    }

    private static String sanitizeName(String name) {
        String value = name == null || name.isBlank() ? "site" : name.trim().toLowerCase(Locale.ROOT);
        value = value.replaceAll("[^a-z0-9_-]", "-");
        if (value.isBlank()) {
            value = "site";
        }
        return value;
    }

    private static String normalizePath(String path) {
        if (path == null || path.isBlank()) {
            return "/var/www/html";
        }
        String value = path.trim().replace('\\', '/');
        if (!value.startsWith("/")) {
            value = "/" + value;
        }
        return value;
    }

    private static String defaultIndex(String title) {
        return "<!doctype html><html><head><meta charset=utf-8><title>" + title
                + "</title></head><body style='font-family:sans-serif;padding:40px'>"
                + "<h1>张怡 部署成功</h1><p>站点: " + title + "</p></body></html>";
    }

    private static String shellQuote(String value) {
        return "'" + value.replace("'", "'\"'\"'") + "'";
    }
}
