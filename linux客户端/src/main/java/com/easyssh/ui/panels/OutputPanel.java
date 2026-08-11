package com.easyssh.ui.panels;

import com.easyssh.ui.UiSupport;
import com.easyssh.ui.theme.AppTheme;

import javax.swing.BorderFactory;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import java.awt.BorderLayout;
import java.awt.FlowLayout;

public class OutputPanel extends JPanel {
    private final JLabel titleLabel = AppTheme.title("操作输出", 14f);
    private final JTextArea area = new JTextArea();

    public OutputPanel() {
        setLayout(new BorderLayout(8, 8));
        setBackground(AppTheme.SURFACE);
        setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createMatteBorder(1, 0, 0, 0, AppTheme.BORDER),
                BorderFactory.createEmptyBorder(10, 12, 12, 12)
        ));

        area.setEditable(false);
        area.setFont(AppTheme.pickCodeFont(13f));
        area.setBackground(new java.awt.Color(0x0F172A));
        area.setForeground(new java.awt.Color(0xE2E8F0));
        area.setCaretColor(java.awt.Color.WHITE);
        area.setLineWrap(true);
        area.setWrapStyleWord(true);
        area.setBorder(BorderFactory.createEmptyBorder(10, 12, 10, 12));
        area.setText("连接服务器后，按钮操作的结果会显示在这里。");

        JPanel top = new JPanel(new BorderLayout());
        top.setOpaque(false);
        top.add(titleLabel, BorderLayout.WEST);
        JPanel right = new JPanel(new FlowLayout(FlowLayout.RIGHT, 0, 0));
        right.setOpaque(false);
        right.add(UiSupport.button("清空", () -> area.setText("")));
        top.add(right, BorderLayout.EAST);

        JScrollPane scroll = new JScrollPane(area);
        scroll.setBorder(BorderFactory.createLineBorder(new java.awt.Color(0x1E293B), 1, true));

        add(top, BorderLayout.NORTH);
        add(scroll, BorderLayout.CENTER);
    }

    public void showOutput(String title, String content) {
        titleLabel.setText(title == null ? "操作输出" : title);
        area.setText(content == null ? "" : content);
        area.setCaretPosition(0);
    }
}
