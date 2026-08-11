package com.easyssh.service;

import com.easyssh.model.ContainerInfo;
import com.easyssh.ssh.SshClient;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class DockerService {
    private final SshClient client;

    public DockerService(SshClient client) {
        this.client = client;
    }

    public List<ContainerInfo> listContainers() throws Exception {
        String format = "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}|{{.CreatedAt}}";
        SshClient.CommandResult result = docker("ps -a --format \"" + format + "\"");
        if (!result.ok() && looksMissing(result.combined())) {
            throw new IllegalStateException("服务器上未找到 Docker，请先到「一键部署」页安装。");
        }
        if (!result.ok()) {
            throw new IllegalStateException(blankToDefault(result.combined(), "获取容器列表失败"));
        }

        List<ContainerInfo> list = new ArrayList<>();
        for (String line : result.stdout().split("\\R")) {
            if (line.isBlank()) {
                continue;
            }
            String[] parts = line.split("\\|", -1);
            if (parts.length < 6) {
                continue;
            }
            ContainerInfo info = new ContainerInfo();
            info.setId(parts[0].trim());
            info.setName(parts[1].trim());
            info.setImage(parts[2].trim());
            info.setStatus(parts[3].trim());
            info.setPorts(parts[4].trim());
            info.setCreated(parts[5].trim());
            list.add(info);
        }
        return list;
    }

    public List<String> listImages() throws Exception {
        SshClient.CommandResult result = docker("images --format \"{{.Repository}}:{{.Tag}}|{{.ID}}|{{.Size}}\"");
        if (!result.ok()) {
            throw new IllegalStateException(blankToDefault(result.combined(), "获取镜像列表失败"));
        }
        List<String> images = new ArrayList<>();
        for (String line : result.stdout().split("\\R")) {
            if (!line.isBlank()) {
                images.add(line.trim());
            }
        }
        return images;
    }

    public String pullImage(String image) throws Exception {
        String name = image == null ? "" : image.trim();
        if (name.isEmpty()) {
            throw new IllegalArgumentException("请填写镜像名，例如 nginx:latest");
        }
        SshClient.CommandResult result = docker("pull " + quote(name), 900);
        if (!result.ok()) {
            throw new IllegalStateException(blankToDefault(result.combined(), "拉取镜像失败"));
        }
        return "镜像拉取完成: " + name + "\n\n" + blankToDefault(result.combined(), "");
    }

    public String removeImage(String image) throws Exception {
        String name = require(image, "镜像名");
        SshClient.CommandResult result = docker("rmi -f " + quote(name), 180);
        if (!result.ok()) {
            throw new IllegalStateException(blankToDefault(result.combined(), "删除镜像失败（可能仍被容器使用）"));
        }
        return "镜像已删除：" + name + "\n\n" + blankToDefault(result.combined(), "");
    }

    public boolean hasImage(String image) throws Exception {
        String name = require(image, "镜像名");
        SshClient.CommandResult result = docker("image inspect " + quote(name), 60);
        return result.ok();
    }

    public String ensureImage(String image, java.util.function.Consumer<String> progress) throws Exception {
        String name = require(image, "镜像名");
        if (hasImage(name)) {
            if (progress != null) {
                progress.accept("本地已有镜像 " + name + "，跳过拉取");
            }
            return "本地已有镜像：" + name;
        }
        if (progress != null) {
            progress.accept("正在拉取镜像 " + name + "（首次可能较慢，请稍候）...");
        }
        return pullImage(name);
    }

    public String runImage(String image, String name, String ports, String extraArgs) throws Exception {
        return runImage(image, name, ports, null, null, extraArgs);
    }

    public String runImage(String image, String name, String ports, String volumeName, String mountPath, String extraArgs) throws Exception {
        return runImage(image, name, ports, volumeName, mountPath, extraArgs, null);
    }

    public String runImage(String image, String name, String ports, String volumeName, String mountPath,
                           String extraArgs, String commandAfterImage) throws Exception {
        String img = require(image, "镜像名");
        StringBuilder cmd = new StringBuilder("run -d");
        if (name != null && !name.isBlank()) {
            cmd.append(" --name ").append(quote(name.trim()));
        }
        if (ports != null && !ports.isBlank()) {
            for (String p : ports.split("[,\\s]+")) {
                if (!p.isBlank()) {
                    cmd.append(" -p ").append(quote(p.trim()));
                }
            }
        }
        if (volumeName != null && !volumeName.isBlank()) {
            String path = (mountPath == null || mountPath.isBlank()) ? "/data" : mountPath.trim();
            cmd.append(" -v ").append(quote(volumeName.trim() + ":" + path));
        }
        if (extraArgs != null && !extraArgs.isBlank()) {
            cmd.append(' ').append(extraArgs.trim());
        }
        cmd.append(' ').append(quote(img));
        if (commandAfterImage != null && !commandAfterImage.isBlank()) {
            cmd.append(' ').append(commandAfterImage.trim());
        }
        SshClient.CommandResult result = docker(cmd.toString());
        if (!result.ok()) {
            throw new IllegalStateException(blankToDefault(result.combined(), "启动容器失败"));
        }
        String tip = "容器已启动";
        if (volumeName != null && !volumeName.isBlank()) {
            tip += "\n已绑定数据卷：" + volumeName.trim() + " -> " + (mountPath == null || mountPath.isBlank() ? "/data" : mountPath.trim());
        }
        return tip + "\n\n" + blankToDefault(result.combined(), "");
    }

    public List<com.easyssh.model.VolumeInfo> listVolumes() throws Exception {
        SshClient.CommandResult result = docker("volume ls --format \"{{.Name}}|{{.Driver}}|{{.Mountpoint}}\"");
        if (!result.ok() && looksMissing(result.combined())) {
            throw new IllegalStateException("服务器上未找到 Docker，请先到「一键部署」页安装。");
        }
        if (!result.ok()) {
            throw new IllegalStateException(blankToDefault(result.combined(), "获取数据卷列表失败"));
        }
        List<com.easyssh.model.VolumeInfo> list = new ArrayList<>();
        for (String line : result.stdout().split("\\R")) {
            if (line.isBlank()) {
                continue;
            }
            String[] parts = line.split("\\|", -1);
            if (parts.length < 2) {
                continue;
            }
            com.easyssh.model.VolumeInfo info = new com.easyssh.model.VolumeInfo();
            info.setName(parts[0].trim());
            info.setDriver(parts[1].trim());
            info.setMountpoint(parts.length > 2 ? parts[2].trim() : "");
            list.add(info);
        }
        return list;
    }

    public String createVolume(String name) throws Exception {
        String vol = require(name, "数据卷名称");
        if (!vol.matches("[a-zA-Z0-9][a-zA-Z0-9_.-]*")) {
            throw new IllegalArgumentException("数据卷名称只能包含字母、数字、下划线、点、短横线，且不能以特殊符号开头");
        }
        SshClient.CommandResult result = docker("volume create " + quote(vol));
        String combined = blankToDefault(result.combined(), "");
        if (!result.ok() && !combined.toLowerCase(Locale.ROOT).contains("already exists")) {
            throw new IllegalStateException(blankToDefault(combined, "创建数据卷失败"));
        }
        if (combined.toLowerCase(Locale.ROOT).contains("already exists") || result.stdout().trim().equals(vol)) {
            return "数据卷已就绪：" + vol;
        }
        return "数据卷已创建：" + vol + "\n\n" + combined;
    }

    public String removeVolume(String name) throws Exception {
        String vol = require(name, "数据卷名称");
        SshClient.CommandResult result = docker("volume rm " + quote(vol));
        if (!result.ok()) {
            throw new IllegalStateException(blankToDefault(result.combined(), "删除数据卷失败（可能仍被容器使用）"));
        }
        return "数据卷已删除：" + vol;
    }

    /**
     * 上传 ZIP 到数据卷根目录并解压（用于静态网站部署）。
     */
    public String uploadZipToVolume(String volumeName, java.nio.file.Path localZip) throws Exception {
        String vol = require(volumeName, "数据卷名称");
        if (localZip == null || !java.nio.file.Files.isRegularFile(localZip)) {
            throw new IllegalArgumentException("请选择 ZIP 文件");
        }
        String fileName = localZip.getFileName().toString().toLowerCase(Locale.ROOT);
        if (!fileName.endsWith(".zip")) {
            throw new IllegalArgumentException("请选择 .zip 压缩包");
        }

        String job = java.util.UUID.randomUUID().toString().substring(0, 8);
        String remoteTmpDir = "/tmp/easyssh-zip-" + job;
        String remoteTmpFile = remoteTmpDir + "/" + localZip.getFileName();

        client.exec("mkdir -p " + quote(remoteTmpDir), 60);
        try {
            client.upload(localZip, remoteTmpFile);
            String script = "apk add --no-cache unzip >/dev/null"
                    + " && mkdir -p /data"
                    + " && unzip -o /upload/" + localZip.getFileName() + " -d /data"
                    + " && ls -lah /data";
            String cmd = "run --rm"
                    + " -v " + quote(vol + ":/data")
                    + " -v " + quote(remoteTmpDir + ":/upload:ro")
                    + " alpine:3.20 sh -c " + quote(script);
            SshClient.CommandResult result = docker(cmd, 600);
            if (!result.ok()) {
                throw new IllegalStateException(blankToDefault(result.combined(), "解压 ZIP 到数据卷失败"));
            }
            return "已解压到数据卷「" + vol + "」\n文件：" + localZip.getFileName()
                    + "\n\n目录内容：\n" + blankToDefault(result.combined(), "");
        } finally {
            client.exec("rm -rf " + quote(remoteTmpDir), 60);
        }
    }

    /**
     * 一键部署静态站：nginx 容器 + 主机端口:80 + 数据卷挂到网站目录。
     */
    public String deployNginxSite(String siteName, String volumeName, int hostPort) throws Exception {
        return deployNginxSite(siteName, volumeName, hostPort, null);
    }

    public String deployNginxSite(String siteName, String volumeName, int hostPort,
                                  java.util.function.Consumer<String> progress) throws Exception {
        return deploySite(siteName, "nginx:latest", volumeName, hostPort, progress);
    }

    public String deploySite(String siteName, String image, String volumeName, int hostPort,
                             java.util.function.Consumer<String> progress) throws Exception {
        String name = require(siteName, "站点名称");
        if (!name.matches("[a-zA-Z0-9][a-zA-Z0-9_.-]{0,62}")) {
            throw new IllegalArgumentException("站点名称只能包含字母、数字、下划线、点和短横线，并以字母或数字开头");
        }
        if (hostPort < 1 || hostPort > 65535) {
            throw new IllegalArgumentException("访问端口需在 1~65535 之间");
        }
        String img = require(image, "镜像");
        String vol = require(volumeName, "数据卷");
        String mountPath = webRootForImage(img);
        step(progress, "1/3 清理同名容器（如有）...");
        docker("rm -f " + quote(name), 60);
        step(progress, "2/3 准备镜像 " + img + " ...");
        ensureImage(img, progress);
        step(progress, "3/3 启动容器并映射端口 " + hostPort + ":80 ...");
        String ports = hostPort + ":80";
        String result = runImage(img, name, ports, vol, mountPath, null);
        return "静态站点已部署\n容器：" + name + "\n镜像：" + img
                + "\n端口映射：主机 " + hostPort + " -> 容器 80\n数据卷：" + vol
                + " -> " + mountPath + "\n\n" + result;
    }

    /**
     * 一键部署后端：按镜像拉取并运行容器，映射端口，可选环境变量。
     */
    public String deployBackend(String appName, String image, int hostPort, int containerPort,
                                java.util.Map<String, String> env,
                                java.util.function.Consumer<String> progress) throws Exception {
        String name = require(appName, "应用名称");
        if (!name.matches("[a-zA-Z0-9][a-zA-Z0-9_.-]{0,62}")) {
            throw new IllegalArgumentException("应用名称只能包含字母、数字、下划线、点和短横线，并以字母或数字开头");
        }
        if (hostPort < 1 || hostPort > 65535 || containerPort < 1 || containerPort > 65535) {
            throw new IllegalArgumentException("端口需在 1~65535 之间");
        }
        String img = require(image, "镜像");
        step(progress, "1/3 停止旧容器（如有）...");
        docker("rm -f " + quote(name), 60);
        step(progress, "2/3 准备镜像 " + img + " ...");
        ensureImage(img, progress);
        step(progress, "3/3 启动容器并映射端口 " + hostPort + ":" + containerPort + " ...");
        StringBuilder extra = new StringBuilder("--restart unless-stopped");
        appendEnvFlags(extra, env);
        String ports = hostPort + ":" + containerPort;
        String result = runImage(img, name, ports, null, null, extra.toString());
        return "后端已部署\n容器：" + name + "\n镜像：" + img
                + "\n端口映射：主机 " + hostPort + " -> 容器 " + containerPort + "\n\n" + result;
    }

    /**
     * 上传 JAR 并用 Java 镜像运行：挂载 jar → java -jar。
     */
    public String deployBackendJar(String appName, java.nio.file.Path localJar, int hostPort,
                                   String javaImage, java.util.Map<String, String> env,
                                   java.util.function.Consumer<String> progress) throws Exception {
        String name = require(appName, "应用名称");
        if (!name.matches("[a-zA-Z0-9][a-zA-Z0-9_.-]{0,62}")) {
            throw new IllegalArgumentException("应用名称只能包含字母、数字、下划线、点和短横线，并以字母或数字开头");
        }
        if (hostPort < 1 || hostPort > 65535) {
            throw new IllegalArgumentException("端口需在 1~65535 之间");
        }
        if (localJar == null || !java.nio.file.Files.isRegularFile(localJar)) {
            throw new IllegalArgumentException("请选择 JAR 文件");
        }
        String fileName = localJar.getFileName().toString().toLowerCase(Locale.ROOT);
        if (!fileName.endsWith(".jar")) {
            throw new IllegalArgumentException("请选择 .jar 包");
        }
        String img = (javaImage == null || javaImage.isBlank()) ? "eclipse-temurin:17-jre" : javaImage.trim();
        String remoteDir = "/opt/easyssh-backends/" + name;
        String remoteJar = remoteDir + "/app.jar";

        step(progress, "1/4 停止旧容器（如有）...");
        docker("rm -f " + quote(name), 60);

        step(progress, "2/4 上传 JAR 到服务器 " + remoteJar + " ...");
        client.exec("mkdir -p " + quote(remoteDir), 60);
        client.upload(localJar, remoteJar);

        step(progress, "3/4 准备 Java 镜像 " + img + " ...");
        ensureImage(img, progress);

        step(progress, "4/4 启动容器并映射端口 " + hostPort + ":" + hostPort + " ...");
        StringBuilder extra = new StringBuilder("--restart unless-stopped");
        extra.append(" -v ").append(quote(remoteJar + ":/app/app.jar:ro"));
        java.util.Map<String, String> merged = new java.util.LinkedHashMap<>();
        if (env != null) {
            merged.putAll(env);
        }
        merged.putIfAbsent("SERVER_PORT", String.valueOf(hostPort));
        merged.putIfAbsent("PORT", String.valueOf(hostPort));
        appendEnvFlags(extra, merged);
        String ports = hostPort + ":" + hostPort;
        String command = "java -jar /app/app.jar";
        String result = runImage(img, name, ports, null, null, extra.toString(), command);
        return "后端 JAR 已部署\n容器：" + name + "\nJAR：" + localJar.getFileName()
                + "\n远程路径：" + remoteJar + "\nJava 镜像：" + img
                + "\n端口映射：主机 " + hostPort + " -> 容器 " + hostPort + "\n\n" + result;
    }

    /**
     * 上传 Node 项目 ZIP：解压后用 Node 镜像安装依赖并启动。
     */
    public String deployNodeZip(String appName, java.nio.file.Path localZip, int hostPort,
                                String nodeImage, String startCommand,
                                java.util.Map<String, String> env,
                                java.util.function.Consumer<String> progress) throws Exception {
        String name = require(appName, "应用名称");
        if (!name.matches("[a-zA-Z0-9][a-zA-Z0-9_.-]{0,62}")) {
            throw new IllegalArgumentException("应用名称只能包含字母、数字、下划线、点和短横线，并以字母或数字开头");
        }
        if (hostPort < 1 || hostPort > 65535) {
            throw new IllegalArgumentException("端口需在 1~65535 之间");
        }
        if (localZip == null || !java.nio.file.Files.isRegularFile(localZip)) {
            throw new IllegalArgumentException("请选择 ZIP 文件");
        }
        String fileName = localZip.getFileName().toString().toLowerCase(Locale.ROOT);
        if (!fileName.endsWith(".zip")) {
            throw new IllegalArgumentException("请选择 .zip 压缩包（内含 package.json 的 Node 项目）");
        }
        String img = (nodeImage == null || nodeImage.isBlank()) ? "node:20" : nodeImage.trim();
        String start = (startCommand == null || startCommand.isBlank()) ? "npm start" : startCommand.trim();
        String remoteDir = "/opt/easyssh-node/" + name;
        String remoteZipDir = "/tmp/easyssh-node-" + java.util.UUID.randomUUID().toString().substring(0, 8);
        String remoteZip = remoteZipDir + "/" + localZip.getFileName();

        step(progress, "1/5 停止旧容器（如有）...");
        docker("rm -f " + quote(name), 60);

        step(progress, "2/5 上传并解压 Node 项目 ZIP ...");
        client.exec("mkdir -p " + quote(remoteZipDir) + " " + quote(remoteDir), 60);
        try {
            client.upload(localZip, remoteZip);
            String script = "set -e"
                    + " && apk add --no-cache unzip >/dev/null"
                    + " && rm -rf /work && mkdir -p /work"
                    + " && unzip -o /upload/" + localZip.getFileName() + " -d /work"
                    + " && SRC=/work"
                    + " && if [ ! -f /work/package.json ]; then"
                    + "   SRC=$(find /work -mindepth 1 -maxdepth 1 -type d | head -n 1);"
                    + "   if [ -z \"$SRC\" ] || [ ! -f \"$SRC/package.json\" ]; then"
                    + "     echo 'ZIP 中未找到 package.json' >&2; exit 1;"
                    + "   fi;"
                    + " fi"
                    + " && find /data -mindepth 1 -maxdepth 1 -exec rm -rf {} +"
                    + " && cp -a \"$SRC\"/. /data/"
                    + " && ls -lah /data";
            String cmd = "run --rm"
                    + " -v " + quote(remoteDir + ":/data")
                    + " -v " + quote(remoteZipDir + ":/upload:ro")
                    + " alpine:3.20 sh -c " + quote(script);
            SshClient.CommandResult unzip = docker(cmd, 600);
            if (!unzip.ok()) {
                throw new IllegalStateException(blankToDefault(unzip.combined(), "解压 Node 项目失败"));
            }
            step(progress, blankToDefault(unzip.combined(), "解压完成"));
        } finally {
            client.exec("rm -rf " + quote(remoteZipDir), 60);
        }

        step(progress, "3/5 准备 Node 镜像 " + img + " ...");
        ensureImage(img, progress);

        step(progress, "4/5 启动容器（npm install + 启动命令）...");
        StringBuilder extra = new StringBuilder("--restart unless-stopped -w /app");
        extra.append(" -v ").append(quote(remoteDir + ":/app"));
        java.util.Map<String, String> merged = new java.util.LinkedHashMap<>();
        if (env != null) {
            merged.putAll(env);
        }
        merged.putIfAbsent("PORT", String.valueOf(hostPort));
        merged.putIfAbsent("NODE_ENV", "production");
        appendEnvFlags(extra, merged);
        String ports = hostPort + ":" + hostPort;
        String shellCmd = "if [ -f package.json ]; then npm install --omit=dev; fi; exec " + start;
        String command = "sh -c " + quote(shellCmd);
        String result = runImage(img, name, ports, null, null, extra.toString(), command);

        step(progress, "5/5 完成");
        return "Node 项目已部署\n容器：" + name + "\nZIP：" + localZip.getFileName()
                + "\n远程目录：" + remoteDir + "\nNode 镜像：" + img
                + "\n启动命令：" + start
                + "\n端口映射：主机 " + hostPort + " -> 容器 " + hostPort + "\n\n" + result;
    }

    private static void appendEnvFlags(StringBuilder extra, java.util.Map<String, String> env) {
        if (env == null || extra == null) {
            return;
        }
        for (var entry : env.entrySet()) {
            String key = entry.getKey() == null ? "" : entry.getKey().trim();
            if (key.isEmpty()) {
                continue;
            }
            String value = entry.getValue() == null ? "" : entry.getValue();
            extra.append(" -e ").append(quote(key + "=" + value));
        }
    }

    private static String webRootForImage(String image) {
        String lower = image == null ? "" : image.toLowerCase(Locale.ROOT);
        if (lower.contains("httpd") || lower.contains("apache")) {
            return "/usr/local/apache2/htdocs";
        }
        if (lower.contains("caddy")) {
            return "/usr/share/caddy";
        }
        return "/usr/share/nginx/html";
    }

    private static void step(java.util.function.Consumer<String> progress, String message) {
        if (progress != null) {
            progress.accept(message);
        }
    }

    public String start(String idOrName) throws Exception {
        return runDocker("start", idOrName);
    }

    public String stop(String idOrName) throws Exception {
        return runDocker("stop", idOrName);
    }

    public String restart(String idOrName) throws Exception {
        return runDocker("restart", idOrName);
    }

    public String remove(String idOrName) throws Exception {
        return runDocker("rm -f", idOrName);
    }

    public String logs(String idOrName, int lines) throws Exception {
        SshClient.CommandResult result = docker("logs --tail " + lines + " " + quote(idOrName) + " 2>&1");
        return blankToDefault(result.combined(), "(无日志输出)");
    }

    private String runDocker(String action, String idOrName) throws Exception {
        SshClient.CommandResult result = docker(action + " " + quote(idOrName));
        if (!result.ok()) {
            throw new IllegalStateException(blankToDefault(result.combined(), "操作失败: docker " + action));
        }
        return blankToDefault(result.combined(), "完成: docker " + action + " " + idOrName);
    }

    private SshClient.CommandResult docker(String args) throws Exception {
        return docker(args, 300);
    }

    private SshClient.CommandResult docker(String args, int timeoutSeconds) throws Exception {
        SshClient.CommandResult result = client.exec("docker " + args, timeoutSeconds);
        if (!result.ok() && result.combined().toLowerCase(Locale.ROOT).contains("permission denied")) {
            result = client.exec("sudo docker " + args, timeoutSeconds);
        }
        return result;
    }

    private static boolean looksMissing(String text) {
        String lower = text == null ? "" : text.toLowerCase(Locale.ROOT);
        return lower.contains("not found") || lower.contains("command not found") || lower.contains("no such file");
    }

    private static String require(String value, String label) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("请填写" + label);
        }
        return value.trim();
    }

    private static String quote(String value) {
        return "'" + value.replace("'", "'\"'\"'") + "'";
    }

    private static String blankToDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
