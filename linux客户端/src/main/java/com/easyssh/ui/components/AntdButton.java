package com.easyssh.ui.components;

import com.easyssh.ui.theme.AppTheme;
import com.formdev.flatlaf.FlatClientProperties;

import javax.swing.JButton;
import javax.swing.BorderFactory;
import java.awt.Color;
import java.awt.Cursor;
import java.awt.Dimension;
import java.awt.Insets;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;

/**
 * Ant Design 风格按钮（Swing + FlatLaf 实现，非网页 Ant Design）。
 */
public final class AntdButton {
    public enum Type {
        DEFAULT,
        PRIMARY,
        SUCCESS,
        DANGER,
        TEXT,
        GHOST
    }

    private AntdButton() {
    }

    public static JButton of(String text, Type type, Runnable action) {
        JButton button = new JButton(text);
        button.setFocusPainted(false);
        button.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        button.setFont(AppTheme.pickFont(13.5f));
        button.setMargin(new Insets(0, 0, 0, 0));
        button.putClientProperty(FlatClientProperties.BUTTON_TYPE, FlatClientProperties.BUTTON_TYPE_BORDERLESS);
        button.putClientProperty(FlatClientProperties.STYLE,
                "arc:6; focusWidth:0; innerFocusWidth:0; toolbar.spacingInsets:0,0,0,0");

        Style style = styleOf(type);
        apply(button, style, false);

        button.addMouseListener(new MouseAdapter() {
            @Override
            public void mouseEntered(MouseEvent e) {
                if (button.isEnabled()) {
                    apply(button, style, true);
                }
            }

            @Override
            public void mouseExited(MouseEvent e) {
                apply(button, style, false);
            }
        });
        button.addActionListener(e -> action.run());
        return button;
    }

    public static JButton iconSquare(String text, Runnable action) {
        JButton button = of(text, Type.DEFAULT, action);
        button.setPreferredSize(new Dimension(32, 32));
        button.setFont(AppTheme.pickFont(16f));
        return button;
    }

    private static void apply(JButton button, Style style, boolean hover) {
        Color bg = hover ? style.hoverBg : style.bg;
        Color fg = hover ? style.hoverFg : style.fg;
        Color border = hover ? style.hoverBorder : style.border;
        button.setBackground(bg);
        button.setForeground(fg);
        button.setOpaque(true);
        button.setContentAreaFilled(true);
        button.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(border, 1, true),
                BorderFactory.createEmptyBorder(5, 14, 5, 14)
        ));
    }

    private static Style styleOf(Type type) {
        Color transparent = new Color(255, 255, 255, 0);
        return switch (type) {
            case PRIMARY -> new Style(
                    AppTheme.PRIMARY, Color.WHITE, AppTheme.PRIMARY,
                    AppTheme.PRIMARY_HOVER, Color.WHITE, AppTheme.PRIMARY_HOVER
            );
            case SUCCESS -> new Style(
                    AppTheme.SUCCESS, Color.WHITE, AppTheme.SUCCESS,
                    AppTheme.SUCCESS_HOVER, Color.WHITE, AppTheme.SUCCESS_HOVER
            );
            case DANGER -> new Style(
                    new Color(0xFFF1F0), AppTheme.DANGER, new Color(0xFFCCC7),
                    new Color(0xFFF2F0), new Color(0xCF1322), new Color(0xFFA39E)
            );
            case TEXT -> new Style(
                    transparent, AppTheme.TEXT, transparent,
                    new Color(0xF5F5F5), AppTheme.PRIMARY, transparent
            );
            case GHOST -> new Style(
                    transparent, AppTheme.PRIMARY, AppTheme.PRIMARY,
                    new Color(0xE6F4FF), AppTheme.PRIMARY_HOVER, AppTheme.PRIMARY_HOVER
            );
            default -> new Style(
                    Color.WHITE, AppTheme.TEXT, AppTheme.BORDER,
                    new Color(0xF5F5F5), AppTheme.PRIMARY, AppTheme.PRIMARY
            );
        };
    }

    private record Style(Color bg, Color fg, Color border, Color hoverBg, Color hoverFg, Color hoverBorder) {
    }
}
