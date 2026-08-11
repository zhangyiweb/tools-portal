package com.easyssh;

import com.easyssh.ui.MainFrame;
import com.easyssh.ui.theme.AppTheme;

import javax.swing.SwingUtilities;

public class EasySshApp {
    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            try {
                AppTheme.install();
            } catch (Exception ignored) {
                // 使用系统默认外观
            }
            MainFrame frame = new MainFrame();
            frame.setVisible(true);
        });
    }
}
