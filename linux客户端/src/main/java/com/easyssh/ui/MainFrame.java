package com.easyssh.ui;

import com.easyssh.model.ServerProfile;
import com.easyssh.service.ServerProfileStore;
import com.easyssh.ssh.SshClient;
import com.easyssh.ui.theme.AppTheme;

import javax.swing.BorderFactory;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JPanel;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.Dimension;
import java.awt.FlowLayout;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class MainFrame extends JFrame {
    private final ServerProfileStore store = new ServerProfileStore();
    private final JLabel statusLabel = new JLabel("未连接");
    private final List<ServerProfile> profiles = new ArrayList<>();

    private final SessionTabBar sessionTabBar = new SessionTabBar();
    private final JPanel sessionCards = new JPanel(new CardLayout());
    private final JPanel emptyPanel = buildEmptyPanel();
    private final Map<String, ServerSessionPanel> sessions = new LinkedHashMap<>();
    private String activeKey;

    public MainFrame() {
        super("张怡 - 服务器管理客户端");
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setSize(1720, 960);
        setMinimumSize(new Dimension(1280, 780));
        setLocationRelativeTo(null);
        setLayout(new BorderLayout());
        getContentPane().setBackground(AppTheme.BG);

        sessionCards.setBackground(AppTheme.BG);
        sessionCards.add(emptyPanel, "empty");

        sessionTabBar.setProfilesSupplier(() -> List.copyOf(profiles));
        sessionTabBar.setOnQuickConnect(this::connectTo);
        sessionTabBar.setOnSelect(this::selectSession);
        sessionTabBar.setOnClose(this::closeSession);
        sessionTabBar.setVisible(false);

        add(sessionTabBar, BorderLayout.NORTH);
        add(sessionCards, BorderLayout.CENTER);
        add(buildBottomBar(), BorderLayout.SOUTH);

        loadProfiles();
        showEmpty();
        refreshTabBar();
    }

    private JPanel buildEmptyPanel() {
        JPanel panel = new JPanel(new BorderLayout());
        panel.setBackground(AppTheme.BG);
        JLabel tip = new JLabel("点击下方「服务器管理」添加并连接服务器", JLabel.CENTER);
        tip.setForeground(AppTheme.TEXT_MUTED);
        tip.setFont(AppTheme.pickFont(15f));
        panel.add(tip, BorderLayout.CENTER);
        return panel;
    }

    private JPanel buildBottomBar() {
        JPanel bar = new JPanel(new BorderLayout());
        bar.setBackground(AppTheme.SURFACE);
        bar.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createMatteBorder(1, 0, 0, 0, AppTheme.BORDER),
                BorderFactory.createEmptyBorder(10, 16, 10, 16)
        ));

        JPanel left = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));
        left.setOpaque(false);
        JLabel tip = AppTheme.muted("状态");
        statusLabel.setForeground(AppTheme.TEXT);
        statusLabel.setFont(AppTheme.pickFont(13f));
        left.add(tip);
        left.add(statusLabel);

        JPanel center = new JPanel(new FlowLayout(FlowLayout.CENTER, 0, 0));
        center.setOpaque(false);
        center.add(UiSupport.primaryButton("服务器管理", this::openServerManager));

        JPanel right = new JPanel(new FlowLayout(FlowLayout.RIGHT, 0, 0));
        right.setOpaque(false);
        right.setPreferredSize(left.getPreferredSize());

        bar.add(left, BorderLayout.WEST);
        bar.add(center, BorderLayout.CENTER);
        bar.add(right, BorderLayout.EAST);
        return bar;
    }

    private void openServerManager() {
        ServerManagerDialog dialog = new ServerManagerDialog(
                this,
                profiles,
                this::persist,
                this::connectTo
        );
        dialog.setVisible(true);
    }

    private void loadProfiles() {
        profiles.clear();
        profiles.addAll(store.load());
    }

    private void persist() {
        store.save(profiles);
    }

    private void connectTo(ServerProfile selected) {
        if (selected == null) {
            return;
        }
        String key = selected.getId();
        ServerSessionPanel existing = sessions.get(key);
        if (existing != null && existing.isConnected()) {
            selectSession(key);
            statusLabel.setText("已切换到：" + selected.displayLabel());
            return;
        }

        statusLabel.setText("正在连接 " + selected.getHost() + " ...");
        UiSupport.runAsync(this, "连接服务器", () -> {
            SshClient ssh = new SshClient(selected);
            ssh.connect();
            return ssh;
        }, ssh -> {
            ServerSessionPanel session = sessions.get(key);
            if (session == null) {
                session = new ServerSessionPanel(selected, () -> List.copyOf(profiles));
                sessions.put(key, session);
                sessionCards.add(session, key);
            } else {
                session.disposeSession();
            }
            session.attach(ssh);
            selectSession(key);
            statusLabel.setText("已连接：" + selected.displayLabel());
            refreshTabBar();
        });
    }

    private void selectSession(String key) {
        if (key == null || !sessions.containsKey(key)) {
            showEmpty();
            return;
        }
        activeKey = key;
        CardLayout layout = (CardLayout) sessionCards.getLayout();
        layout.show(sessionCards, key);
        ServerSessionPanel session = sessions.get(key);
        if (session != null) {
            statusLabel.setText("当前：" + session.getProfile().displayLabel());
        }
        refreshTabBar();
    }

    private void closeSession(String key) {
        ServerSessionPanel session = sessions.get(key);
        if (session == null) {
            return;
        }
        if (!UiSupport.confirm(this, "关闭连接", "关闭并断开「" + session.getProfile().getName() + "」？")) {
            return;
        }
        session.disposeSession();
        sessionCards.remove(session);
        sessions.remove(key);
        if (key.equals(activeKey)) {
            activeKey = null;
            if (!sessions.isEmpty()) {
                selectSession(sessions.keySet().iterator().next());
            } else {
                showEmpty();
            }
        } else {
            refreshTabBar();
        }
        statusLabel.setText(sessions.isEmpty() ? "未连接" : "已关闭一个连接");
    }

    private void showEmpty() {
        activeKey = null;
        CardLayout layout = (CardLayout) sessionCards.getLayout();
        layout.show(sessionCards, "empty");
        refreshTabBar();
    }

    private void refreshTabBar() {
        List<SessionTabBar.SessionItem> items = new ArrayList<>();
        for (Map.Entry<String, ServerSessionPanel> entry : sessions.entrySet()) {
            ServerSessionPanel panel = entry.getValue();
            items.add(new SessionTabBar.SessionItem(
                    entry.getKey(),
                    panel.getProfile(),
                    panel.isConnected()
            ));
        }
        sessionTabBar.setSessions(items, activeKey);
        revalidate();
    }
}
