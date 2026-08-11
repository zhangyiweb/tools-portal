package com.easyssh.ui.panels;

import com.easyssh.service.DockerService;
import com.easyssh.ui.UiSupport;
import com.easyssh.ui.theme.AppTheme;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import javax.swing.BorderFactory;
import javax.swing.JComboBox;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import javax.swing.JTextField;
import javax.swing.SwingWorker;
import javax.swing.table.DefaultTableModel;
import java.awt.BorderLayout;
import java.awt.FlowLayout;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 镜像管理：仅拉取 / 删除 / 查看本地镜像；运行容器请到「一键部署」。
 */
public class ImagePanel extends JPanel {
    private static final Map<String, String> PRESET_REPOS;
    private static final Map<String, List<String>> FALLBACK_TAGS;

    static {
        Map<String, String> presets = new java.util.LinkedHashMap<>();
        presets.put("网页服务器 nginx", "nginx");
        presets.put("数据库 mysql", "mysql");
        presets.put("缓存 redis", "redis");
        presets.put("运行环境 node", "node");
        presets.put("数据库 postgres", "postgres");
        presets.put("Java 运行时 eclipse-temurin", "eclipse-temurin");
        presets.put("基础镜像 alpine", "alpine");
        PRESET_REPOS = java.util.Collections.unmodifiableMap(presets);

        Map<String, List<String>> fallbacks = new java.util.LinkedHashMap<>();
        fallbacks.put("nginx", List.of("latest", "mainline", "stable", "1.31", "1.30", "1.29", "alpine", "1.31-alpine", "1.30-alpine"));
        fallbacks.put("mysql", List.of("latest", "9.4", "9.3", "8.4", "8.0"));
        fallbacks.put("redis", List.of("latest", "8", "8.0", "7", "7.4", "alpine", "8-alpine"));
        fallbacks.put("node", List.of("latest", "24", "22", "20", "24-alpine", "22-alpine", "20-alpine"));
        fallbacks.put("postgres", List.of("latest", "17", "16", "15", "17-alpine", "16-alpine"));
        fallbacks.put("eclipse-temurin", List.of("latest", "25-jre", "21-jre", "17-jre", "25-jdk", "21-jdk", "17-jdk"));
        fallbacks.put("alpine", List.of("latest", "3.22", "3.21", "3.20"));
        FALLBACK_TAGS = java.util.Collections.unmodifiableMap(fallbacks);
    }

    private final JComboBox<String> imagePreset = new JComboBox<>();
    private final JComboBox<String> versionCombo = new JComboBox<>();
    private final JTextField customRepoField = new JTextField(18);
    private final JLabel fullNameLabel = AppTheme.muted("将拉取：-");
    private final JPanel customRepoRow = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));
    private final JPanel versionRow = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));

    private final DefaultTableModel imageModel = new DefaultTableModel(new Object[]{"镜像名称", "编号", "大小"}, 0) {
        @Override
        public boolean isCellEditable(int row, int column) {
            return false;
        }
    };
    private final JTable imageTable = new JTable(imageModel);

    private DockerService docker;
    private OutputConsumer outputConsumer;
    private int tagRequestId;

    public interface OutputConsumer {
        void show(String title, String content);
    }

    public ImagePanel() {
        setLayout(new BorderLayout(12, 12));
        setBackground(AppTheme.BG);
        setBorder(BorderFactory.createEmptyBorder(14, 14, 14, 14));

        JLabel title = AppTheme.title("镜像管理", 17f);
        JLabel tip = AppTheme.muted("只负责拉取镜像；启动容器请到「一键部署」");

        JPanel titleBox = new JPanel(new BorderLayout(0, 2));
        titleBox.setOpaque(false);
        titleBox.add(title, BorderLayout.NORTH);
        titleBox.add(tip, BorderLayout.SOUTH);

        for (String name : PRESET_REPOS.keySet()) {
            imagePreset.addItem(name);
        }
        imagePreset.addItem("自定义...");

        versionCombo.setEditable(true);
        versionCombo.setPreferredSize(new java.awt.Dimension(220, 30));
        versionRow.setOpaque(false);
        versionRow.add(versionCombo);
        versionRow.add(UiSupport.button("刷新版本", this::reloadTags));

        customRepoRow.setOpaque(false);
        customRepoRow.add(customRepoField);
        customRepoRow.add(AppTheme.muted("例如 library/nginx 或 ghcr.io/org/app"));

        JPanel form = new JPanel(new GridBagLayout());
        form.setOpaque(false);
        GridBagConstraints c = new GridBagConstraints();
        c.insets = new Insets(6, 4, 6, 4);
        c.fill = GridBagConstraints.HORIZONTAL;
        c.weightx = 1;

        int row = 0;
        addForm(form, c, row++, "常用镜像", imagePreset);
        addForm(form, c, row++, "镜像仓库", customRepoRow);
        addForm(form, c, row++, "选择版本", versionRow);
        addForm(form, c, row, " ", fullNameLabel);

        JPanel actions = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 8));
        actions.setOpaque(false);
        actions.add(UiSupport.primaryButton("拉取镜像", this::pullImage));
        actions.add(UiSupport.button("刷新本地列表", this::refreshImages));
        actions.add(UiSupport.dangerButton("删除镜像", this::removeImage));

        AppTheme.styleTable(imageTable);
        JScrollPane scroll = new JScrollPane(imageTable);
        scroll.setBorder(AppTheme.cardBorder("本地镜像列表（选中后可删除）"));

        JPanel north = new JPanel(new BorderLayout(8, 10));
        north.setOpaque(false);
        north.add(titleBox, BorderLayout.NORTH);
        north.add(form, BorderLayout.CENTER);
        north.add(actions, BorderLayout.SOUTH);

        add(north, BorderLayout.NORTH);
        add(scroll, BorderLayout.CENTER);

        imagePreset.addActionListener(e -> onPresetChanged());
        versionCombo.addActionListener(e -> updateFullNameLabel());
        customRepoField.getDocument().addDocumentListener(new SimpleDocListener(this::updateFullNameLabel));
        // 可编辑下拉：输入时同步「将拉取」预览
        java.awt.Component editorComp = versionCombo.getEditor().getEditorComponent();
        if (editorComp instanceof JTextField editorField) {
            editorField.getDocument().addDocumentListener(new SimpleDocListener(this::updateFullNameLabel));
        }

        if (imagePreset.getItemCount() > 0) {
            imagePreset.setSelectedIndex(0);
            onPresetChanged();
        }
    }

    public void setOutputConsumer(OutputConsumer outputConsumer) {
        this.outputConsumer = outputConsumer;
    }

    public void bind(DockerService docker) {
        this.docker = docker;
        refreshImages();
    }

    public void clear() {
        this.docker = null;
        imageModel.setRowCount(0);
        customRepoField.setText("");
        updateFullNameLabel();
    }

    private void onPresetChanged() {
        boolean custom = isCustomPreset();
        customRepoRow.setVisible(custom);
        if (!custom) {
            customRepoField.setText("");
        }
        revalidate();
        repaint();
        reloadTags();
        updateFullNameLabel();
    }

    private boolean isCustomPreset() {
        String selected = String.valueOf(imagePreset.getSelectedItem());
        return selected != null && selected.startsWith("自定义");
    }

    private String currentRepo() {
        if (isCustomPreset()) {
            return customRepoField.getText().trim();
        }
        String selected = String.valueOf(imagePreset.getSelectedItem());
        return PRESET_REPOS.getOrDefault(selected, "");
    }

    private String currentTag() {
        // 优先读编辑框里正在输入的内容（不要回落到旧的 selectedItem）
        java.awt.Component editorComp = versionCombo.getEditor().getEditorComponent();
        if (editorComp instanceof JTextField editorField) {
            String typed = editorField.getText() == null ? "" : editorField.getText().trim();
            if (!typed.isEmpty()) {
                return typed;
            }
        }
        Object item = versionCombo.getEditor().getItem();
        if (item != null && !String.valueOf(item).isBlank()) {
            return String.valueOf(item).trim();
        }
        item = versionCombo.getSelectedItem();
        String tag = item == null ? "" : String.valueOf(item).trim();
        return tag.isEmpty() ? "latest" : tag;
    }

    private String fullImageName() {
        String repo = currentRepo();
        if (repo.isEmpty()) {
            return "";
        }
        // 自定义已带 tag 时不再拼接
        if (isCustomPreset() && repo.contains(":")) {
            return repo;
        }
        return repo + ":" + currentTag();
    }

    private void updateFullNameLabel() {
        String full = fullImageName();
        fullNameLabel.setText(full.isBlank() ? "将拉取：-" : ("将拉取：" + full));
    }

    private void pullImage() {
        if (docker == null) {
            UiSupport.showInfo(this, "提示", "请先连接服务器");
            return;
        }
        String full = fullImageName();
        if (full.isBlank()) {
            UiSupport.showInfo(this, "提示", isCustomPreset() ? "请填写镜像仓库名" : "请选择镜像");
            return;
        }
        String repo = currentRepo();
        String tag = currentTag();
        if (isCustomPreset() && repo.contains(":")) {
            int colon = repo.lastIndexOf(':');
            tag = repo.substring(colon + 1).trim();
            repo = repo.substring(0, colon).trim();
        }
        final String image = full;
        final String checkRepo = repo;
        final String checkTag = tag;

        UiSupport.runAsync(this, "拉取镜像", () -> {
            if (isDockerHubRepo(checkRepo)) {
                boolean exists = hubTagExists(hubRepositoryPath(checkRepo), checkTag);
                if (!exists) {
                    throw new IllegalArgumentException("找不到版本「" + checkTag + "」\n镜像：" + checkRepo
                            + "\n请确认版本号是否正确，或点「刷新版本」从列表中选择。");
                }
            }
            return docker.pullImage(image);
        }, result -> {
            if (outputConsumer != null) {
                outputConsumer.show("拉取镜像", result);
            } else {
                UiSupport.showTextDialog(this, "拉取镜像", result);
            }
            refreshImages();
        });
    }

    private static boolean isDockerHubRepo(String repo) {
        if (repo == null || repo.isBlank()) {
            return false;
        }
        String lower = repo.toLowerCase(Locale.ROOT);
        // 带其他仓库域名的不走 Hub 校验
        if (lower.contains(".") && !lower.startsWith("docker.io/")) {
            return false;
        }
        return true;
    }

    private static boolean hubTagExists(String hubRepoPath, String tag) throws Exception {
        if (hubRepoPath == null || hubRepoPath.isBlank() || tag == null || tag.isBlank()) {
            return false;
        }
        String encodedRepo = URLEncoder.encode(hubRepoPath, StandardCharsets.UTF_8).replace("%2F", "/");
        String encodedTag = URLEncoder.encode(tag.trim(), StandardCharsets.UTF_8);
        String url = "https://hub.docker.com/v2/repositories/" + encodedRepo + "/tags/" + encodedTag + "/";

        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(8))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(12))
                .header("Accept", "application/json")
                .header("User-Agent", "easy-ssh/1.0")
                .GET()
                .build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() == 404) {
            return false;
        }
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            // 网络/限流时不误判为不存在，交给 docker pull 再报错
            return true;
        }
        return true;
    }

    private void reloadTags() {
        String repo = currentRepo();
        int requestId = ++tagRequestId;
        if (repo.isEmpty() || (isCustomPreset() && repo.contains(":"))) {
            setVersionItems(List.of("latest"), "latest");
            return;
        }

        String hubName = hubRepositoryPath(repo);
        List<String> fallback = FALLBACK_TAGS.getOrDefault(simpleRepoName(repo), List.of("latest"));
        setVersionItems(fallback, "latest");
        versionCombo.setEnabled(false);

        new SwingWorker<List<String>, Void>() {
            @Override
            protected List<String> doInBackground() {
                try {
                    return fetchDockerHubTags(hubName);
                } catch (Exception ex) {
                    return fallback;
                }
            }

            @Override
            protected void done() {
                if (requestId != tagRequestId) {
                    return;
                }
                versionCombo.setEnabled(true);
                try {
                    List<String> tags = get();
                    if (tags == null || tags.isEmpty()) {
                        setVersionItems(fallback, "latest");
                    } else {
                        setVersionItems(tags, preferLatest(tags));
                    }
                } catch (Exception ex) {
                    setVersionItems(fallback, "latest");
                }
                updateFullNameLabel();
            }
        }.execute();
    }

    private void setVersionItems(List<String> tags, String preferred) {
        versionCombo.removeAllItems();
        for (String tag : tags) {
            versionCombo.addItem(tag);
        }
        if (preferred != null && tags.contains(preferred)) {
            versionCombo.setSelectedItem(preferred);
        } else if (!tags.isEmpty()) {
            versionCombo.setSelectedItem(tags.get(0));
        }
        updateFullNameLabel();
    }

    private static String preferLatest(List<String> tags) {
        for (String tag : tags) {
            if ("latest".equalsIgnoreCase(tag)) {
                return tag;
            }
        }
        return tags.isEmpty() ? "latest" : tags.get(0);
    }

    private static String simpleRepoName(String repo) {
        String name = repo == null ? "" : repo.trim();
        int slash = name.lastIndexOf('/');
        if (slash >= 0) {
            name = name.substring(slash + 1);
        }
        int colon = name.indexOf(':');
        if (colon >= 0) {
            name = name.substring(0, colon);
        }
        return name.toLowerCase(Locale.ROOT);
    }

    private static String hubRepositoryPath(String repo) {
        String name = repo == null ? "" : repo.trim();
        if (name.isEmpty()) {
            return "";
        }
        if (!name.contains("/")) {
            return "library/" + name;
        }
        return name;
    }

    private static List<String> fetchDockerHubTags(String hubRepoPath) throws Exception {
        if (hubRepoPath == null || hubRepoPath.isBlank()) {
            return List.of("latest");
        }
        String encoded = URLEncoder.encode(hubRepoPath, StandardCharsets.UTF_8).replace("%2F", "/");

        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(8))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();

        // 按 last_updated 降序拉两页，避免只拿到很老的字母序标签
        List<TagInfo> tags = new ArrayList<>();
        for (int page = 1; page <= 2; page++) {
            // Hub 的 ordering=-last_updated 实际是最旧在前；不带 ordering 或 last_updated 才是较新在前
            String url = "https://hub.docker.com/v2/repositories/" + encoded
                    + "/tags?page_size=100&page=" + page + "&ordering=last_updated";
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(15))
                    .header("Accept", "application/json")
                    .header("User-Agent", "easy-ssh/1.0")
                    .GET()
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                if (page == 1) {
                    throw new IllegalStateException("Docker Hub 返回 " + response.statusCode());
                }
                break;
            }
            JsonObject root = JsonParser.parseString(response.body()).getAsJsonObject();
            JsonArray results = root.has("results") && root.get("results").isJsonArray()
                    ? root.getAsJsonArray("results")
                    : new JsonArray();
            if (results.isEmpty()) {
                break;
            }
            for (JsonElement el : results) {
                if (!el.isJsonObject()) {
                    continue;
                }
                JsonObject obj = el.getAsJsonObject();
                if (!obj.has("name") || obj.get("name").isJsonNull()) {
                    continue;
                }
                String name = obj.get("name").getAsString().trim();
                if (!isUsefulTag(name)) {
                    continue;
                }
                String updated = obj.has("last_updated") && !obj.get("last_updated").isJsonNull()
                        ? obj.get("last_updated").getAsString()
                        : "";
                tags.add(new TagInfo(name, updated));
            }
            if (!root.has("next") || root.get("next").isJsonNull()) {
                break;
            }
        }

        // 同一 tag 可能多架构重复，按更新时间保留最新一条
        Map<String, TagInfo> unique = new java.util.LinkedHashMap<>();
        for (TagInfo tag : tags) {
            TagInfo old = unique.get(tag.name);
            if (old == null || tag.updated.compareTo(old.updated) > 0) {
                unique.put(tag.name, tag);
            }
        }

        List<TagInfo> sorted = new ArrayList<>(unique.values());
        sorted.sort((a, b) -> {
            int byScore = Integer.compare(commonScore(b.name), commonScore(a.name));
            if (byScore != 0) {
                return byScore;
            }
            int byTime = b.updated.compareTo(a.updated);
            if (byTime != 0) {
                return byTime;
            }
            return compareVersionish(b.name, a.name);
        });

        List<String> list = new ArrayList<>();
        for (TagInfo tag : sorted) {
            if (commonScore(tag.name) <= 0) {
                continue;
            }
            list.add(tag.name);
            if (list.size() >= 20) {
                break;
            }
        }
        if (list.isEmpty()) {
            list.add("latest");
        } else if (!list.get(0).equalsIgnoreCase("latest")) {
            list.removeIf(t -> "latest".equalsIgnoreCase(t));
            list.add(0, "latest");
            if (list.size() > 20) {
                list = new ArrayList<>(list.subList(0, 20));
            }
        }
        return list;
    }

    /**
     * 常用度打分：越高越靠前。非常见形态直接 0（不进下拉）。
     */
    private static int commonScore(String name) {
        if (name == null || name.isBlank()) {
            return 0;
        }
        String tag = name.trim();
        String lower = tag.toLowerCase(Locale.ROOT);
        if ("latest".equals(lower)) {
            return 1000;
        }
        if ("stable".equals(lower) || "mainline".equals(lower) || "lts".equals(lower) || "current".equals(lower)) {
            return 950;
        }
        // 纯主版本：20 / 8 / 17
        if (tag.matches("\\d{1,3}")) {
            return 900;
        }
        // 主.次：1.30 / 8.4 / 3.22
        if (tag.matches("\\d{1,3}\\.\\d{1,3}")) {
            return 880;
        }
        // 主.次.修订：1.30.4
        if (tag.matches("\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}")) {
            return 860;
        }
        // alpine / slim 简写
        if ("alpine".equals(lower) || "slim".equals(lower)) {
            return 840;
        }
        // 20-alpine / 1.30-alpine / 8.4-alpine
        if (tag.matches("(?i)\\d{1,3}(\\.\\d{1,3}){0,2}-alpine(\\d+(\\.\\d+)?)?")) {
            return 820;
        }
        if (tag.matches("(?i)\\d{1,3}(\\.\\d{1,3}){0,2}-slim")) {
            return 800;
        }
        // Java：21-jre / 17-jdk / 21-jre-jammy
        if (tag.matches("(?i)\\d{1,3}(\\.\\d{1,3}){0,2}-(jre|jdk)(-[a-z0-9]+)?")) {
            return 830;
        }
        // redis/postgres 等 alpine 短名
        if (tag.matches("(?i)alpine\\d+(\\.\\d+)*")) {
            return 780;
        }
        return 0;
    }

    private static boolean isUsefulTag(String name) {
        return commonScore(name) > 0;
    }

    /** 粗略版本比较：能解析的数字段越大越新；解析不了则按字符串。 */
    private static int compareVersionish(String a, String b) {
        int[] pa = parseVersionParts(a);
        int[] pb = parseVersionParts(b);
        if (pa.length > 0 && pb.length > 0) {
            int n = Math.max(pa.length, pb.length);
            for (int i = 0; i < n; i++) {
                int va = i < pa.length ? pa[i] : 0;
                int vb = i < pb.length ? pb[i] : 0;
                if (va != vb) {
                    return Integer.compare(va, vb);
                }
            }
        }
        return a.compareToIgnoreCase(b);
    }

    private static int[] parseVersionParts(String tag) {
        if (tag == null) {
            return new int[0];
        }
        // 取开头连续的 x.y.z 数字
        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("^(\\d+)(?:\\.(\\d+))?(?:\\.(\\d+))?")
                .matcher(tag.trim());
        if (!m.find()) {
            return new int[0];
        }
        List<Integer> parts = new ArrayList<>();
        for (int i = 1; i <= m.groupCount(); i++) {
            String g = m.group(i);
            if (g == null) {
                break;
            }
            parts.add(Integer.parseInt(g));
        }
        return parts.stream().mapToInt(Integer::intValue).toArray();
    }

    private record TagInfo(String name, String updated) {
    }

    private void removeImage() {
        if (docker == null) {
            UiSupport.showInfo(this, "提示", "请先连接服务器");
            return;
        }
        int row = imageTable.getSelectedRow();
        if (row < 0) {
            UiSupport.showInfo(this, "提示", "请先在下方列表中选中要删除的镜像");
            return;
        }
        String imageName = String.valueOf(imageModel.getValueAt(row, 0));
        if (imageName == null || imageName.isBlank() || "<none>:<none>".equals(imageName)) {
            imageName = String.valueOf(imageModel.getValueAt(row, 1));
        }
        String target = imageName;
        if (!UiSupport.confirm(this, "删除镜像",
                "确认删除镜像「" + target + "」？\n若仍有容器在使用该镜像，删除可能失败。")) {
            return;
        }
        runOps("删除镜像", () -> docker.removeImage(target), this::refreshImages);
    }

    private void refreshImages() {
        if (docker == null) {
            return;
        }
        UiSupport.runAsync(this, "刷新镜像列表", docker::listImages, this::fillImages);
    }

    private void fillImages(List<String> images) {
        imageModel.setRowCount(0);
        for (String line : images) {
            String[] parts = line.split("\\|", -1);
            imageModel.addRow(new Object[]{
                    parts.length > 0 ? parts[0] : line,
                    parts.length > 1 ? parts[1] : "",
                    parts.length > 2 ? parts[2] : ""
            });
        }
    }

    private void runOps(String title, ThrowingSupplier<String> task, Runnable afterSuccess) {
        UiSupport.runAsync(this, title, task::get, result -> {
            if (outputConsumer != null) {
                outputConsumer.show(title, result);
            } else {
                UiSupport.showTextDialog(this, title, result);
            }
            if (afterSuccess != null) {
                afterSuccess.run();
            }
        });
    }

    private static void addForm(JPanel form, GridBagConstraints c, int row, String label, java.awt.Component field) {
        c.gridx = 0;
        c.gridy = row;
        c.weightx = 0;
        form.add(label == null || label.isBlank() ? new JLabel(" ") : new JLabel(label), c);
        c.gridx = 1;
        c.weightx = 1;
        form.add(field, c);
    }

    @FunctionalInterface
    private interface ThrowingSupplier<T> {
        T get() throws Exception;
    }

    private static final class SimpleDocListener implements javax.swing.event.DocumentListener {
        private final Runnable onChange;

        private SimpleDocListener(Runnable onChange) {
            this.onChange = onChange;
        }

        @Override
        public void insertUpdate(javax.swing.event.DocumentEvent e) {
            onChange.run();
        }

        @Override
        public void removeUpdate(javax.swing.event.DocumentEvent e) {
            onChange.run();
        }

        @Override
        public void changedUpdate(javax.swing.event.DocumentEvent e) {
            onChange.run();
        }
    }
}
