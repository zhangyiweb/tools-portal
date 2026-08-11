package com.easyssh.service;

import com.easyssh.model.ContainerMigrateMeta;
import com.easyssh.model.MigrateOptions;
import com.easyssh.model.ServerProfile;
import com.easyssh.ssh.SshClient;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.function.Consumer;

/**
 * 整容器迁移：镜像 + 命名卷 + 绑定挂载，经本机中转传到目标服务器后恢复。
 */
public class ContainerMigrateService {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final int LONG_TIMEOUT = 1800;

    private final SshClient source;
    private final Consumer<String> log;

    public ContainerMigrateService(SshClient source, Consumer<String> log) {
        this.source = source;
        this.log = log == null ? s -> {
        } : log;
    }

    public String migrate(String containerIdOrName, ServerProfile targetProfile, MigrateOptions options) throws Exception {
        if (targetProfile == null) {
            throw new IllegalArgumentException("请选择目标服务器");
        }
        if (source.getProfile().getId().equals(targetProfile.getId())
                || (source.getProfile().getHost().equals(targetProfile.getHost())
                && source.getProfile().getPort() == targetProfile.getPort())) {
            throw new IllegalArgumentException("目标服务器不能与当前服务器相同");
        }

        String jobId = UUID.randomUUID().toString().substring(0, 8);
        String workDir = "/tmp/easyssh-migrate-" + jobId;
        String packageRemote = workDir + "/package.tar";
        Path localPackage = Files.createTempFile("easyssh-migrate-", ".tar");

        StringBuilder report = new StringBuilder();
        report.append("开始迁移容器：").append(containerIdOrName).append('\n');
        report.append("源服务器：").append(source.getProfile().displayLabel()).append('\n');
        report.append("目标服务器：").append(targetProfile.displayLabel()).append('\n');

        try (SshClient target = new SshClient(targetProfile)) {
            step("连接目标服务器...");
            target.connect();
            ensureDocker(target);

            step("读取容器配置...");
            JsonObject inspect = inspectContainer(source, containerIdOrName);
            ContainerMigrateMeta meta = buildMeta(inspect, options);
            if (options.getTargetName() != null && !options.getTargetName().isBlank()) {
                meta.setName(sanitizeName(options.getTargetName()));
            }

            boolean wasRunning = isRunning(inspect);
            if (options.isStopSource() && wasRunning) {
                step("停止源容器以保证数据一致...");
                docker(source, "stop " + q(containerIdOrName), 120);
            }

            step("准备打包目录...");
            bash(source, "rm -rf " + q(workDir) + " && mkdir -p " + q(workDir + "/volumes"));

            String migratedImage = "easyssh-mig/" + meta.getName() + ":" + jobId;
            meta.setImage(migratedImage);

            step("提交容器为镜像：" + migratedImage);
            docker(source, "commit " + q(containerIdOrName) + " " + q(migratedImage), LONG_TIMEOUT);

            step("导出镜像（可能较久）...");
            docker(source, "save -o " + q(workDir + "/image.tar") + " " + q(migratedImage), LONG_TIMEOUT);

            if (options.isIncludeVolumes()) {
                step("备份数据卷与挂载目录...");
                backupMounts(source, meta, workDir);
            } else {
                meta.getMounts().clear();
                step("已跳过数据卷备份");
            }

            step("写入迁移元数据...");
            writeRemoteFile(source, workDir + "/meta.json", GSON.toJson(meta));

            step("打包迁移包...");
            bash(source, "tar -C " + q(workDir) + " -cf " + q(packageRemote) + " image.tar meta.json volumes");

            long size = source.fileSize(packageRemote);
            step("迁移包大小：" + humanSize(size) + "，开始下载到本机...");
            source.download(packageRemote, localPackage);
            step("本机已收到迁移包，开始上传到目标服务器...");

            String targetWork = "/tmp/easyssh-migrate-" + jobId;
            String targetPackage = targetWork + "/package.tar";
            bash(target, "rm -rf " + q(targetWork) + " && mkdir -p " + q(targetWork));
            target.upload(localPackage, targetPackage);
            step("目标服务器已接收，开始解包并恢复...");

            bash(target, "tar -C " + q(targetWork) + " -xf " + q(targetPackage));
            docker(target, "load -i " + q(targetWork + "/image.tar"), LONG_TIMEOUT);

            ContainerMigrateMeta targetMeta = GSON.fromJson(
                    readRemoteText(target, targetWork + "/meta.json"),
                    ContainerMigrateMeta.class
            );

            if (options.isIncludeVolumes()) {
                step("恢复数据卷...");
                restoreMounts(target, targetMeta, targetWork);
            }

            step("检查目标是否已有同名容器...");
            SshClient.CommandResult exists = dockerRaw(target, "inspect " + q(targetMeta.getName()));
            if (exists.ok()) {
                step("目标已存在同名容器，先删除旧容器...");
                docker(target, "rm -f " + q(targetMeta.getName()), 120);
            }

            String runCmd = buildRunCommand(targetMeta, options.isStartAfterMigrate());
            step("在目标服务器创建容器...");
            docker(target, runCmd, 180);

            if (options.isRemoveSourceAfterSuccess()) {
                step("按选项删除源容器...");
                docker(source, "rm -f " + q(containerIdOrName), 120);
            } else if (options.isStopSource() && wasRunning) {
                step("重新启动源容器...");
                try {
                    docker(source, "start " + q(containerIdOrName), 120);
                } catch (Exception e) {
                    step("源容器重启失败（可手动处理）：" + e.getMessage());
                }
            }

            step("清理临时文件...");
            bash(source, "rm -rf " + q(workDir));
            bash(target, "rm -rf " + q(targetWork));
            try {
                docker(source, "rmi " + q(migratedImage), 120);
            } catch (Exception ignored) {
            }

            report.append('\n').append("迁移成功！\n");
            report.append("目标容器名：").append(targetMeta.getName()).append('\n');
            report.append("目标镜像：").append(targetMeta.getImage()).append('\n');
            report.append("挂载项数量：").append(targetMeta.getMounts().size()).append('\n');
            report.append("端口映射数量：").append(targetMeta.getPorts().size()).append('\n');
            if (!options.isStartAfterMigrate()) {
                report.append("提示：未自动启动，可到目标服务器容器列表中启动。\n");
            }
            step("全部完成");
            return report.toString();
        } finally {
            try {
                Files.deleteIfExists(localPackage);
            } catch (Exception ignored) {
            }
        }
    }

    private void backupMounts(SshClient client, ContainerMigrateMeta meta, String workDir) throws Exception {
        int bindIndex = 0;
        for (ContainerMigrateMeta.MountMapping mount : meta.getMounts()) {
            String archiveRel;
            if ("volume".equalsIgnoreCase(mount.getType())) {
                String volName = mount.getName();
                archiveRel = "volumes/vol_" + sanitizeName(volName) + ".tgz";
                String archiveAbs = workDir + "/" + archiveRel;
                step("   -  备份命名卷：" + volName);
                String cmd = "docker run --rm -v " + q(volName + ":/from:ro")
                        + " -v " + q(workDir + "/volumes:/backup")
                        + " alpine:3.20 tar czf /backup/" + archiveRel.substring("volumes/".length())
                        + " -C /from .";
                SshClient.CommandResult result = tryDockerThenSudo(client, cmd, LONG_TIMEOUT);
                if (!result.ok()) {
                    // fallback without alpine pull failure message clarity
                    throw new IllegalStateException("备份命名卷失败「" + volName + "」：\n" + result.combined()
                            + "\n请确认源服务器可拉取 alpine:3.20 或本地已有该镜像。");
                }
                mount.setArchive(archiveRel);
            } else if ("bind".equalsIgnoreCase(mount.getType())) {
                archiveRel = "volumes/bind_" + bindIndex++ + ".tgz";
                String archiveAbs = workDir + "/" + archiveRel;
                step("   -  备份绑定目录：" + mount.getSource() + " -> " + mount.getDestination());
                bash(client, "if [ -e " + q(mount.getSource()) + " ]; then "
                        + "tar czf " + q(archiveAbs) + " -C " + q(parentOf(mount.getSource())) + " "
                        + q(fileName(mount.getSource())) + "; "
                        + "else mkdir -p " + q(workDir + "/volumes") + " && tar czf " + q(archiveAbs)
                        + " -C /tmp --files-from /dev/null; fi");
                mount.setArchive(archiveRel);
            } else {
                step("   -  跳过挂载类型：" + mount.getType());
            }
        }
    }

    private void restoreMounts(SshClient client, ContainerMigrateMeta meta, String workDir) throws Exception {
        for (ContainerMigrateMeta.MountMapping mount : meta.getMounts()) {
            if (mount.getArchive() == null || mount.getArchive().isBlank()) {
                continue;
            }
            String archiveAbs = workDir + "/" + mount.getArchive();
            if ("volume".equalsIgnoreCase(mount.getType())) {
                String volName = mount.getName();
                step("   -  恢复命名卷：" + volName);
                docker(client, "volume create " + q(volName), 60);
                String cmd = "docker run --rm -v " + q(volName + ":/to")
                        + " -v " + q(workDir + "/volumes:/backup:ro")
                        + " alpine:3.20 sh -c "
                        + q("tar xzf /backup/" + fileName(mount.getArchive()) + " -C /to");
                SshClient.CommandResult result = tryDockerThenSudo(client, cmd, LONG_TIMEOUT);
                if (!result.ok()) {
                    throw new IllegalStateException("恢复命名卷失败「" + volName + "」：\n" + result.combined());
                }
            } else if ("bind".equalsIgnoreCase(mount.getType())) {
                step("   -  恢复绑定目录：" + mount.getSource());
                bash(client, "mkdir -p " + q(mount.getSource())
                        + " && tar xzf " + q(archiveAbs) + " -C " + q(parentOf(mount.getSource())));
            }
        }
    }

    private ContainerMigrateMeta buildMeta(JsonObject inspect, MigrateOptions options) {
        ContainerMigrateMeta meta = new ContainerMigrateMeta();
        String name = text(inspect, "Name");
        if (name.startsWith("/")) {
            name = name.substring(1);
        }
        meta.setName(sanitizeName(name));

        JsonObject config = obj(inspect, "Config");
        meta.setOriginalImage(text(config, "Image"));
        meta.setWorkingDir(text(config, "WorkingDir"));
        meta.setEnv(stringList(arr(config, "Env")));
        meta.setCmd(stringList(arr(config, "Cmd")));
        meta.setEntrypoint(stringList(arr(config, "Entrypoint")));

        JsonObject host = obj(inspect, "HostConfig");
        JsonObject restart = obj(host, "RestartPolicy");
        String restartName = text(restart, "Name");
        meta.setRestart(restartName.isBlank() ? "no" : restartName);
        meta.setNetworkMode(text(host, "NetworkMode"));

        JsonObject portBindings = obj(host, "PortBindings");
        for (String key : portBindings.keySet()) {
            // key like 80/tcp
            String containerPort = key;
            String protocol = "tcp";
            if (key.contains("/")) {
                String[] parts = key.split("/", 2);
                containerPort = parts[0];
                protocol = parts[1];
            }
            JsonArray bindings = portBindings.getAsJsonArray(key);
            if (bindings == null) {
                continue;
            }
            for (JsonElement el : bindings) {
                if (!el.isJsonObject()) {
                    continue;
                }
                JsonObject b = el.getAsJsonObject();
                ContainerMigrateMeta.PortMapping p = new ContainerMigrateMeta.PortMapping();
                p.setHostIp(text(b, "HostIp"));
                p.setHostPort(text(b, "HostPort"));
                p.setContainerPort(containerPort);
                p.setProtocol(protocol);
                if (!p.getHostPort().isBlank()) {
                    meta.getPorts().add(p);
                }
            }
        }

        JsonArray mounts = arr(inspect, "Mounts");
        for (JsonElement el : mounts) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject m = el.getAsJsonObject();
            ContainerMigrateMeta.MountMapping mount = new ContainerMigrateMeta.MountMapping();
            mount.setType(text(m, "Type"));
            mount.setName(text(m, "Name"));
            mount.setSource(text(m, "Source"));
            mount.setDestination(text(m, "Destination"));
            if (m.has("RW") && !m.get("RW").isJsonNull()) {
                mount.setRw(m.get("RW").getAsBoolean());
            }
            String type = mount.getType().toLowerCase(Locale.ROOT);
            if ("volume".equals(type) || "bind".equals(type)) {
                meta.getMounts().add(mount);
            }
        }
        return meta;
    }

    private String buildRunCommand(ContainerMigrateMeta meta, boolean detachedStart) {
        StringBuilder sb = new StringBuilder();
        if (detachedStart) {
            sb.append("run -d");
        } else {
            sb.append("create");
        }
        sb.append(" --name ").append(q(meta.getName()));
        if (meta.getRestart() != null && !meta.getRestart().isBlank() && !"no".equals(meta.getRestart())) {
            sb.append(" --restart ").append(q(meta.getRestart()));
        }
        if (meta.getNetworkMode() != null && !meta.getNetworkMode().isBlank()
                && !"default".equals(meta.getNetworkMode())
                && !"bridge".equals(meta.getNetworkMode())) {
            // host/none 等保留；自定义网络名可能目标不存在，故仅保留 host/none
            String mode = meta.getNetworkMode();
            if ("host".equals(mode) || "none".equals(mode)) {
                sb.append(" --network ").append(q(mode));
            }
        }
        if (meta.getWorkingDir() != null && !meta.getWorkingDir().isBlank()) {
            sb.append(" -w ").append(q(meta.getWorkingDir()));
        }
        for (ContainerMigrateMeta.PortMapping p : meta.getPorts()) {
            String mapping = p.getHostPort() + ":" + p.getContainerPort();
            if (p.getProtocol() != null && !p.getProtocol().isBlank() && !"tcp".equalsIgnoreCase(p.getProtocol())) {
                mapping = mapping + "/" + p.getProtocol();
            }
            if (p.getHostIp() != null && !p.getHostIp().isBlank()) {
                mapping = p.getHostIp() + ":" + mapping;
            }
            sb.append(" -p ").append(q(mapping));
        }
        for (String env : meta.getEnv()) {
            if (env != null && !env.isBlank()) {
                sb.append(" -e ").append(q(env));
            }
        }
        for (ContainerMigrateMeta.MountMapping m : meta.getMounts()) {
            String dest = m.getDestination();
            String spec;
            if ("volume".equalsIgnoreCase(m.getType())) {
                spec = m.getName() + ":" + dest;
            } else {
                spec = m.getSource() + ":" + dest;
            }
            if (!m.isRw()) {
                spec = spec + ":ro";
            }
            sb.append(" -v ").append(q(spec));
        }
        if (meta.getEntrypoint() != null && !meta.getEntrypoint().isEmpty()) {
            sb.append(" --entrypoint ").append(q(meta.getEntrypoint().get(0)));
        }
        sb.append(' ').append(q(meta.getImage()));
        if (meta.getCmd() != null) {
            for (String c : meta.getCmd()) {
                sb.append(' ').append(q(c));
            }
        }
        return sb.toString();
    }

    private JsonObject inspectContainer(SshClient client, String id) throws Exception {
        SshClient.CommandResult result = dockerRaw(client, "inspect " + q(id));
        if (!result.ok()) {
            throw new IllegalStateException("无法读取容器信息：\n" + result.combined());
        }
        JsonArray arr = JsonParser.parseString(result.stdout()).getAsJsonArray();
        if (arr.isEmpty()) {
            throw new IllegalStateException("未找到容器：" + id);
        }
        return arr.get(0).getAsJsonObject();
    }

    private boolean isRunning(JsonObject inspect) {
        JsonObject state = obj(inspect, "State");
        return state.has("Running") && state.get("Running").getAsBoolean();
    }

    private void ensureDocker(SshClient client) throws Exception {
        SshClient.CommandResult result = dockerRaw(client, "version");
        if (!result.ok()) {
            throw new IllegalStateException("目标服务器 Docker 不可用，请先安装容器引擎。\n" + result.combined());
        }
    }

    private void writeRemoteFile(SshClient client, String remotePath, String content) throws Exception {
        Path tmp = Files.createTempFile("easyssh-meta-", ".json");
        try {
            Files.writeString(tmp, content);
            client.upload(tmp, remotePath);
        } finally {
            Files.deleteIfExists(tmp);
        }
    }

    private String readRemoteText(SshClient client, String remotePath) throws Exception {
        Path tmp = Files.createTempFile("easyssh-meta-read-", ".json");
        try {
            client.download(remotePath, tmp);
            return Files.readString(tmp);
        } finally {
            Files.deleteIfExists(tmp);
        }
    }

    private void docker(SshClient client, String args, int timeout) throws Exception {
        SshClient.CommandResult result = tryDockerThenSudo(client, "docker " + args, timeout);
        if (!result.ok()) {
            throw new IllegalStateException("Docker 命令失败：docker " + args + "\n" + result.combined());
        }
    }

    private SshClient.CommandResult dockerRaw(SshClient client, String args) throws Exception {
        return tryDockerThenSudo(client, "docker " + args, 120);
    }

    private SshClient.CommandResult tryDockerThenSudo(SshClient client, String command, int timeout) throws Exception {
        SshClient.CommandResult result = client.exec(command, timeout);
        if (!result.ok() && result.combined().toLowerCase(Locale.ROOT).contains("permission denied")) {
            result = client.exec("sudo " + command, timeout);
        }
        return result;
    }

    private void bash(SshClient client, String script) throws Exception {
        SshClient.CommandResult result = client.exec("bash -lc " + q(script), LONG_TIMEOUT);
        if (!result.ok()) {
            throw new IllegalStateException("远程命令失败：\n" + result.combined());
        }
    }

    private void step(String message) {
        log.accept(message);
    }

    private static JsonObject obj(JsonObject parent, String key) {
        if (parent == null || !parent.has(key) || parent.get(key).isJsonNull() || !parent.get(key).isJsonObject()) {
            return new JsonObject();
        }
        return parent.getAsJsonObject(key);
    }

    private static JsonArray arr(JsonObject parent, String key) {
        if (parent == null || !parent.has(key) || parent.get(key).isJsonNull() || !parent.get(key).isJsonArray()) {
            return new JsonArray();
        }
        return parent.getAsJsonArray(key);
    }

    private static String text(JsonObject obj, String key) {
        if (obj == null || !obj.has(key) || obj.get(key).isJsonNull()) {
            return "";
        }
        JsonElement el = obj.get(key);
        if (el.isJsonPrimitive()) {
            return el.getAsString();
        }
        return "";
    }

    private static List<String> stringList(JsonArray arr) {
        List<String> list = new ArrayList<>();
        if (arr == null) {
            return list;
        }
        for (JsonElement el : arr) {
            if (el != null && el.isJsonPrimitive()) {
                list.add(el.getAsString());
            }
        }
        return list;
    }

    private static String q(String value) {
        return "'" + String.valueOf(value).replace("'", "'\"'\"'") + "'";
    }

    private static String sanitizeName(String name) {
        String value = name == null ? "container" : name.trim().toLowerCase(Locale.ROOT);
        value = value.replaceAll("[^a-z0-9_.-]", "-");
        if (value.isBlank()) {
            value = "container";
        }
        return value;
    }

    private static String parentOf(String path) {
        int idx = path.lastIndexOf('/');
        if (idx <= 0) {
            return "/";
        }
        return path.substring(0, idx);
    }

    private static String fileName(String path) {
        int idx = path.lastIndexOf('/');
        return idx >= 0 ? path.substring(idx + 1) : path;
    }

    private static String humanSize(long bytes) {
        if (bytes < 1024) {
            return bytes + " B";
        }
        if (bytes < 1024 * 1024) {
            return String.format("%.1f KB", bytes / 1024.0);
        }
        if (bytes < 1024L * 1024 * 1024) {
            return String.format("%.1f MB", bytes / (1024.0 * 1024));
        }
        return String.format("%.2f GB", bytes / (1024.0 * 1024 * 1024));
    }
}
