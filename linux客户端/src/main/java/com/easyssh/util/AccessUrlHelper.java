package com.easyssh.util;

import com.easyssh.model.ContainerInfo;
import com.easyssh.model.ServerProfile;

import java.awt.Desktop;
import java.net.URI;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class AccessUrlHelper {
    private static final Pattern MAPPED = Pattern.compile(
            "(?:(?:\\d{1,3}(?:\\.\\d{1,3}){3})|\\[::]|\\*):?(\\d+)->(\\d+)/(tcp|udp)",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern SIMPLE_HOST = Pattern.compile(
            "(?:0\\.0\\.0\\.0|127\\.0\\.0\\.1|\\*|localhost):(\\d+)->(\\d+)/(tcp|udp)",
            Pattern.CASE_INSENSITIVE
    );

    private AccessUrlHelper() {
    }

    public static boolean looksLikeNginx(ContainerInfo info) {
        if (info == null) {
            return false;
        }
        String blob = ((info.getName() == null ? "" : info.getName()) + " "
                + (info.getImage() == null ? "" : info.getImage())).toLowerCase(Locale.ROOT);
        return blob.contains("nginx");
    }

    public static List<String> buildAccessUrls(ServerProfile profile, ContainerInfo info) {
        Set<String> urls = new LinkedHashSet<>();
        if (profile == null || info == null || !info.isRunning()) {
            return List.copyOf(urls);
        }
        String host = profile.getHost();
        if (host == null || host.isBlank()) {
            return List.copyOf(urls);
        }

        String ports = info.getPorts() == null ? "" : info.getPorts();
        List<PortMap> maps = parsePortMaps(ports);

        // 优先 http(s) 常见端口
        maps.sort(Comparator
                .comparingInt((PortMap p) -> priority(p.hostPort()))
                .thenComparingInt(PortMap::hostPort));

        for (PortMap map : maps) {
            if (!"tcp".equalsIgnoreCase(map.protocol())) {
                continue;
            }
            int hp = map.hostPort();
            if (hp == 443 || map.containerPort() == 443) {
                urls.add(hp == 443 ? "https://" + host : "https://" + host + ":" + hp);
            } else {
                urls.add(hp == 80 ? "http://" + host : "http://" + host + ":" + hp);
            }
        }

        // host 网络或未映射端口的 nginx，默认尝试 80
        if (urls.isEmpty() && looksLikeNginx(info)) {
            if (ports.isBlank() || ports.toLowerCase(Locale.ROOT).contains("80/tcp")) {
                urls.add("http://" + host);
            }
        }
        return List.copyOf(urls);
    }

    public static String primaryUrl(ServerProfile profile, ContainerInfo info) {
        List<String> urls = buildAccessUrls(profile, info);
        return urls.isEmpty() ? "" : urls.get(0);
    }

    public static String displayUrls(ServerProfile profile, ContainerInfo info) {
        List<String> urls = buildAccessUrls(profile, info);
        if (urls.isEmpty()) {
            return info != null && info.isRunning() ? "无对外端口" : "-";
        }
        return String.join("  |  ", urls);
    }

    public static void openInBrowser(String url) throws Exception {
        if (url == null || url.isBlank() || "-".equals(url) || url.contains("无对外")) {
            throw new IllegalArgumentException("当前没有可打开的访问地址");
        }
        // 若展示了多个，只打开第一个
        String first = url.split("\\|")[0].trim();
        if (!Desktop.isDesktopSupported() || !Desktop.getDesktop().isSupported(Desktop.Action.BROWSE)) {
            throw new IllegalStateException("当前系统不支持直接打开浏览器");
        }
        Desktop.getDesktop().browse(URI.create(first));
    }

    public static String nginxHostUrl(ServerProfile profile, int listenPort) {
        if (profile == null || profile.getHost() == null || profile.getHost().isBlank()) {
            return "";
        }
        String host = profile.getHost();
        if (listenPort <= 0 || listenPort == 80) {
            return "http://" + host;
        }
        if (listenPort == 443) {
            return "https://" + host;
        }
        return "http://" + host + ":" + listenPort;
    }

    private static List<PortMap> parsePortMaps(String ports) {
        List<PortMap> list = new ArrayList<>();
        if (ports == null || ports.isBlank()) {
            return list;
        }
        Matcher m = MAPPED.matcher(ports);
        while (m.find()) {
            list.add(new PortMap(Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)), m.group(3)));
        }
        if (list.isEmpty()) {
            Matcher s = SIMPLE_HOST.matcher(ports);
            while (s.find()) {
                list.add(new PortMap(Integer.parseInt(s.group(1)), Integer.parseInt(s.group(2)), s.group(3)));
            }
        }
        return list;
    }

    private static int priority(int hostPort) {
        if (hostPort == 80 || hostPort == 443) {
            return 0;
        }
        if (hostPort == 8080 || hostPort == 8443 || hostPort == 8000) {
            return 1;
        }
        return 2;
    }

    private record PortMap(int hostPort, int containerPort, String protocol) {
    }
}
