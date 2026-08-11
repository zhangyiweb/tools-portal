package com.easyssh.ui;

import com.easyssh.model.ServerProfile;
import com.easyssh.ui.theme.AppTheme;

import javax.swing.BorderFactory;
import javax.swing.JDialog;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import javax.swing.ListSelectionModel;
import javax.swing.table.DefaultTableModel;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.FlowLayout;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

/**
 * FinalShell 风格的服务器管理弹窗：列表 + 添加/编辑/删除/连接。
 */
public class ServerManagerDialog extends JDialog {
    private final DefaultTableModel model = new DefaultTableModel(
            new Object[]{"名称", "主机", "端口", "用户", "登录方式"}, 0) {
        @Override
        public boolean isCellEditable(int row, int column) {
            return false;
        }
    };
    private final JTable table = new JTable(model);
    private final List<ServerProfile> profiles;
    private final Runnable onChanged;
    private final Consumer<ServerProfile> onConnect;
    private ServerProfile connectTarget;

    public ServerManagerDialog(JFrame owner,
                               List<ServerProfile> profiles,
                               Runnable onChanged,
                               Consumer<ServerProfile> onConnect) {
        super(owner, "服务器管理", true);
        this.profiles = profiles;
        this.onChanged = onChanged;
        this.onConnect = onConnect;

        setSize(720, 480);
        setMinimumSize(new Dimension(640, 420));
        setLocationRelativeTo(owner);
        setLayout(new BorderLayout(0, 0));
        getContentPane().setBackground(AppTheme.BG);

        JPanel header = new JPanel(new BorderLayout());
        header.setBackground(AppTheme.SURFACE);
        header.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createMatteBorder(0, 0, 1, 0, AppTheme.BORDER),
                BorderFactory.createEmptyBorder(14, 18, 14, 18)
        ));
        header.add(AppTheme.title("我的服务器", 18f), BorderLayout.WEST);
        header.add(AppTheme.muted("双击一行可直接连接，或选中后点「连接」"), BorderLayout.EAST);

        AppTheme.styleTable(table);
        table.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        table.setRowHeight(34);
        table.addMouseListener(new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent e) {
                if (e.getClickCount() == 2) {
                    connectSelected();
                }
            }
        });

        JScrollPane scroll = new JScrollPane(table);
        scroll.setBorder(BorderFactory.createEmptyBorder(12, 16, 8, 16));
        scroll.getViewport().setBackground(AppTheme.SURFACE);

        JPanel actions = new JPanel(new BorderLayout());
        actions.setBackground(AppTheme.SURFACE);
        actions.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createMatteBorder(1, 0, 0, 0, AppTheme.BORDER),
                BorderFactory.createEmptyBorder(10, 16, 12, 16)
        ));

        JPanel left = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));
        left.setOpaque(false);
        left.add(UiSupport.primaryButton("添加", this::addServer));
        left.add(UiSupport.button("编辑", this::editServer));
        left.add(UiSupport.dangerButton("删除", this::deleteServer));

        JPanel right = new JPanel(new FlowLayout(FlowLayout.RIGHT, 8, 0));
        right.setOpaque(false);
        right.add(UiSupport.button("关闭", this::dispose));
        right.add(UiSupport.successButton("连接", this::connectSelected));

        actions.add(left, BorderLayout.WEST);
        actions.add(right, BorderLayout.EAST);

        add(header, BorderLayout.NORTH);
        add(scroll, BorderLayout.CENTER);
        add(actions, BorderLayout.SOUTH);

        reloadTable();
    }

    public ServerProfile getConnectTarget() {
        return connectTarget;
    }

    private void reloadTable() {
        model.setRowCount(0);
        for (ServerProfile p : profiles) {
            model.addRow(new Object[]{
                    p.getName(),
                    p.getHost(),
                    p.getPort(),
                    p.getUsername(),
                    p.getAuthType() == ServerProfile.AuthType.PRIVATE_KEY ? "私钥" : "密码"
            });
        }
    }

    private ServerProfile selected() {
        int row = table.getSelectedRow();
        if (row < 0 || row >= profiles.size()) {
            return null;
        }
        return profiles.get(row);
    }

    private void addServer() {
        ServerEditDialog dialog = new ServerEditDialog((JFrame) getOwner(), null);
        dialog.setVisible(true);
        ServerProfile result = dialog.getResult();
        if (result != null) {
            profiles.add(result);
            onChanged.run();
            reloadTable();
            table.setRowSelectionInterval(profiles.size() - 1, profiles.size() - 1);
        }
    }

    private void editServer() {
        ServerProfile selected = selected();
        if (selected == null) {
            UiSupport.showInfo(this, "提示", "请先选择一台服务器");
            return;
        }
        ServerEditDialog dialog = new ServerEditDialog((JFrame) getOwner(), selected);
        dialog.setVisible(true);
        if (dialog.getResult() != null) {
            onChanged.run();
            int row = table.getSelectedRow();
            reloadTable();
            if (row >= 0 && row < profiles.size()) {
                table.setRowSelectionInterval(row, row);
            }
        }
    }

    private void deleteServer() {
        ServerProfile selected = selected();
        if (selected == null) {
            UiSupport.showInfo(this, "提示", "请先选择一台服务器");
            return;
        }
        if (!UiSupport.confirm(this, "删除确认", "确认删除「" + selected.getName() + "」？")) {
            return;
        }
        profiles.remove(selected);
        onChanged.run();
        reloadTable();
    }

    private void connectSelected() {
        ServerProfile selected = selected();
        if (selected == null) {
            UiSupport.showInfo(this, "提示", "请先选择一台服务器");
            return;
        }
        connectTarget = selected;
        dispose();
        if (onConnect != null) {
            onConnect.accept(selected);
        }
    }
}
