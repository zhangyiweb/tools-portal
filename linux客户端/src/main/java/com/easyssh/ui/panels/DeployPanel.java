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
import javax.swing.JTabbedPane;
import javax.swing.JTextArea;
import javax.swing.JTextField;
import javax.swing.SwingWorker;
import javax.swing.filechooser.FileNameExtensionFilter;
import java.awt.BorderLayout;
import java.awt.FlowLayout;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class DeployPanel extends JPanel {
    private static final String DEFAULT_JAVA_IMAGE = "eclipse-temurin:17-jre";
    private static final String DEFAULT_NODE_IMAGE = "node:20";

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

    private final JTextField backendNameField = new JTextField(16);
    private final JTextField backendHostPortField = new JTextField(8);
    private final JTextField backendContainerPortField = new JTextField(8);
    private final JRadioButton useJarRadio = new JRadioButton("上传 JAR 包", true);
    private final JRadioButton useBackendImageRadio = new JRadioButton("已有 Docker 镜像", false);
    private final JLabel jarLabel = AppTheme.muted("未选择文件");
    private final JPanel jarRow = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));
    private final JPanel backendImageRow = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));
    private final JPanel backendContainerPortRow = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));
    private final JComboBox<String> backendImageCombo = new JComboBox<>();
    private final JComboBox<String> javaImageCombo = new JComboBox<>();
    private final JPanel javaImageRow = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));
    private final JTextArea backendEnvArea = new JTextArea(5, 28);
    private final JButton backendDeployButton = UiSupport.successButton("一键部署 Java", this::deployBackend);
    private final JPanel backendAccessRow = new JPanel(new BorderLayout(8, 8));
    private final JLabel backendAccessLabel = AppTheme.muted("");
    private Path selectedJar;

    private final JTextField nodeNameField = new JTextField(16);
    private final JTextField nodeHostPortField = new JTextField(8);
    private final JTextField nodeStartCommandField = new JTextField(20);
    private final JComboBox<String> nodeImageCombo = new JComboBox<>();
    private final JLabel nodeZipLabel = AppTheme.muted("未选择文件");
    private final JTextArea nodeEnvArea = new JTextArea(5, 28);
    private final JButton nodeDeployButton = UiSupport.successButton("一键部署 Node", this::deployNode);
    private final JPanel nodeAccessRow = new JPanel(new BorderLayout(8, 8));
    private final JLabel nodeAccessLabel = AppTheme.muted("");
    private Path selectedNodeZip;

    private ServerOpsService ops;
    private DockerService docker;
    private ServerProfile profile;
    private OutputConsumer outputConsumer;
    private String currentNginxUrl = "";
    private String currentBackendUrl = "";
    private String currentNodeUrl = "";

    public interface OutputConsumer {
        void show(String title, String content);
    }

    public DeployPanel() {
        setLayout(new BorderLayout(10, 10));
        setBackground(AppTheme.BG);
        setBorder(BorderFactory.createEmptyBorder(12, 12, 12, 12));

        JLabel title = AppTheme.title("一键部署", 17f);
        JLabel tip = AppTheme.muted("nginx 静态站 / Java JAR / Node 项目 ZIP，按需切换");

        JPanel north = new JPanel(new BorderLayout(4, 6));
        north.setOpaque(false);
        north.add(title, BorderLayout.NORTH);
        north.add(tip, BorderLayout.SOUTH);

        JTabbedPane tabs = new JTabbedPane();
        tabs.addTab("nginx部署", wrapScroll(buildNginxCard()));
        tabs.addTab("java部署", wrapScroll(buildBackendCard()));
        tabs.addTab("node部署", wrapScroll(buildNodeCard()));
        tabs.setSelectedIndex(0);

        add(north, BorderLayout.NORTH);
        add(tabs, BorderLayout.CENTER);

        hideNginxAccess();
        hideBackendAccess();
        hideNodeAccess();
        updateSourceUi();
        updateBackendSourceUi();
        backendHostPortField.setText("8080");
        backendContainerPortField.setText("8080");
        backendEnvArea.setLineWrap(true);
        backendEnvArea.setWrapStyleWord(true);
        javaImageCombo.setEditable(true);
        javaImageCombo.addItem(DEFAULT_JAVA_IMAGE);
        javaImageCombo.setSelectedItem(DEFAULT_JAVA_IMAGE);
        nodeHostPortField.setText("3000");
        nodeStartCommandField.setText("npm start");
        nodeEnvArea.setLineWrap(true);
        nodeEnvArea.setWrapStyleWord(true);
        nodeImageCombo.setEditable(true);
        nodeImageCombo.addItem(DEFAULT_NODE_IMAGE);
        nodeImageCombo.setSelectedItem(DEFAULT_NODE_IMAGE);
    }

    public void setOutputConsumer(OutputConsumer outputConsumer) {
        this.outputConsumer = outputConsumer;
    }

    public void bind(ServerOpsService ops, DockerService docker, ServerProfile profile) {
        this.ops = ops;
        this.docker = docker;
        this.profile = profile;
        refreshAllLists();
    }

    public void clear() {
        this.ops = null;
        this.docker = null;
        this.profile = null;
        this.currentNginxUrl = "";
        this.currentBackendUrl = "";
        this.currentNodeUrl = "";
        this.selectedZip = null;
        this.selectedJar = null;
        this.selectedNodeZip = null;
        zipLabel.setText("未选择文件");
        jarLabel.setText("未选择文件");
        nodeZipLabel.setText("未选择文件");
        siteNameField.setText("");
        hostPortField.setText("");
        hideNginxAccess();
        hideBackendAccess();
        hideNodeAccess();
        siteVolumeCombo.removeAllItems();
        siteVolumeCombo.addItem("(请选择数据卷)");
        resetImageCombo(List.of());
        backendNameField.setText("");
        backendHostPortField.setText("8080");
        backendContainerPortField.setText("8080");
        backendEnvArea.setText("");
        useJarRadio.setSelected(true);
        javaImageCombo.setSelectedItem(DEFAULT_JAVA_IMAGE);
        resetBackendImageCombo(List.of());
        updateBackendSourceUi();
        nodeNameField.setText("");
        nodeHostPortField.setText("3000");
        nodeStartCommandField.setText("npm start");
        nodeEnvArea.setText("");
        nodeImageCombo.setSelectedItem(DEFAULT_NODE_IMAGE);
    }

    private static JScrollPane wrapScroll(JPanel content) {
        JPanel body = new JPanel();
        body.setOpaque(false);
        body.setLayout(new BoxLayout(body, BoxLayout.Y_AXIS));
        body.add(content);
        JScrollPane scroll = new JScrollPane(body);
        scroll.setBorder(BorderFactory.createEmptyBorder());
        scroll.getViewport().setBackground(AppTheme.BG);
        return scroll;
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
                openAccessUrl(currentNginxUrl);
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

    private JPanel buildBackendCard() {
        JPanel card = AppTheme.card("部署 Java 服务");
        JPanel form = new JPanel(new GridBagLayout());
        form.setOpaque(false);
        GridBagConstraints c = new GridBagConstraints();
        c.insets = new Insets(6, 4, 6, 4);
        c.fill = GridBagConstraints.HORIZONTAL;
        c.weightx = 1;

        ButtonGroup group = new ButtonGroup();
        group.add(useJarRadio);
        group.add(useBackendImageRadio);
        useJarRadio.setOpaque(false);
        useBackendImageRadio.setOpaque(false);
        useJarRadio.addActionListener(e -> updateBackendSourceUi());
        useBackendImageRadio.addActionListener(e -> updateBackendSourceUi());

        jarRow.setOpaque(false);
        jarRow.add(UiSupport.button("选择 JAR", this::chooseJar));
        jarRow.add(jarLabel);

        javaImageRow.setOpaque(false);
        javaImageCombo.setPreferredSize(new java.awt.Dimension(260, 30));
        javaImageRow.add(javaImageCombo);
        javaImageRow.add(AppTheme.muted("用于运行 JAR 的 Java 镜像"));

        backendImageRow.setOpaque(false);
        backendImageCombo.setEditable(true);
        backendImageCombo.setPreferredSize(new java.awt.Dimension(280, 30));
        resetBackendImageCombo(List.of());
        backendImageRow.add(backendImageCombo);
        backendImageRow.add(UiSupport.button("刷新镜像", this::refreshBackendImages));

        JPanel modeSwitch = new JPanel(new FlowLayout(FlowLayout.LEFT, 16, 0));
        modeSwitch.setOpaque(false);
        modeSwitch.add(useJarRadio);
        modeSwitch.add(useBackendImageRadio);

        JPanel hostPortRow = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));
        hostPortRow.setOpaque(false);
        hostPortRow.add(backendHostPortField);
        hostPortRow.add(AppTheme.muted("对外访问端口，例如 8080"));

        backendContainerPortRow.setOpaque(false);
        backendContainerPortRow.add(backendContainerPortField);
        backendContainerPortRow.add(AppTheme.muted("容器内监听端口（仅镜像模式）"));

        JScrollPane envScroll = new JScrollPane(backendEnvArea);
        envScroll.setPreferredSize(new java.awt.Dimension(360, 110));

        int row = 0;
        addForm(form, c, row++, "应用名称", backendNameField);
        addForm(form, c, row++, "对外端口", hostPortRow);
        addForm(form, c, row++, "部署方式", modeSwitch);
        addForm(form, c, row++, "JAR 包", jarRow);
        addForm(form, c, row++, "Java 镜像", javaImageRow);
        addForm(form, c, row++, "容器内端口", backendContainerPortRow);
        addForm(form, c, row++, "Docker 镜像", backendImageRow);
        addForm(form, c, row, "环境变量", envScroll);

        JLabel hint = AppTheme.muted("默认上传 JAR：传到服务器后用 Java 镜像 java -jar 启动；也可改用已有后端镜像直接运行");

        backendAccessRow.setOpaque(false);
        backendAccessLabel.setCursor(new java.awt.Cursor(java.awt.Cursor.HAND_CURSOR));
        backendAccessLabel.setForeground(AppTheme.PRIMARY);
        backendAccessLabel.addMouseListener(new java.awt.event.MouseAdapter() {
            @Override
            public void mouseClicked(java.awt.event.MouseEvent e) {
                openAccessUrl(currentBackendUrl);
            }
        });
        backendAccessRow.add(backendAccessLabel, BorderLayout.CENTER);
        backendAccessRow.setVisible(false);

        JPanel actions = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 8));
        actions.setOpaque(false);
        actions.add(backendDeployButton);

        JPanel south = new JPanel(new BorderLayout(0, 8));
        south.setOpaque(false);
        south.add(hint, BorderLayout.NORTH);
        south.add(actions, BorderLayout.CENTER);
        south.add(backendAccessRow, BorderLayout.SOUTH);

        card.add(form, BorderLayout.CENTER);
        card.add(south, BorderLayout.SOUTH);
        return card;
    }

    private JPanel buildNodeCard() {
        JPanel card = AppTheme.card("部署 Node 服务");
        JPanel form = new JPanel(new GridBagLayout());
        form.setOpaque(false);
        GridBagConstraints c = new GridBagConstraints();
        c.insets = new Insets(6, 4, 6, 4);
        c.fill = GridBagConstraints.HORIZONTAL;
        c.weightx = 1;

        JPanel zipRowPanel = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));
        zipRowPanel.setOpaque(false);
        zipRowPanel.add(UiSupport.button("选择 ZIP", this::chooseNodeZip));
        zipRowPanel.add(nodeZipLabel);

        JPanel imageRow = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));
        imageRow.setOpaque(false);
        nodeImageCombo.setPreferredSize(new java.awt.Dimension(260, 30));
        imageRow.add(nodeImageCombo);
        imageRow.add(AppTheme.muted("用于运行项目的 Node 镜像"));

        JPanel hostPortRow = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));
        hostPortRow.setOpaque(false);
        hostPortRow.add(nodeHostPortField);
        hostPortRow.add(AppTheme.muted("对外访问端口，例如 3000"));

        JPanel startRow = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));
        startRow.setOpaque(false);
        nodeStartCommandField.setPreferredSize(new java.awt.Dimension(260, 30));
        startRow.add(nodeStartCommandField);
        startRow.add(AppTheme.muted("如 npm start / node server.js"));

        JScrollPane envScroll = new JScrollPane(nodeEnvArea);
        envScroll.setPreferredSize(new java.awt.Dimension(360, 110));

        int row = 0;
        addForm(form, c, row++, "应用名称", nodeNameField);
        addForm(form, c, row++, "对外端口", hostPortRow);
        addForm(form, c, row++, "项目 ZIP", zipRowPanel);
        addForm(form, c, row++, "Node 镜像", imageRow);
        addForm(form, c, row++, "启动命令", startRow);
        addForm(form, c, row, "环境变量", envScroll);

        JLabel hint = AppTheme.muted("上传含 package.json 的 ZIP → 解压到服务器 → npm install --omit=dev → 执行启动命令");

        nodeAccessRow.setOpaque(false);
        nodeAccessLabel.setCursor(new java.awt.Cursor(java.awt.Cursor.HAND_CURSOR));
        nodeAccessLabel.setForeground(AppTheme.PRIMARY);
        nodeAccessLabel.addMouseListener(new java.awt.event.MouseAdapter() {
            @Override
            public void mouseClicked(java.awt.event.MouseEvent e) {
                openAccessUrl(currentNodeUrl);
            }
        });
        nodeAccessRow.add(nodeAccessLabel, BorderLayout.CENTER);
        nodeAccessRow.setVisible(false);

        JPanel actions = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 8));
        actions.setOpaque(false);
        actions.add(nodeDeployButton);

        JPanel south = new JPanel(new BorderLayout(0, 8));
        south.setOpaque(false);
        south.add(hint, BorderLayout.NORTH);
        south.add(actions, BorderLayout.CENTER);
        south.add(nodeAccessRow, BorderLayout.SOUTH);

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

    private void updateBackendSourceUi() {
        boolean jarMode = useJarRadio.isSelected();
        jarRow.setVisible(jarMode);
        javaImageRow.setVisible(jarMode);
        backendImageRow.setVisible(!jarMode);
        backendContainerPortRow.setVisible(!jarMode);
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

    private void chooseJar() {
        JFileChooser chooser = new JFileChooser();
        chooser.setFileFilter(new FileNameExtensionFilter("JAR 包", "jar"));
        if (chooser.showOpenDialog(this) != JFileChooser.APPROVE_OPTION) {
            return;
        }
        selectedJar = chooser.getSelectedFile().toPath();
        jarLabel.setText(selectedJar.getFileName().toString());
        useJarRadio.setSelected(true);
        updateBackendSourceUi();
    }

    private void chooseNodeZip() {
        JFileChooser chooser = new JFileChooser();
        chooser.setFileFilter(new FileNameExtensionFilter("ZIP 压缩包", "zip"));
        if (chooser.showOpenDialog(this) != JFileChooser.APPROVE_OPTION) {
            return;
        }
        selectedNodeZip = chooser.getSelectedFile().toPath();
        nodeZipLabel.setText(selectedNodeZip.getFileName().toString());
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
                    showDeployedUrl(port, "nginx");
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

    private void deployBackend() {
        if (docker == null) {
            needConnect();
            return;
        }
        String name = backendNameField.getText().trim();
        if (name.isEmpty()) {
            UiSupport.showInfo(this, "提示", "请填写应用名称");
            return;
        }
        int hostPort;
        try {
            hostPort = Integer.parseInt(backendHostPortField.getText().trim());
        } catch (Exception ex) {
            UiSupport.showInfo(this, "提示", "请填写正确的端口，例如 8080");
            return;
        }
        if (hostPort < 1 || hostPort > 65535) {
            UiSupport.showInfo(this, "提示", "端口需在 1~65535 之间");
            return;
        }

        final boolean jarMode = useJarRadio.isSelected();
        final Path jar = selectedJar;
        final int port = hostPort;
        final Map<String, String> env = parseEnvText(backendEnvArea.getText());

        if (jarMode) {
            if (jar == null) {
                UiSupport.showInfo(this, "提示", "请先选择要上传的 JAR 包");
                return;
            }
            Object javaItem = javaImageCombo.getEditor().getItem();
            if (javaItem == null || String.valueOf(javaItem).isBlank()) {
                javaItem = javaImageCombo.getSelectedItem();
            }
            String javaImage = javaItem == null ? DEFAULT_JAVA_IMAGE : String.valueOf(javaItem).trim();
            if (javaImage.isEmpty()) {
                javaImage = DEFAULT_JAVA_IMAGE;
            }
            final String runtimeImage = javaImage;

            backendDeployButton.setEnabled(false);
            StringBuilder live = new StringBuilder();
            live.append("开始部署后端「").append(name).append("」...\n");
            live.append("方式：上传 JAR\n");
            live.append("JAR：").append(jar.getFileName()).append('\n');
            live.append("Java 镜像：").append(runtimeImage).append('\n');
            live.append("端口：").append(port).append('\n');
            if (!env.isEmpty()) {
                live.append("环境变量：").append(env.size()).append(" 项\n");
            }
            live.append('\n');
            if (outputConsumer != null) {
                outputConsumer.show("部署后端", live.toString());
            }

            new SwingWorker<String, String>() {
                @Override
                protected String doInBackground() throws Exception {
                    return docker.deployBackendJar(name, jar, port, runtimeImage, env, this::publish);
                }

                @Override
                protected void process(java.util.List<String> chunks) {
                    for (String chunk : chunks) {
                        live.append(chunk).append('\n');
                    }
                    if (outputConsumer != null) {
                        outputConsumer.show("部署后端", live.toString());
                    }
                }

                @Override
                protected void done() {
                    backendDeployButton.setEnabled(true);
                    try {
                        String result = get();
                        live.append('\n').append(result);
                        if (outputConsumer != null) {
                            outputConsumer.show("部署后端", live.toString());
                        }
                        showDeployedUrl(port, "java");
                        UiSupport.showInfo(DeployPanel.this, "部署完成", "后端「" + name + "」已部署成功");
                    } catch (Exception ex) {
                        Throwable cause = ex.getCause() == null ? ex : ex.getCause();
                        live.append("\n部署失败：").append(cause.getMessage());
                        if (outputConsumer != null) {
                            outputConsumer.show("部署后端失败", live.toString());
                        }
                        UiSupport.showError(DeployPanel.this, "部署失败", cause.getMessage());
                    }
                }
            }.execute();
            return;
        }

        int containerPort;
        try {
            containerPort = Integer.parseInt(backendContainerPortField.getText().trim());
        } catch (Exception ex) {
            UiSupport.showInfo(this, "提示", "请填写正确的容器内端口");
            return;
        }
        if (containerPort < 1 || containerPort > 65535) {
            UiSupport.showInfo(this, "提示", "端口需在 1~65535 之间");
            return;
        }
        Object imageItem = backendImageCombo.getEditor().getItem();
        if (imageItem == null || String.valueOf(imageItem).isBlank()) {
            imageItem = backendImageCombo.getSelectedItem();
        }
        String selectedImage = imageItem == null ? "" : String.valueOf(imageItem).trim();
        if (selectedImage.isEmpty() || selectedImage.startsWith("(")) {
            UiSupport.showInfo(this, "提示", "请选择或填写后端镜像，例如 my-api:latest");
            return;
        }
        final String image = selectedImage;
        final int cport = containerPort;

        backendDeployButton.setEnabled(false);
        StringBuilder live = new StringBuilder();
        live.append("开始部署后端「").append(name).append("」...\n");
        live.append("方式：Docker 镜像\n");
        live.append("镜像：").append(image).append('\n');
        live.append("端口：").append(port).append(" -> 容器 ").append(cport).append('\n');
        if (!env.isEmpty()) {
            live.append("环境变量：").append(env.size()).append(" 项\n");
        }
        live.append('\n');
        if (outputConsumer != null) {
            outputConsumer.show("部署后端", live.toString());
        }

        new SwingWorker<String, String>() {
            @Override
            protected String doInBackground() throws Exception {
                return docker.deployBackend(name, image, port, cport, env, this::publish);
            }

            @Override
            protected void process(java.util.List<String> chunks) {
                for (String chunk : chunks) {
                    live.append(chunk).append('\n');
                }
                if (outputConsumer != null) {
                    outputConsumer.show("部署后端", live.toString());
                }
            }

            @Override
            protected void done() {
                backendDeployButton.setEnabled(true);
                try {
                    String result = get();
                    live.append('\n').append(result);
                    if (outputConsumer != null) {
                        outputConsumer.show("部署后端", live.toString());
                    }
                    showDeployedUrl(port, "java");
                    UiSupport.showInfo(DeployPanel.this, "部署完成", "后端「" + name + "」已部署成功");
                } catch (Exception ex) {
                    Throwable cause = ex.getCause() == null ? ex : ex.getCause();
                    live.append("\n部署失败：").append(cause.getMessage());
                    if (outputConsumer != null) {
                        outputConsumer.show("部署后端失败", live.toString());
                    }
                    UiSupport.showError(DeployPanel.this, "部署失败", cause.getMessage());
                }
            }
        }.execute();
    }

    private void deployNode() {
        if (docker == null) {
            needConnect();
            return;
        }
        String name = nodeNameField.getText().trim();
        if (name.isEmpty()) {
            UiSupport.showInfo(this, "提示", "请填写应用名称");
            return;
        }
        int hostPort;
        try {
            hostPort = Integer.parseInt(nodeHostPortField.getText().trim());
        } catch (Exception ex) {
            UiSupport.showInfo(this, "提示", "请填写正确的端口，例如 3000");
            return;
        }
        if (hostPort < 1 || hostPort > 65535) {
            UiSupport.showInfo(this, "提示", "端口需在 1~65535 之间");
            return;
        }
        if (selectedNodeZip == null) {
            UiSupport.showInfo(this, "提示", "请先选择 Node 项目 ZIP（内含 package.json）");
            return;
        }
        Object imageItem = nodeImageCombo.getEditor().getItem();
        if (imageItem == null || String.valueOf(imageItem).isBlank()) {
            imageItem = nodeImageCombo.getSelectedItem();
        }
        String nodeImage = imageItem == null ? DEFAULT_NODE_IMAGE : String.valueOf(imageItem).trim();
        if (nodeImage.isEmpty()) {
            nodeImage = DEFAULT_NODE_IMAGE;
        }
        String startCommand = nodeStartCommandField.getText().trim();
        if (startCommand.isEmpty()) {
            startCommand = "npm start";
        }
        final String image = nodeImage;
        final String start = startCommand;
        final Path zip = selectedNodeZip;
        final int port = hostPort;
        final Map<String, String> env = parseEnvText(nodeEnvArea.getText());

        nodeDeployButton.setEnabled(false);
        StringBuilder live = new StringBuilder();
        live.append("开始部署 Node「").append(name).append("」...\n");
        live.append("ZIP：").append(zip.getFileName()).append('\n');
        live.append("Node 镜像：").append(image).append('\n');
        live.append("启动命令：").append(start).append('\n');
        live.append("端口：").append(port).append('\n');
        if (!env.isEmpty()) {
            live.append("环境变量：").append(env.size()).append(" 项\n");
        }
        live.append('\n');
        if (outputConsumer != null) {
            outputConsumer.show("部署 Node", live.toString());
        }

        new SwingWorker<String, String>() {
            @Override
            protected String doInBackground() throws Exception {
                return docker.deployNodeZip(name, zip, port, image, start, env, this::publish);
            }

            @Override
            protected void process(java.util.List<String> chunks) {
                for (String chunk : chunks) {
                    live.append(chunk).append('\n');
                }
                if (outputConsumer != null) {
                    outputConsumer.show("部署 Node", live.toString());
                }
            }

            @Override
            protected void done() {
                nodeDeployButton.setEnabled(true);
                try {
                    String result = get();
                    live.append('\n').append(result);
                    if (outputConsumer != null) {
                        outputConsumer.show("部署 Node", live.toString());
                    }
                    showDeployedUrl(port, "node");
                    UiSupport.showInfo(DeployPanel.this, "部署完成", "Node「" + name + "」已部署成功");
                } catch (Exception ex) {
                    Throwable cause = ex.getCause() == null ? ex : ex.getCause();
                    live.append("\n部署失败：").append(cause.getMessage());
                    if (outputConsumer != null) {
                        outputConsumer.show("部署 Node 失败", live.toString());
                    }
                    UiSupport.showError(DeployPanel.this, "部署失败", cause.getMessage());
                }
            }
        }.execute();
    }

    private static Map<String, String> parseEnvText(String text) {
        Map<String, String> env = new LinkedHashMap<>();
        if (text == null || text.isBlank()) {
            return env;
        }
        for (String raw : text.split("\\R")) {
            String line = raw.trim();
            if (line.isEmpty() || line.startsWith("#")) {
                continue;
            }
            int idx = line.indexOf('=');
            if (idx <= 0) {
                continue;
            }
            String key = line.substring(0, idx).trim();
            String value = line.substring(idx + 1).trim();
            if (!key.isEmpty()) {
                env.put(key, value);
            }
        }
        return env;
    }

    private static String sanitizeName(String name) {
        return name.trim().toLowerCase().replaceAll("[^a-z0-9_.-]", "-");
    }

    private void refreshAllLists() {
        if (docker == null) {
            return;
        }
        UiSupport.runAsync(this, "刷新部署列表", () -> {
            var volumes = docker.listVolumes();
            var images = docker.listImages();
            return new Object[]{volumes, images};
        }, payload -> {
            @SuppressWarnings("unchecked")
            var volumes = (java.util.List<com.easyssh.model.VolumeInfo>) ((Object[]) payload)[0];
            @SuppressWarnings("unchecked")
            var lines = (java.util.List<String>) ((Object[]) payload)[1];
            fillVolumes(volumes);
            fillWebImages(lines);
            fillBackendImages(lines);
        });
    }

    private void refreshVolumes() {
        if (docker == null) {
            return;
        }
        UiSupport.runAsync(this, "刷新数据卷", docker::listVolumes, this::fillVolumes);
    }

    private void fillVolumes(java.util.List<com.easyssh.model.VolumeInfo> list) {
        String selectedSite = String.valueOf(siteVolumeCombo.getSelectedItem());
        siteVolumeCombo.removeAllItems();
        siteVolumeCombo.addItem("(请选择数据卷)");
        for (var v : list) {
            siteVolumeCombo.addItem(v.getName());
        }
        if (selectedSite != null) {
            siteVolumeCombo.setSelectedItem(selectedSite);
        }
    }

    private void refreshImages() {
        if (docker == null) {
            resetImageCombo(java.util.List.of());
            return;
        }
        UiSupport.runAsync(this, "刷新镜像", docker::listImages, this::fillWebImages);
    }

    private void fillWebImages(java.util.List<String> lines) {
        java.util.List<String> images = new java.util.ArrayList<>();
        for (String line : lines) {
            String name = line.split("\\|", 2)[0].trim();
            if (isWebImage(name)) {
                images.add(name);
            }
        }
        resetImageCombo(images);
    }

    private void refreshBackendImages() {
        if (docker == null) {
            resetBackendImageCombo(java.util.List.of());
            return;
        }
        UiSupport.runAsync(this, "刷新后端镜像", docker::listImages, this::fillBackendImages);
    }

    private void fillBackendImages(java.util.List<String> lines) {
        java.util.List<String> images = new java.util.ArrayList<>();
        for (String line : lines) {
            String name = line.split("\\|", 2)[0].trim();
            if (name.isBlank() || "<none>:<none>".equals(name)) {
                continue;
            }
            if (!isWebImage(name)) {
                images.add(name);
            }
        }
        if (images.isEmpty()) {
            for (String line : lines) {
                String name = line.split("\\|", 2)[0].trim();
                if (!name.isBlank() && !"<none>:<none>".equals(name)) {
                    images.add(name);
                }
            }
        }
        resetBackendImageCombo(images);
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

    private void resetBackendImageCombo(java.util.List<String> remoteImages) {
        String selected = String.valueOf(backendImageCombo.getEditor().getItem());
        if (selected == null || selected.isBlank() || "null".equals(selected)) {
            selected = String.valueOf(backendImageCombo.getSelectedItem());
        }
        backendImageCombo.removeAllItems();
        if (remoteImages.isEmpty()) {
            backendImageCombo.addItem("(可手动输入镜像，如 my-api:latest)");
        } else {
            for (String image : remoteImages) {
                backendImageCombo.addItem(image);
            }
        }
        if (selected != null && !selected.isBlank() && !"null".equals(selected)
                && !selected.startsWith("(") && containsImage(remoteImages, selected)) {
            backendImageCombo.setSelectedItem(selected);
        } else if (!remoteImages.isEmpty()) {
            backendImageCombo.setSelectedItem(remoteImages.get(0));
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

    private void showDeployedUrl(int port, String kind) {
        if (profile == null) {
            return;
        }
        String url = AccessUrlHelper.nginxHostUrl(profile, port);
        switch (kind == null ? "" : kind) {
            case "java" -> setBackendAccessUrl(url, "已部署 Java");
            case "node" -> setNodeAccessUrl(url, "已部署 Node");
            default -> setNginxAccessUrl(url, "已部署站点");
        }
        if (outputConsumer != null && url != null && !url.isBlank()) {
            outputConsumer.show("访问地址", "部署完成，可访问：\n" + url + "\n\n点击蓝色访问地址即可打开。");
        }
    }

    private void setNginxAccessUrl(String url, String label) {
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

    private void setBackendAccessUrl(String url, String label) {
        currentBackendUrl = url == null ? "" : url.trim();
        if (currentBackendUrl.isBlank()) {
            hideBackendAccess();
            return;
        }
        backendAccessLabel.setText(label + "：" + currentBackendUrl + "（点击打开）");
        backendAccessRow.setVisible(true);
        backendAccessRow.revalidate();
        backendAccessRow.repaint();
    }

    private void setNodeAccessUrl(String url, String label) {
        currentNodeUrl = url == null ? "" : url.trim();
        if (currentNodeUrl.isBlank()) {
            hideNodeAccess();
            return;
        }
        nodeAccessLabel.setText(label + "：" + currentNodeUrl + "（点击打开）");
        nodeAccessRow.setVisible(true);
        nodeAccessRow.revalidate();
        nodeAccessRow.repaint();
    }

    private void hideNginxAccess() {
        currentNginxUrl = "";
        nginxAccessLabel.setText("");
        nginxAccessRow.setVisible(false);
    }

    private void hideBackendAccess() {
        currentBackendUrl = "";
        backendAccessLabel.setText("");
        backendAccessRow.setVisible(false);
    }

    private void hideNodeAccess() {
        currentNodeUrl = "";
        nodeAccessLabel.setText("");
        nodeAccessRow.setVisible(false);
    }

    private void openAccessUrl(String url) {
        try {
            AccessUrlHelper.openInBrowser(url);
            if (outputConsumer != null) {
                outputConsumer.show("打开网页", "已在浏览器打开：\n" + url);
            }
        } catch (Exception ex) {
            UiSupport.showError(this, "无法打开网页", ex.getMessage());
        }
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
}
