package com.easyssh.ui;

import com.easyssh.model.ServerProfile;
import com.easyssh.ui.components.AntdButton;
import com.easyssh.ui.theme.AppTheme;

import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JMenuItem;
import javax.swing.JPanel;
import javax.swing.JPopupMenu;
import javax.swing.SwingConstants;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Cursor;
import java.awt.Dimension;
import java.awt.FlowLayout;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.Supplier;

/**
 * 仅显示已连接会话 Tab 与快速连接「+」，不含管理入口。
 */
public class SessionTabBar extends JPanel {
    public record SessionItem(String key, ServerProfile profile, boolean connected) {
    }

    private final List<SessionItem> items = new ArrayList<>();
    private String selectedKey;
    private final JPanel tabsHost = new JPanel(new FlowLayout(FlowLayout.LEFT, 0, 0));
    private final JButton addButton;

    private Supplier<List<ServerProfile>> profilesSupplier = List::of;
    private Consumer<ServerProfile> onQuickConnect;
    private Consumer<String> onSelect;
    private Consumer<String> onClose;

    public SessionTabBar() {
        setLayout(new BorderLayout());
        setBackground(new Color(0xF0F0F0));
        setBorder(BorderFactory.createMatteBorder(0, 0, 1, 0, AppTheme.BORDER));
        setPreferredSize(new Dimension(0, 40));

        tabsHost.setOpaque(false);
        addButton = AntdButton.iconSquare("+", this::showQuickConnectMenu);

        JPanel center = new JPanel();
        center.setOpaque(false);
        center.setLayout(new BoxLayout(center, BoxLayout.X_AXIS));
        center.add(Box.createHorizontalStrut(8));
        center.add(tabsHost);
        center.add(Box.createHorizontalStrut(6));
        center.add(addButton);

        add(center, BorderLayout.WEST);
    }

    public void setProfilesSupplier(Supplier<List<ServerProfile>> profilesSupplier) {
        this.profilesSupplier = profilesSupplier == null ? List::of : profilesSupplier;
    }

    public void setOnQuickConnect(Consumer<ServerProfile> onQuickConnect) {
        this.onQuickConnect = onQuickConnect;
    }

    public void setOnSelect(Consumer<String> onSelect) {
        this.onSelect = onSelect;
    }

    public void setOnClose(Consumer<String> onClose) {
        this.onClose = onClose;
    }

    public void setSessions(List<SessionItem> sessions, String selectedKey) {
        items.clear();
        items.addAll(sessions);
        this.selectedKey = selectedKey;
        setVisible(!items.isEmpty());
        rebuild();
    }

    private void rebuild() {
        tabsHost.removeAll();
        for (int i = 0; i < items.size(); i++) {
            tabsHost.add(createTab(items.get(i), i + 1));
        }
        tabsHost.revalidate();
        tabsHost.repaint();
    }

    private void showQuickConnectMenu() {
        List<ServerProfile> profiles = profilesSupplier.get();
        if (profiles == null || profiles.isEmpty()) {
            return;
        }
        JPopupMenu menu = new JPopupMenu();
        menu.setBorder(BorderFactory.createLineBorder(AppTheme.BORDER));
        JLabel head = new JLabel("  快速连接");
        head.setFont(AppTheme.pickFont(12f));
        head.setForeground(AppTheme.TEXT_MUTED);
        head.setBorder(BorderFactory.createEmptyBorder(6, 4, 4, 4));
        menu.add(head);
        menu.addSeparator();
        for (ServerProfile profile : profiles) {
            JMenuItem item = new JMenuItem(profile.getName() + "  (" + profile.getHost() + ")");
            item.setFont(AppTheme.pickFont(13f));
            item.addActionListener(e -> {
                if (onQuickConnect != null) {
                    onQuickConnect.accept(profile);
                }
            });
            menu.add(item);
        }
        menu.show(addButton, 0, addButton.getHeight() + 2);
    }

    private JComponent createTab(SessionItem item, int index) {
        boolean selected = item.key().equals(selectedKey);
        JPanel tab = new JPanel(new BorderLayout(6, 0)) {
            @Override
            protected void paintComponent(Graphics g) {
                super.paintComponent(g);
                if (selected) {
                    Graphics2D g2 = (Graphics2D) g.create();
                    g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
                    g2.setColor(AppTheme.PRIMARY);
                    g2.fillRect(0, 0, getWidth(), 2);
                    g2.dispose();
                }
            }
        };
        tab.setOpaque(selected);
        tab.setBackground(selected ? Color.WHITE : new Color(0, true));
        tab.setBorder(BorderFactory.createEmptyBorder(6, 12, 6, 8));
        tab.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));

        JLabel title = new JLabel(index + "  " + item.profile().getName());
        title.setFont(AppTheme.pickFont(13f));
        title.setForeground(AppTheme.TEXT);
        title.setIconTextGap(8);
        title.setHorizontalTextPosition(SwingConstants.RIGHT);
        title.setIcon(new StatusDotIcon(item.connected() ? AppTheme.SUCCESS : AppTheme.WARNING));

        JButton close = UiSupport.textButton("x", () -> {
            if (onClose != null) {
                onClose.accept(item.key());
            }
        });
        close.setFont(AppTheme.pickFont(12f));
        close.setBorder(BorderFactory.createEmptyBorder(0, 4, 0, 2));
        close.setPreferredSize(new Dimension(22, 22));

        tab.add(title, BorderLayout.CENTER);
        tab.add(close, BorderLayout.EAST);
        tab.addMouseListener(new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent e) {
                if (onSelect != null) {
                    onSelect.accept(item.key());
                }
            }
        });
        return tab;
    }

    private static final class StatusDotIcon implements javax.swing.Icon {
        private final Color color;

        private StatusDotIcon(Color color) {
            this.color = color;
        }

        @Override
        public void paintIcon(java.awt.Component c, Graphics g, int x, int y) {
            Graphics2D g2 = (Graphics2D) g.create();
            g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2.setColor(color);
            g2.fillOval(x, y + 3, 8, 8);
            g2.dispose();
        }

        @Override
        public int getIconWidth() {
            return 10;
        }

        @Override
        public int getIconHeight() {
            return 14;
        }
    }
}
