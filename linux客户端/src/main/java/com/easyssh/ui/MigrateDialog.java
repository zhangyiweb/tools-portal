package com.easyssh.ui;

import com.easyssh.model.MigrateOptions;
import com.easyssh.model.ServerProfile;
import com.easyssh.ssh.SshClient;
import com.easyssh.ui.theme.AppTheme;

import javax.swing.BorderFactory;
import javax.swing.ButtonGroup;
import javax.swing.JCheckBox;
import javax.swing.JComboBox;
import javax.swing.JDialog;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JRadioButton;
import javax.swing.JTextField;
import javax.swing.SwingWorker;
import java.awt.BorderLayout;
import java.awt.FlowLayout;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class MigrateDialog extends JDialog {
    private final String originalImage;
    private final JComboBox<ServerProfile> targetCombo = new JComboBox<>();
    private final JTextField nameField = new JTextField();
    private final JRadioButton useTargetImageRadio = new JRadioButton("使用目标服务器已有镜像（推荐，只迁数据）", true);
    private final JRadioButton transferImageRadio = new JRadioButton("完整打包源容器镜像（体积大，最一致）", false);
    private final JComboBox<String> targetImageCombo = new JComboBox<>();
    private final JPanel targetImageRow = new JPanel(new BorderLayout(8, 0));
    private final JLabel imageHint = AppTheme.muted("");
    private final JCheckBox pullIfMissing = new JCheckBox("目标没有所选镜像时自动拉取", false);
    private final JCheckBox stopSource = new JCheckBox("迁移前停止源容器（推荐，保证数据一致）", false);
    private final JCheckBox includeVolumes = new JCheckBox("一并迁移数据卷 / 挂载目录", true);
    private final JCheckBox startAfter = new JCheckBox("迁移后在目标服务器自动启动", true);
    private final JCheckBox removeSource = new JCheckBox("迁移成功后删除源容器（危险，默认不勾选）", false);
    private Result result;
    private int imageLoadId;

    public record Result(ServerProfile target, MigrateOptions options) {
    }

    public MigrateDialog(JFrame owner, String containerName, String originalImage,
                         ServerProfile source, List<ServerProfile> profiles) {
        super(owner, "迁移容器到另一台服务器", true);
        this.originalImage = originalImage == null ? "" : originalImage.trim();
        setSize(620, 560);
        setLocationRelativeTo(owner);
        setLayout(new BorderLayout(12, 12));

        JPanel tip = new JPanel(new BorderLayout());
        tip.setBorder(BorderFactory.createEmptyBorder(14, 16, 0, 16));
        tip.setOpaque(false);
        tip.add(AppTheme.title("容器：" + containerName, 16f), BorderLayout.NORTH);
        String srcImageText = this.originalImage.isBlank() ? "未知" : this.originalImage;
        tip.add(AppTheme.muted("源镜像：" + srcImageText + "。优先选用目标机已有镜像重建，避免重复拉取/传输。"), BorderLayout.SOUTH);

        for (ServerProfile profile : profiles) {
            if (source != null && profile.getId().equals(source.getId())) {
                continue;
            }
            targetCombo.addItem(profile);
        }
        nameField.setText(containerName == null ? "" : containerName);

        ButtonGroup imageGroup = new ButtonGroup();
        imageGroup.add(useTargetImageRadio);
        imageGroup.add(transferImageRadio);
        useTargetImageRadio.setOpaque(false);
        transferImageRadio.setOpaque(false);
        useTargetImageRadio.addActionListener(e -> updateImageModeUi());
        transferImageRadio.addActionListener(e -> updateImageModeUi());

        targetImageCombo.setEditable(true);
        targetImageCombo.setPreferredSize(new java.awt.Dimension(320, 30));
        targetImageCombo.addItem("(请先选择目标服务器)");
        targetImageRow.setOpaque(false);
        targetImageRow.add(targetImageCombo, BorderLayout.CENTER);
        targetImageRow.add(UiSupport.button("刷新", this::reloadTargetImages), BorderLayout.EAST);

        pullIfMissing.setOpaque(false);
        stopSource.setOpaque(false);
        includeVolumes.setOpaque(false);
        startAfter.setOpaque(false);
        removeSource.setOpaque(false);

        JPanel form = new JPanel(new GridBagLayout());
        form.setBorder(BorderFactory.createEmptyBorder(8, 16, 8, 16));
        GridBagConstraints c = new GridBagConstraints();
        c.insets = new Insets(6, 6, 6, 6);
        c.fill = GridBagConstraints.HORIZONTAL;
        c.weightx = 1;

        int row = 0;
        addRow(form, c, row++, "目标服务器", targetCombo);
        addRow(form, c, row++, "目标容器名", nameField);

        c.gridx = 0;
        c.gridy = row++;
        c.gridwidth = 2;
        form.add(useTargetImageRadio, c);
        c.gridy = row++;
        form.add(transferImageRadio, c);

        addRow(form, c, row++, "目标镜像", targetImageRow);

        c.gridx = 0;
        c.gridy = row++;
        c.gridwidth = 2;
        c.weightx = 0;
        form.add(imageHint, c);
        c.weightx = 1;
        c.gridy = row++;
        form.add(pullIfMissing, c);
        c.gridy = row++;
        form.add(stopSource, c);
        c.gridy = row++;
        form.add(includeVolumes, c);
        c.gridy = row++;
        form.add(startAfter, c);
        c.gridy = row;
        form.add(removeSource, c);

        JPanel actions = new JPanel(new FlowLayout(FlowLayout.RIGHT, 8, 8));
        actions.add(UiSupport.button("取消", this::dispose));
        actions.add(UiSupport.primaryButton("开始迁移", this::onConfirm));

        add(tip, BorderLayout.NORTH);
        add(form, BorderLayout.CENTER);
        add(actions, BorderLayout.SOUTH);

        targetCombo.addActionListener(e -> reloadTargetImages());
        updateImageModeUi();
        if (targetCombo.getItemCount() > 0) {
            reloadTargetImages();
        }
    }

    private void updateImageModeUi() {
        boolean useTarget = useTargetImageRadio.isSelected();
        targetImageCombo.setEnabled(useTarget);
        pullIfMissing.setEnabled(useTarget);
        if (useTarget) {
            imageHint.setText("将用所选镜像 + 迁移过去的数据卷/配置创建容器；不会传输源机整包镜像。");
        } else {
            imageHint.setText("会 commit 源容器并整包传到目标机，体积大、耗时长，但与源环境最接近。");
        }
    }

    private void reloadTargetImages() {
        if (!useTargetImageRadio.isSelected()) {
            return;
        }
        ServerProfile target = (ServerProfile) targetCombo.getSelectedItem();
        int req = ++imageLoadId;
        if (target == null) {
            resetImageCombo(List.of(), "(请选择目标服务器)");
            return;
        }
        resetImageCombo(List.of(), "(正在读取目标镜像...)");
        targetImageCombo.setEnabled(false);

        new SwingWorker<List<String>, Void>() {
            @Override
            protected List<String> doInBackground() throws Exception {
                try (SshClient client = new SshClient(target)) {
                    client.connect();
                    SshClient.CommandResult result = client.exec(
                            "docker images --format \"{{.Repository}}:{{.Tag}}\" 2>/dev/null"
                                    + " || sudo docker images --format \"{{.Repository}}:{{.Tag}}\"",
                            120
                    );
                    if (!result.ok()) {
                        throw new IllegalStateException(result.combined());
                    }
                    List<String> images = new ArrayList<>();
                    for (String line : result.stdout().split("\\R")) {
                        String name = line.trim();
                        if (name.isEmpty() || "<none>:<none>".equals(name) || name.endsWith(":<none>")) {
                            continue;
                        }
                        images.add(name);
                    }
                    return images;
                }
            }

            @Override
            protected void done() {
                if (req != imageLoadId) {
                    return;
                }
                targetImageCombo.setEnabled(useTargetImageRadio.isSelected());
                try {
                    List<String> images = get();
                    resetImageCombo(images, images.isEmpty() ? "(目标暂无镜像，可手动输入如 nginx:latest)" : null);
                    preselectImage(images);
                } catch (Exception ex) {
                    Throwable cause = ex.getCause() == null ? ex : ex.getCause();
                    resetImageCombo(List.of(), "(读取失败，可手动输入镜像名)");
                    imageHint.setText("读取目标镜像失败：" + cause.getMessage());
                }
                updateImageModeUi();
            }
        }.execute();
    }

    private void resetImageCombo(List<String> images, String placeholder) {
        targetImageCombo.removeAllItems();
        if (placeholder != null) {
            targetImageCombo.addItem(placeholder);
        }
        for (String image : images) {
            targetImageCombo.addItem(image);
        }
    }

    private void preselectImage(List<String> images) {
        if (images.isEmpty()) {
            return;
        }
        if (!originalImage.isBlank()) {
            for (String image : images) {
                if (image.equals(originalImage)) {
                    targetImageCombo.setSelectedItem(image);
                    imageHint.setText("目标已有与源相同的镜像，将直接使用：" + image);
                    return;
                }
            }
            String repo = repoOf(originalImage);
            for (String image : images) {
                if (repoOf(image).equalsIgnoreCase(repo)) {
                    targetImageCombo.setSelectedItem(image);
                    imageHint.setText("目标已有同系列镜像（版本可能不同），已预选：" + image);
                    return;
                }
            }
        }
        targetImageCombo.setSelectedItem(images.get(0));
    }

    private static String repoOf(String image) {
        if (image == null || image.isBlank()) {
            return "";
        }
        String value = image.trim();
        int colon = value.lastIndexOf(':');
        if (colon > 0 && !value.substring(colon + 1).contains("/")) {
            value = value.substring(0, colon);
        }
        int slash = value.lastIndexOf('/');
        return (slash >= 0 ? value.substring(slash + 1) : value).toLowerCase(Locale.ROOT);
    }

    private void onConfirm() {
        ServerProfile target = (ServerProfile) targetCombo.getSelectedItem();
        if (target == null) {
            UiSupport.showError(this, "无法迁移", "请先添加并选择另一台目标服务器");
            return;
        }
        MigrateOptions options = new MigrateOptions();
        options.setTargetName(nameField.getText().trim());
        options.setStopSource(stopSource.isSelected());
        options.setIncludeVolumes(includeVolumes.isSelected());
        options.setStartAfterMigrate(startAfter.isSelected());
        options.setRemoveSourceAfterSuccess(removeSource.isSelected());

        if (useTargetImageRadio.isSelected()) {
            options.setImageMode(MigrateOptions.ImageMode.USE_TARGET_IMAGE);
            String image = readSelectedImage();
            if (image.isBlank() || image.startsWith("(")) {
                UiSupport.showError(this, "无法迁移", "请选择或填写目标服务器上的镜像，例如 nginx:latest");
                return;
            }
            options.setTargetImage(image);
            options.setPullIfMissing(pullIfMissing.isSelected());
        } else {
            options.setImageMode(MigrateOptions.ImageMode.TRANSFER_COMMITTED);
        }

        result = new Result(target, options);
        dispose();
    }

    private String readSelectedImage() {
        Object item = targetImageCombo.getEditor().getItem();
        if (item == null || String.valueOf(item).isBlank()) {
            item = targetImageCombo.getSelectedItem();
        }
        java.awt.Component editor = targetImageCombo.getEditor().getEditorComponent();
        if (editor instanceof JTextField field) {
            String typed = field.getText() == null ? "" : field.getText().trim();
            if (!typed.isEmpty()) {
                return typed;
            }
        }
        return item == null ? "" : String.valueOf(item).trim();
    }

    public Result getResult() {
        return result;
    }

    private static void addRow(JPanel form, GridBagConstraints c, int row, String label, java.awt.Component field) {
        c.gridx = 0;
        c.gridy = row;
        c.weightx = 0;
        c.gridwidth = 1;
        form.add(new JLabel(label), c);
        c.gridx = 1;
        c.weightx = 1;
        form.add(field, c);
    }
}
