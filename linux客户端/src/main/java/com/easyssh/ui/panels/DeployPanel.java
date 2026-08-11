package com.easyssh.ui.panels;

import com.easyssh.model.ServerProfile;
import com.easyssh.service.DockerService;
import com.easyssh.service.ServerOpsService;
import com.easyssh.ui.UiSupport;
import com.easyssh.ui.theme.AppTheme;
import com.easyssh.util.AccessUrlHelper;

import javax.swing.BorderFactory;
import javax.swing.BoxLayout;
import javax.swing.ButtonGroup;
import javax.swing.JButton;
import javax.swing.JComboBox;
import javax.swing.JFileChooser;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JRadioButton;
import javax.swing.JScrollPane;
import javax.swing.JTextField;
import javax.swing.SwingWorker;
import javax.swing.filechooser.FileNameExtensionFilter;
import java.awt.BorderLayout;
import java.awt.FlowLayout;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import java.nio.file.Path;
import java.util.List;

public class DeployPanel extends JPanel {
    private final JTextField siteNameField = new JTextField(16);
    private final JTextField hostPortField = new JTextField(8);
    private final JComboBox<String> imageCombo = new JComboBox<>();
    private final JRadioButton useVolumeRadio = new JRadioButton("选择已有数据卷", true);
    private final JRadioButton useZipRadio = new JRadioButton("上传 ZIP 网站包", false);
    private final JComboBox<String> siteVolumeCombo = new JComboBox<>();
    private final JLabel zipLabel = AppTheme.muted("未选择文件");
    private final JPanel volumeRow = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));
    private final JPanel zipRow = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));
    private Path selectedZip;

    private final JButton deployButton = UiSupport.successButton("一键部署网站", this::deploySite);
    private final JPanel nginxAccessRow = new JPanel(new BorderLayout(8, 8));
    private final JLabel nginxAccessLabel = AppTheme.muted("");

    private ServerOpsService ops;
    private DockerService docker;
    private ServerProfile profile;
    private OutputConsumer outputConsumer;
    private String currentNginxUrl = "";

    public interface OutputConsumer {
        void show(String title, String content);
    }

    public DeployPanel() {
        setLayout(new BorderLayout(10, 10));
        setBackground(AppTheme.BG);
        setBorder(BorderFactory.createEmptyBorder(12, 12, 12, 12));

        JLabel title = AppTheme.title("一键部署", 17f);
        JLabel tip = AppTheme.muted("镜像列表来自服务器本地；没有合适镜像时可手动输入名称拉取");

        JPanel north = new JPanel(new BorderLayout(4, 6));
        north.setOpaque(false);
        north.add(title, BorderLayout.NORTH);
        north.add(tip, BorderLayout.SOUTH);

        JPanel body = new JPanel();
        body.setOpaque(false);
        body.setLayout(new BoxLayout(body, BoxLayout.Y_AXIS));
        body.add(buildNginxCard());

        JScrollPane scroll = new JScrollPane(body);
        scroll.setBorder(BorderFactory.createEmptyBorder());
        scroll.getViewport().setBackground(AppTheme.BG);

        add(north, BorderLayout.NORTH);
        add(scroll, BorderLayout.CENTER);

        hideNginxAccess();
        updateSourceUi();
    }

    public void setOutputConsumer(OutputConsumer outputConsumer) {
        this.outputConsumer = outputConsumer;
    }

    public void bind(ServerOpsService ops, DockerService docker, ServerProfile profile) {
        this.ops = ops;
        this.docker = docker;
        this.profile = profile;
        refreshVolumes();
        refreshImages();
    }

    public void clear() {
        this.ops = null;
        this.docker = null;
        this.profile = null;
        this.currentNginxUrl = "";
        this.selectedZip = null;
        zipLabel.setText("未选择文件");
        siteNameField.setText("");
        hostPortField.setText("");
        hideNginxAccess();
        siteVolumeCombo.removeAllItems();
        siteVolumeCombo.addItem("(请选择数据卷)");
        resetImageCombo(List.of());
    }

    private JPanel buildNginxCard() {
        JPanel card = AppTheme.card("部署静态网站");
        JPanel form = new JPanel(new GridBagLayout());
        form.setOpaque(false);
        GridBagConstraints c = new GridBagConstraints();
        c.insets = new Insets(6, 4, 6, 4);
        c.fill = GridBagConstraints.HORIZONTAL;
        c.weightx = 1;

        ButtonGroup group = new ButtonGroup();
        group.add(useVolumeRadio);
        group.add(useZipRadio);
        useVolumeRadio.setOpaque(false);
        useZipRadio.setOpaque(false);
        useVolumeRadio.addActionListener(e -> updateSourceUi());
        useZipRadio.addActionListener(e -> updateSourceUi());

        siteVolumeCombo.addItem("(请选择数据卷)");

        volumeRow.setOpaque(false);
        volumeRow.add(siteVolumeCombo);
        volumeRow.add(UiSupport.button("刷新", this::refreshVolumes));

        zipRow.setOpaque(false);
        zipRow.add(UiSupport.button("选择 ZIP", this::chooseZip));
        zipRow.add(zipLabel);

        JPanel sourceSwitch = new JPanel(new FlowLayout(FlowLayout.LEFT, 16, 0));
        sourceSwitch.setOpaque(false);
        sourceSwitch.add(useVolumeRadio);
        sourceSwitch.add(useZipRadio);

        JPanel sourceContent = new JPanel(new BorderLayout());
        sourceContent.setOpaque(false);
        sourceContent.add(volumeRow, BorderLayout.NORTH);
        sourceContent.add(zipRow, BorderLayout.CENTER);

        JPanel imageRow = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));
        imageRow.setOpaque(false);
        imageCombo.setEditable(true);
        imageCombo.setPreferredSize(new java.awt.Dimension(260, 30));
        resetImageCombo(List.of());
        imageRow.add(imageCombo);
        imageRow.add(UiSupport.button("刷新镜像", this::refreshImages));

        JPanel portRow = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));
        portRow.setOpaque(false);
        portRow.add(hostPortField);
        portRow.add(AppTheme.muted("映射到容器内 80 端口，例如填 8080 则访问 http://IP:8080"));

        int row = 0;
        addForm(form, c, row++, "站点名称", siteNameField);
        addForm(form, c, row++, "访问端口", portRow);
        addForm(form, c, row++, "选择镜像", imageRow);
        addForm(form, c, row++, "网站来源", sourceSwitch);
        addForm(form, c, row, " ", sourceContent);

        JLabel hint = AppTheme.muted("会按所选镜像启动容器，并把访问端口映射到容器 80；网站文件挂到镜像默认网站目录");

        nginxAccessRow.setOpaque(false);
        nginxAccessLabel.setCursor(new java.awt.Cursor(java.awt.Cursor.HAND_CURSOR));
        nginxAccessLabel.setForeground(AppTheme.PRIMARY);
        nginxAccessLabel.addMouseListener(new java.awt.event.MouseAdapter() {
            @Override
            public void mouseClicked(java.awt.event.MouseEvent e) {
                openNginxPage();
            }
        });
        nginxAccessRow.add(nginxAccessLabel, BorderLayout.CENTER);
        nginxAccessRow.setVisible(false);

        JPanel actions = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 8));
        actions.setOpaque(false);
        actions.add(deployButton);

        JPanel south = new JPanel(new BorderLayout(0, 8));
        south.setOpaque(false);
        south.add(hint, BorderLayout.NORTH);
        south.add(actions, BorderLayout.CENTER);
        south.add(nginxAccessRow, BorderLayout.SOUTH);

        card.add(form, BorderLayout.CENTER);
        card.add(south, BorderLayout.SOUTH);
        return card;
    }

    private void updateSourceUi() {
        boolean volumeMode = useVolumeRadio.isSelected();
        volumeRow.setVisible(volumeMode);
        zipRow.setVisible(!volumeMode);
        volumeRow.getParent().revalidate();
        volumeRow.getParent().repaint();
        revalidate();
        repaint();
    }

    private void chooseZip() {
        JFileChooser chooser = new JFileChooser();
        chooser.setFileFilter(new FileNameExtensionFilter("ZIP 压缩包", "zip"));
        if (chooser.showOpenDialog(this) != JFileChooser.APPROVE_OPTION) {
            return;
        }
        selectedZip = chooser.getSelectedFile().toPath();
        zipLabel.setText(selectedZip.getFileName().toString());
        useZipRadio.setSelected(true);
        updateSourceUi();
    }

    private void deploySite() {
        if (docker == null) {
            needConnect();
            return;
        }
        String name = siteNameField.getText().trim();
        if (name.isEmpty()) {
            UiSupport.showInfo(this, "提示", "请填写站点名称");
            return;
        }
        int hostPort;
        try {
            hostPort = Integer.parseInt(hostPortField.getText().trim());
        } catch (Exception ex) {
            UiSupport.showInfo(this, "提示", "请填写访问端口，例如 80 或 8080");
            return;
        }
        if (hostPort < 1 || hostPort > 65535) {
            UiSupport.showInfo(this, "提示", "访问端口需在 1~65535 之间");
            return;
        }
        int port = hostPort;
        Object imageItem = imageCombo.getEditor().getItem();
        if (imageItem == null || String.valueOf(imageItem).isBlank()) {
            imageItem = imageCombo.getSelectedItem();
        }
        String selectedImage = imageItem == null ? "" : String.valueOf(imageItem).trim();
        if (selectedImage.isEmpty() || selectedImage.startsWith("(")) {
            UiSupport.showInfo(this, "提示", "请选择或填写镜像名称，例如 nginx:latest");
            return;
        }
        final String image = selectedImage;

        final boolean zipMode = useZipRadio.isSelected();
        final Path zip = selectedZip;
        final String volumeName;
        if (zipMode) {
            if (zip == null) {
                UiSupport.showInfo(this, "提示", "请先选择 ZIP 网站包");
                return;
            }
            volumeName = sanitizeName(name) + "-site";
        } else {
            String volume = String.valueOf(siteVolumeCombo.getSelectedItem());
            if (volume == null || volume.startsWith("(请选择")) {
                UiSupport.showInfo(this, "提示", "请选择一个数据卷，或改用上传 ZIP");
                return;
            }
            volumeName = volume;
        }

        deployButton.setEnabled(false);
        StringBuilder live = new StringBuilder();
        live.append("开始部署站点「").append(name).append("」...\n");
        live.append("镜像：").append(image).append('\n');
        live.append("端口：").append(port).append(" -> 容器 80\n");
        live.append("数据来源：").append(zipMode ? "ZIP 上传" : ("数据卷 " + volumeName)).append("\n\n");
        if (outputConsumer != null) {
            outputConsumer.show("部署静态网站", live.toString());
        }

        new SwingWorker<String, String>() {
            @Override
            protected String doInBackground() throws Exception {
                if (zipMode) {
                    publish("正在创建/准备数据卷 " + volumeName + " ...");
                    docker.createVolume(volumeName);
                    publish("正在上传并解压 ZIP（文件较大时会稍慢）...");
                    String unzip = docker.uploadZipToVolume(volumeName, zip);
                    publish(unzip);
                }
                return docker.deploySite(name, image, volumeName, port, this::publish);
            }

            @Override
            protected void process(java.util.List<String> chunks) {
                for (String chunk : chunks) {
                    live.append(chunk).append('\n');
                }
                if (outputConsumer != null) {
                    outputConsumer.show("部署静态网站", live.toString());
                }
            }

            @Override
            protected void done() {
                deployButton.setEnabled(true);
                try {
                    String result = get();
                    live.append('\n').append(result);
                    if (outputConsumer != null) {
                        outputConsumer.show("部署静态网站", live.toString());
                    }
                    showDeployedUrl(port);
                    UiSupport.showInfo(DeployPanel.this, "部署完成", "站点「" + name + "」已部署成功");
                } catch (Exception ex) {
                    Throwable cause = ex.getCause() == null ? ex : ex.getCause();
                    live.append("\n部署失败：").append(cause.getMessage());
                    if (outputConsumer != null) {
                        outputConsumer.show("部署静态网站失败", live.toString());
                    }
                    UiSupport.showError(DeployPanel.this, "部署失败", cause.getMessage());
                }
            }
        }.execute();
    }

    private static String sanitizeName(String name) {
        return name.trim().toLowerCase().replaceAll("[^a-z0-9_.-]", "-");
    }

    private void refreshVolumes() {
        if (docker == null) {
            return;
        }
        UiSupport.runAsync(this, "刷新数据卷", docker::listVolumes, list -> {
            String selectedSite = String.valueOf(siteVolumeCombo.getSelectedItem());
            siteVolumeCombo.removeAllItems();
            siteVolumeCombo.addItem("(请选择数据卷)");
            for (var v : list) {
                siteVolumeCombo.addItem(v.getName());
            }
            if (selectedSite != null) {
                siteVolumeCombo.setSelectedItem(selectedSite);
            }
        });
    }

    private void refreshImages() {
        if (docker == null) {
            resetImageCombo(java.util.List.of());
            return;
        }
        UiSupport.runAsync(this, "刷新镜像", docker::listImages, lines -> {
            java.util.List<String> images = new java.util.ArrayList<>();
            for (String line : lines) {
                String name = line.split("\\|", 2)[0].trim();
                if (isWebImage(name)) {
                    images.add(name);
                }
            }
            resetImageCombo(images);
        });
    }

    private static boolean isWebImage(String name) {
        if (name == null || name.isBlank() || "<none>:<none>".equals(name)) {
            return false;
        }
        String lower = name.toLowerCase();
        return lower.contains("nginx")
                || lower.contains("httpd")
                || lower.contains("apache")
                || lower.contains("caddy")
                || lower.contains("openresty");
    }

    private void resetImageCombo(java.util.List<String> remoteImages) {
        String selected = String.valueOf(imageCombo.getEditor().getItem());
        if (selected == null || selected.isBlank() || "null".equals(selected)) {
            selected = String.valueOf(imageCombo.getSelectedItem());
        }
        imageCombo.removeAllItems();
        if (remoteImages.isEmpty()) {
            imageCombo.addItem("(暂无网站镜像，可手动输入如 nginx:latest)");
        } else {
            for (String image : remoteImages) {
                imageCombo.addItem(image);
            }
        }
        if (selected != null && !selected.isBlank() && !"null".equals(selected)
                && !selected.startsWith("(") && containsImage(remoteImages, selected)) {
            imageCombo.setSelectedItem(selected);
        } else if (!remoteImages.isEmpty()) {
            imageCombo.setSelectedItem(remoteImages.get(0));
        }
    }

    private static boolean containsImage(java.util.List<String> images, String name) {
        for (String image : images) {
            if (image.equals(name)) {
                return true;
            }
        }
        return false;
    }

    private void showDeployedUrl(int port) {
        if (profile == null) {
            return;
        }
        setAccessUrl(AccessUrlHelper.nginxHostUrl(profile, port), "已部署站点");
        if (outputConsumer != null && !currentNginxUrl.isBlank()) {
            outputConsumer.show("访问地址", "部署完成，可访问：\n" + currentNginxUrl + "\n\n点击蓝色访问地址即可打开。");
        }
    }

    private void setAccessUrl(String url, String label) {
        currentNginxUrl = url == null ? "" : url.trim();
        if (currentNginxUrl.isBlank()) {
            hideNginxAccess();
            return;
        }
        nginxAccessLabel.setText(label + "：" + currentNginxUrl + "（点击打开）");
        nginxAccessRow.setVisible(true);
        nginxAccessRow.revalidate();
        nginxAccessRow.repaint();
    }

    private void hideNginxAccess() {
        currentNginxUrl = "";
        nginxAccessLabel.setText("");
        nginxAccessRow.setVisible(false);
    }

    private void openNginxPage() {
        try {
            AccessUrlHelper.openInBrowser(currentNginxUrl);
            if (outputConsumer != null) {
                outputConsumer.show("打开网页", "已在浏览器打开：\n" + currentNginxUrl);
            }
        } catch (Exception ex) {
            UiSupport.showError(this, "无法打开网页", ex.getMessage());
        }
    }

    private void runOps(String title, ThrowingSupplier<String> task) {
        runOps(title, task, null);
    }

    private void runOps(String title, ThrowingSupplier<String> task, Runnable afterSuccess) {
        if (ops == null && docker == null) {
            needConnect();
            return;
        }
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

    private void needConnect() {
        UiSupport.showInfo(this, "提示", "请先连接服务器");
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
}
