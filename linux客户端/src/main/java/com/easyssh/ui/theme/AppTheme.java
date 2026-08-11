package com.easyssh.ui.theme;

import com.formdev.flatlaf.FlatLightLaf;

import javax.swing.BorderFactory;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.UIManager;
import javax.swing.border.Border;
import javax.swing.border.TitledBorder;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;

public final class AppTheme {
    // Ant Design 5 风格色板（Swing 主题模拟，非网页组件库）
    public static final Color BG = new Color(0xF5F5F5);
    public static final Color SURFACE = new Color(0xFFFFFF);
    public static final Color SURFACE_SOFT = new Color(0xFAFAFA);
    public static final Color BORDER = new Color(0xD9D9D9);
    public static final Color TEXT = new Color(0x262626);
    public static final Color TEXT_MUTED = new Color(0x8C8C8C);
    public static final Color PRIMARY = new Color(0x1677FF);
    public static final Color PRIMARY_HOVER = new Color(0x4096FF);
    public static final Color PRIMARY_DARK = new Color(0x0958D9);
    public static final Color SUCCESS = new Color(0x52C41A);
    public static final Color SUCCESS_HOVER = new Color(0x73D13D);
    public static final Color WARNING = new Color(0xFAAD14);
    public static final Color DANGER = new Color(0xFF4D4F);
    public static final Color CHART_CPU = new Color(0x1677FF);
    public static final Color CHART_MEM = new Color(0x13C2C2);
    public static final Color CHART_DISK = new Color(0x52C41A);
    public static final Color TOP_BAR = new Color(0x001529);
    public static final Color TOP_BAR_TEXT = new Color(0xA6ADB4);

    private AppTheme() {
    }

    public static void install() {
        FlatLightLaf.setup();
        Font ui = pickFont(14f);
        Font uiBold = ui.deriveFont(Font.BOLD);

        UIManager.put("defaultFont", ui);
        UIManager.put("Label.font", ui);
        UIManager.put("Button.font", ui);
        UIManager.put("Table.font", ui);
        UIManager.put("Tree.font", ui);
        UIManager.put("TabbedPane.font", uiBold);
        UIManager.put("TextField.font", ui);
        UIManager.put("TextArea.font", pickCodeFont(13f));

        UIManager.put("Button.arc", 6);
        UIManager.put("Component.arc", 6);
        UIManager.put("TextComponent.arc", 6);
        UIManager.put("ProgressBar.arc", 999);
        UIManager.put("ScrollBar.width", 10);

        UIManager.put("Panel.background", BG);
        UIManager.put("Viewport.background", SURFACE);
        UIManager.put("Table.background", SURFACE);
        UIManager.put("Table.selectionBackground", new Color(0xE6F4FF));
        UIManager.put("Table.selectionForeground", TEXT);
        UIManager.put("Table.gridColor", new Color(0xF0F0F0));
        UIManager.put("Tree.background", SURFACE);
        UIManager.put("Tree.foreground", TEXT);
        UIManager.put("Tree.textForeground", TEXT);
        UIManager.put("Tree.selectionBackground", new Color(0xE6F4FF));
        UIManager.put("Tree.selectionForeground", TEXT);
        UIManager.put("Tree.selectionInactiveBackground", new Color(0xE6F4FF));
        UIManager.put("Tree.selectionInactiveForeground", TEXT);
        UIManager.put("TabbedPane.selectedBackground", SURFACE);
        UIManager.put("TabbedPane.background", SURFACE_SOFT);
        UIManager.put("TabbedPane.hoverColor", new Color(0xE6F4FF));
        UIManager.put("Button.background", SURFACE);
        UIManager.put("Button.foreground", TEXT);
        UIManager.put("Label.foreground", TEXT);
        UIManager.put("OptionPane.background", SURFACE);
        UIManager.put("OptionPane.messageForeground", TEXT);
        UIManager.put("OptionPane.messageFont", ui);
        UIManager.put("OptionPane.buttonFont", ui);
        UIManager.put("OptionPane.yesButtonText", "确定");
        UIManager.put("OptionPane.noButtonText", "取消");
        UIManager.put("OptionPane.okButtonText", "确定");
        UIManager.put("OptionPane.cancelButtonText", "取消");
        UIManager.put("Component.focusColor", PRIMARY);
        UIManager.put("ProgressBar.foreground", PRIMARY);
        UIManager.put("ProgressBar.background", new Color(0xF0F0F0));
        UIManager.put("ScrollPane.border", BorderFactory.createLineBorder(BORDER));
        UIManager.put("TitlePane.unifiedBackground", true);
    }

    public static Font pickFont(float size) {
        String[] candidates = {"微软雅黑", "Microsoft YaHei UI", "PingFang SC", "Noto Sans CJK SC", "SansSerif"};
        for (String name : candidates) {
            Font font = new Font(name, Font.PLAIN, Math.round(size));
            if (!font.getFamily().equalsIgnoreCase("Dialog") || name.equals("SansSerif")) {
                if (font.canDisplay('中') || name.equals("SansSerif")) {
                    return font.deriveFont(size);
                }
            }
        }
        return new Font(Font.SANS_SERIF, Font.PLAIN, Math.round(size));
    }

    /**
     * 代码/日志区字体：优先等宽且能显示中文，否则回退到中文 UI 字体（避免方框乱码）。
     */
    public static Font pickMono(float size) {
        return pickCodeFont(size);
    }

    public static Font pickCodeFont(float size) {
        String[] candidates = {
                "Sarasa Mono SC",
                "Sarasa Gothic SC",
                "Source Han Mono SC",
                "Noto Sans Mono CJK SC",
                "Microsoft YaHei Mono",
                "Cascadia Mono",
                "Consolas",
                "微软雅黑",
                "Microsoft YaHei UI",
                "Monospaced"
        };
        for (String name : candidates) {
            Font font = new Font(name, Font.PLAIN, Math.round(size));
            if (font.canDisplay('中') && font.canDisplay('A') && font.canDisplay('0')) {
                return font.deriveFont(size);
            }
        }
        return pickFont(size);
    }

    public static Border cardBorder(String title) {
        TitledBorder titled = BorderFactory.createTitledBorder(
                BorderFactory.createLineBorder(BORDER, 1, true),
                title
        );
        titled.setTitleFont(pickFont(13f).deriveFont(Font.BOLD));
        titled.setTitleColor(TEXT);
        return BorderFactory.createCompoundBorder(
                titled,
                BorderFactory.createEmptyBorder(8, 10, 10, 10)
        );
    }

    public static JPanel card(String title) {
        JPanel panel = new SoftCardPanel();
        panel.setLayout(new java.awt.BorderLayout(8, 8));
        panel.setBorder(cardBorder(title));
        panel.setOpaque(false);
        return panel;
    }

    public static JLabel muted(String text) {
        JLabel label = new JLabel(text);
        label.setForeground(TEXT_MUTED);
        label.setFont(pickFont(12f));
        return label;
    }

    public static JLabel title(String text, float size) {
        JLabel label = new JLabel(text);
        label.setForeground(TEXT);
        label.setFont(pickFont(size).deriveFont(Font.BOLD));
        return label;
    }

    public static void styleTable(javax.swing.JTable table) {
        table.setRowHeight(28);
        table.setShowHorizontalLines(true);
        table.setShowVerticalLines(false);
        table.setIntercellSpacing(new java.awt.Dimension(0, 1));
        table.getTableHeader().setFont(pickFont(12.5f).deriveFont(Font.BOLD));
        table.getTableHeader().setBackground(SURFACE_SOFT);
        table.getTableHeader().setForeground(TEXT_MUTED);
        table.setFillsViewportHeight(true);
        table.setSelectionBackground(new Color(0xE6F4FF));
    }

    public static void paintSoftBackground(Graphics g, JComponent c) {
        Graphics2D g2 = (Graphics2D) g.create();
        g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g2.setColor(SURFACE);
        g2.fillRoundRect(0, 0, c.getWidth() - 1, c.getHeight() - 1, 16, 16);
        g2.setColor(BORDER);
        g2.drawRoundRect(0, 0, c.getWidth() - 1, c.getHeight() - 1, 16, 16);
        g2.dispose();
    }

    public static class SoftCardPanel extends JPanel {
        public SoftCardPanel() {
            setOpaque(false);
        }

        @Override
        protected void paintComponent(Graphics g) {
            paintSoftBackground(g, this);
            super.paintComponent(g);
        }
    }
}
