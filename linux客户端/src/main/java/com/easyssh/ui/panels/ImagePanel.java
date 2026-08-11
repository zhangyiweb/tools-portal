package com.easyssh.ui.panels;

import com.easyssh.service.DockerService;
import com.easyssh.ui.UiSupport;
import com.easyssh.ui.theme.AppTheme;

import javax.swing.BorderFactory;
import javax.swing.JComboBox;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import javax.swing.JTextField;
import javax.swing.table.DefaultTableModel;
import java.awt.BorderLayout;
import java.awt.FlowLayout;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import java.util.List;

/**
 * 镜像管理：拉取 / 运行任意镜像。
 */
public class ImagePanel extends JPanel {
    private final JComboBox<String> imagePreset = new JComboBox<>(new String[]{
            "网页服务器 nginx:latest",
            "数据库 mysql:8.0",
            "缓存 redis:7",
            "运行环境 node:20",
            "数据库 postgres:16",
            "自定义..."
    });
    private final JTextField imageField = new JTextField(16);
    private final JTextField containerNameField = new JTextField(10);
    private final JTextField portsField = new JTextField(10);
    private final JComboBox<String> volumeCombo = new JComboBox<>();
    private final JTextField mountPathField = new JTextField(16);

    private final DefaultTableModel imageModel = new DefaultTableModel(new Object[]{"镜像名称", "编号", "大小"}, 0) {
        @Override
        public boolean isCellEditable(int row, int column) {
            return false;
        }
    };
    private final JTable imageTable = new JTable(imageModel);

    private DockerService docker;
    private OutputConsumer outputConsumer;

    public interface OutputConsumer {
        void show(String title, String content);
    }

    public ImagePanel() {
        setLayout(new BorderLayout(12, 12));
        setBackground(AppTheme.BG);
        setBorder(BorderFactory.createEmptyBorder(14, 14, 14, 14));

        JLabel title = AppTheme.title("镜像管理", 17f);
        JLabel tip = AppTheme.muted("拉取并运行任意镜像（MySQL、Redis、Nginx 等），端口格式如 3306:3306");

        JPanel titleBox = new JPanel(new BorderLayout(0, 2));
        titleBox.setOpaque(false);
        titleBox.add(title, BorderLayout.NORTH);
        titleBox.add(tip, BorderLayout.SOUTH);

        JPanel form = new JPanel(new GridBagLayout());
        form.setOpaque(false);
        GridBagConstraints c = new GridBagConstraints();
        c.insets = new Insets(6, 4, 6, 4);
        c.fill = GridBagConstraints.HORIZONTAL;
        c.weightx = 1;

        volumeCombo.addItem("(不绑定数据卷)");

        int row = 0;
        addForm(form, c, row++, "常用镜像", imagePreset);
        addForm(form, c, row++, "镜像名称", imageField);
        addForm(form, c, row++, "容器名称", containerNameField);
        addForm(form, c, row++, "端口映射", portsField);
        addForm(form, c, row++, "绑定数据卷", volumeCombo);
        addForm(form, c, row, "卷挂载路径", mountPathField);

        JPanel actions = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 8));
        actions.setOpaque(false);
        actions.add(UiSupport.primaryButton("拉取镜像", this::pullImage));
        actions.add(UiSupport.successButton("运行容器", this::runContainer));
        actions.add(UiSupport.button("刷新镜像", this::refreshImages));
        actions.add(UiSupport.button("刷新数据卷", this::refreshVolumes));
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

        imagePreset.addActionListener(e -> {
            String selected = String.valueOf(imagePreset.getSelectedItem());
            if (selected.contains("nginx")) {
                imageField.setText("nginx:latest");
                portsField.setText("80:80");
                mountPathField.setText("/usr/share/nginx/html");
            } else if (selected.contains("mysql")) {
                imageField.setText("mysql:8.0");
                portsField.setText("3306:3306");
                mountPathField.setText("/var/lib/mysql");
            } else if (selected.contains("redis")) {
                imageField.setText("redis:7");
                portsField.setText("6379:6379");
                mountPathField.setText("/data");
            } else if (selected.contains("node")) {
                imageField.setText("node:20");
            } else if (selected.contains("postgres")) {
                imageField.setText("postgres:16");
                portsField.setText("5432:5432");
                mountPathField.setText("/var/lib/postgresql/data");
            }
        });
    }

    public void setOutputConsumer(OutputConsumer outputConsumer) {
        this.outputConsumer = outputConsumer;
    }

    public void bind(DockerService docker) {
        this.docker = docker;
        refreshImages();
        refreshVolumes();
    }

    public void clear() {
        this.docker = null;
        imageModel.setRowCount(0);
        imageField.setText("");
        containerNameField.setText("");
        portsField.setText("");
        mountPathField.setText("");
        volumeCombo.removeAllItems();
        volumeCombo.addItem("(不绑定数据卷)");
    }

    private void pullImage() {
        if (docker == null) {
            UiSupport.showInfo(this, "提示", "请先连接服务器");
            return;
        }
        runOps("拉取镜像", () -> docker.pullImage(imageField.getText()), this::refreshImages);
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
            // 无名称时用编号删除
            imageName = String.valueOf(imageModel.getValueAt(row, 1));
        }
        String target = imageName;
        if (!UiSupport.confirm(this, "删除镜像",
                "确认删除镜像「" + target + "」？\n若仍有容器在使用该镜像，删除可能失败。")) {
            return;
        }
        runOps("删除镜像", () -> docker.removeImage(target), this::refreshImages);
    }

    private void runContainer() {
        if (docker == null) {
            UiSupport.showInfo(this, "提示", "请先连接服务器");
            return;
        }
        String volume = String.valueOf(volumeCombo.getSelectedItem());
        if (volume == null || volume.startsWith("(不绑定")) {
            volume = null;
        }
        String mountPath = mountPathField.getText().trim();
        String finalVolume = volume;
        runOps("运行容器", () -> docker.runImage(
                imageField.getText(),
                containerNameField.getText(),
                portsField.getText(),
                finalVolume,
                mountPath,
                null
        ), this::refreshImages);
    }

    private void refreshImages() {
        if (docker == null) {
            return;
        }
        UiSupport.runAsync(this, "刷新镜像列表", docker::listImages, this::fillImages);
    }

    private void refreshVolumes() {
        if (docker == null) {
            return;
        }
        UiSupport.runAsync(this, "刷新数据卷", docker::listVolumes, list -> {
            String selected = String.valueOf(volumeCombo.getSelectedItem());
            volumeCombo.removeAllItems();
            volumeCombo.addItem("(不绑定数据卷)");
            for (var v : list) {
                volumeCombo.addItem(v.getName());
            }
            if (selected != null) {
                volumeCombo.setSelectedItem(selected);
            }
        });
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
        form.add(new JLabel(label), c);
        c.gridx = 1;
        c.weightx = 1;
        form.add(field, c);
    }

    @FunctionalInterface
    private interface ThrowingSupplier<T> {
        T get() throws Exception;
    }
}
