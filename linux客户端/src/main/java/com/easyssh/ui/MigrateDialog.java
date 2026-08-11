package com.easyssh.ui;

import com.easyssh.model.MigrateOptions;
import com.easyssh.model.ServerProfile;
import com.easyssh.ui.theme.AppTheme;

import javax.swing.BorderFactory;
import javax.swing.JCheckBox;
import javax.swing.JComboBox;
import javax.swing.JDialog;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JTextField;
import java.awt.BorderLayout;
import java.awt.FlowLayout;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import java.util.List;

public class MigrateDialog extends JDialog {
    private final JComboBox<ServerProfile> targetCombo = new JComboBox<>();
    private final JTextField nameField = new JTextField();
    private final JCheckBox stopSource = new JCheckBox("迁移前停止源容器（推荐，保证数据一致）", true);
    private final JCheckBox includeVolumes = new JCheckBox("一并迁移数据卷 / 挂载目录", true);
    private final JCheckBox startAfter = new JCheckBox("迁移后在目标服务器自动启动", true);
    private final JCheckBox removeSource = new JCheckBox("迁移成功后删除源容器（危险，默认不勾选）", false);
    private Result result;

    public record Result(ServerProfile target, MigrateOptions options) {
    }

    public MigrateDialog(JFrame owner, String containerName, ServerProfile source, List<ServerProfile> profiles) {
        super(owner, "迁移容器到另一台服务器", true);
        setSize(560, 420);
        setLocationRelativeTo(owner);
        setLayout(new BorderLayout(12, 12));

        JPanel tip = new JPanel(new BorderLayout());
        tip.setBorder(BorderFactory.createEmptyBorder(14, 16, 0, 16));
        tip.setOpaque(false);
        tip.add(AppTheme.title("容器：" + containerName, 16f), BorderLayout.NORTH);
        tip.add(AppTheme.muted("将打包镜像与数据卷，经本机中转后在目标服务器恢复。大容器可能需要较长时间。"), BorderLayout.SOUTH);

        for (ServerProfile profile : profiles) {
            if (source != null && profile.getId().equals(source.getId())) {
                continue;
            }
            targetCombo.addItem(profile);
        }
        nameField.setText(containerName == null ? "" : containerName);

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
        result = new Result(target, options);
        dispose();
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
