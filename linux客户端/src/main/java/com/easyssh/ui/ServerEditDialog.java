package com.easyssh.ui;

import com.easyssh.model.ServerProfile;
import com.easyssh.ui.theme.AppTheme;

import javax.swing.BorderFactory;
import javax.swing.ButtonGroup;
import javax.swing.JDialog;
import javax.swing.JFileChooser;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JPasswordField;
import javax.swing.JRadioButton;
import javax.swing.JSpinner;
import javax.swing.JTextField;
import javax.swing.SpinnerNumberModel;
import java.awt.BorderLayout;
import java.awt.FlowLayout;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;

public class ServerEditDialog extends JDialog {
    private final JTextField nameField = new JTextField();
    private final JTextField hostField = new JTextField();
    private final JSpinner portSpinner = new JSpinner(new SpinnerNumberModel(22, 1, 65535, 1));
    private final JTextField userField = new JTextField("root");
    private final JPasswordField passwordField = new JPasswordField();
    private final JTextField keyPathField = new JTextField();
    private final JRadioButton passwordAuth = new JRadioButton("密码登录", true);
    private final JRadioButton keyAuth = new JRadioButton("私钥登录");
    private ServerProfile result;

    public ServerEditDialog(JFrame owner, ServerProfile existing) {
        super(owner, existing == null ? "添加服务器" : "编辑服务器", true);
        setSize(540, 460);
        setLocationRelativeTo(owner);
        setLayout(new BorderLayout());
        getContentPane().setBackground(AppTheme.BG);

        JPanel header = new JPanel(new BorderLayout());
        header.setBackground(AppTheme.SURFACE);
        header.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createMatteBorder(0, 0, 1, 0, AppTheme.BORDER),
                BorderFactory.createEmptyBorder(14, 18, 14, 18)
        ));
        header.add(AppTheme.title(existing == null ? "添加服务器" : "编辑服务器", 17f), BorderLayout.WEST);
        header.add(AppTheme.muted("填写连接信息后保存"), BorderLayout.EAST);

        JPanel form = new JPanel(new GridBagLayout());
        form.setOpaque(false);
        form.setBorder(BorderFactory.createEmptyBorder(18, 20, 12, 20));
        GridBagConstraints c = new GridBagConstraints();
        c.insets = new Insets(8, 6, 8, 6);
        c.fill = GridBagConstraints.HORIZONTAL;
        c.weightx = 1;

        int row = 0;
        addRow(form, c, row++, "显示名称", nameField);
        addRow(form, c, row++, "主机地址", hostField);
        addRow(form, c, row++, "端口", portSpinner);
        addRow(form, c, row++, "用户名", userField);

        ButtonGroup group = new ButtonGroup();
        group.add(passwordAuth);
        group.add(keyAuth);
        JPanel authPanel = new JPanel(new FlowLayout(FlowLayout.LEFT, 12, 0));
        authPanel.setOpaque(false);
        authPanel.add(passwordAuth);
        authPanel.add(keyAuth);
        addRow(form, c, row++, "登录方式", authPanel);
        addRow(form, c, row++, "密码", passwordField);

        JPanel keyPanel = new JPanel(new BorderLayout(8, 0));
        keyPanel.setOpaque(false);
        keyPanel.add(keyPathField, BorderLayout.CENTER);
        keyPanel.add(UiSupport.button("选择私钥", () -> {
            JFileChooser chooser = new JFileChooser();
            if (chooser.showOpenDialog(this) == JFileChooser.APPROVE_OPTION) {
                keyPathField.setText(chooser.getSelectedFile().getAbsolutePath());
            }
        }), BorderLayout.EAST);
        addRow(form, c, row, "私钥文件", keyPanel);

        passwordAuth.addActionListener(e -> refreshAuthEnabled());
        keyAuth.addActionListener(e -> refreshAuthEnabled());

        if (existing != null) {
            nameField.setText(existing.getName());
            hostField.setText(existing.getHost());
            portSpinner.setValue(existing.getPort());
            userField.setText(existing.getUsername());
            passwordField.setText(existing.getPassword());
            keyPathField.setText(existing.getPrivateKeyPath());
            if (existing.getAuthType() == ServerProfile.AuthType.PRIVATE_KEY) {
                keyAuth.setSelected(true);
            } else {
                passwordAuth.setSelected(true);
            }
        }
        refreshAuthEnabled();

        JPanel actions = new JPanel(new FlowLayout(FlowLayout.RIGHT, 8, 0));
        actions.setBackground(AppTheme.SURFACE);
        actions.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createMatteBorder(1, 0, 0, 0, AppTheme.BORDER),
                BorderFactory.createEmptyBorder(10, 16, 12, 16)
        ));
        actions.add(UiSupport.button("取消", this::dispose));
        actions.add(UiSupport.primaryButton("保存", () -> onSave(existing)));

        add(header, BorderLayout.NORTH);
        add(form, BorderLayout.CENTER);
        add(actions, BorderLayout.SOUTH);
    }

    private void onSave(ServerProfile existing) {
        if (hostField.getText().isBlank()) {
            UiSupport.showError(this, "校验失败", "请填写主机地址");
            return;
        }
        ServerProfile profile = existing == null ? new ServerProfile() : existing;
        profile.setName(nameField.getText().isBlank() ? hostField.getText().trim() : nameField.getText().trim());
        profile.setHost(hostField.getText().trim());
        profile.setPort((Integer) portSpinner.getValue());
        profile.setUsername(userField.getText().trim());
        profile.setPassword(new String(passwordField.getPassword()));
        profile.setPrivateKeyPath(keyPathField.getText().trim());
        profile.setAuthType(keyAuth.isSelected() ? ServerProfile.AuthType.PRIVATE_KEY : ServerProfile.AuthType.PASSWORD);
        result = profile;
        dispose();
    }

    private void refreshAuthEnabled() {
        boolean usePassword = passwordAuth.isSelected();
        passwordField.setEnabled(usePassword);
        keyPathField.setEnabled(!usePassword);
    }

    private static void addRow(JPanel form, GridBagConstraints c, int row, String label, java.awt.Component field) {
        c.gridx = 0;
        c.gridy = row;
        c.weightx = 0;
        JLabel lab = new JLabel(label);
        lab.setForeground(AppTheme.TEXT_MUTED);
        form.add(lab, c);
        c.gridx = 1;
        c.weightx = 1;
        form.add(field, c);
    }

    public ServerProfile getResult() {
        return result;
    }
}
