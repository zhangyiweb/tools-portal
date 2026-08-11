package com.easyssh.ui;

import com.easyssh.ui.components.AntdButton;
import com.easyssh.ui.theme.AppTheme;

import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JDialog;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.SwingUtilities;
import javax.swing.SwingWorker;
import java.awt.BorderLayout;
import java.awt.Component;
import java.awt.Cursor;
import java.awt.Dialog;
import java.awt.Dimension;
import java.awt.FlowLayout;
import java.awt.Frame;
import java.awt.Window;
import java.util.concurrent.Callable;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;

public final class UiSupport {
    private UiSupport() {
    }

    public static JButton button(String text, Runnable action) {
        return AntdButton.of(text, AntdButton.Type.DEFAULT, action);
    }

    public static JButton primaryButton(String text, Runnable action) {
        return AntdButton.of(text, AntdButton.Type.PRIMARY, action);
    }

    public static JButton successButton(String text, Runnable action) {
        return AntdButton.of(text, AntdButton.Type.SUCCESS, action);
    }

    public static JButton dangerButton(String text, Runnable action) {
        return AntdButton.of(text, AntdButton.Type.DANGER, action);
    }

    public static JButton ghostButton(String text, Runnable action) {
        return AntdButton.of(text, AntdButton.Type.GHOST, action);
    }

    public static JButton textButton(String text, Runnable action) {
        return AntdButton.of(text, AntdButton.Type.TEXT, action);
    }

    public static <T> void runAsync(Component parent, String busyMessage, Callable<T> task, Consumer<T> onSuccess) {
        setBusy(parent, true);
        new SwingWorker<T, Void>() {
            @Override
            protected T doInBackground() throws Exception {
                return task.call();
            }

            @Override
            protected void done() {
                setBusy(parent, false);
                try {
                    onSuccess.accept(get());
                } catch (Exception ex) {
                    Throwable cause = ex.getCause() == null ? ex : ex.getCause();
                    showError(parent, busyMessage + "失败", cause.getMessage());
                }
            }
        }.execute();
    }

    public static void runAsyncVoid(Component parent, String busyMessage, Runnable task, Runnable onSuccess) {
        runAsync(parent, busyMessage, () -> {
            task.run();
            return Boolean.TRUE;
        }, ignored -> onSuccess.run());
    }

    public static void showError(Component parent, String title, String message) {
        showMessage(parent, title, message == null ? "未知错误" : message);
    }

    public static void showInfo(Component parent, String title, String message) {
        showMessage(parent, title, message);
    }

    /**
     * 确认弹窗：显示完整文案与「取消 / 确定」按钮。
     */
    public static boolean confirm(Component parent, String title, String message) {
        Window owner = parent == null ? null : SwingUtilities.getWindowAncestor(parent);
        if (owner == null && parent instanceof Window window) {
            owner = window;
        }
        JDialog dialog = owner instanceof Frame
                ? new JDialog((Frame) owner, title == null ? "确认" : title, true)
                : new JDialog(owner, title == null ? "确认" : title, Dialog.ModalityType.APPLICATION_MODAL);
        dialog.setDefaultCloseOperation(JDialog.DISPOSE_ON_CLOSE);

        AtomicBoolean accepted = new AtomicBoolean(false);

        JLabel messageLabel = new JLabel("<html><body style='width:320px'>"
                + escapeHtml(message == null ? "" : message).replace("\n", "<br>")
                + "</body></html>");
        messageLabel.setFont(AppTheme.pickFont(14f));
        messageLabel.setForeground(AppTheme.TEXT);
        messageLabel.setBorder(BorderFactory.createEmptyBorder(8, 4, 8, 4));

        JPanel body = new JPanel(new BorderLayout(0, 12));
        body.setBackground(AppTheme.SURFACE);
        body.setBorder(BorderFactory.createEmptyBorder(18, 20, 12, 20));
        body.add(messageLabel, BorderLayout.CENTER);

        JPanel actions = new JPanel(new FlowLayout(FlowLayout.RIGHT, 8, 0));
        actions.setOpaque(false);
        actions.add(button("取消", dialog::dispose));
        actions.add(dangerButton("确定", () -> {
            accepted.set(true);
            dialog.dispose();
        }));
        body.add(actions, BorderLayout.SOUTH);

        dialog.setContentPane(body);
        dialog.pack();
        dialog.setMinimumSize(new Dimension(360, 140));
        dialog.setLocationRelativeTo(parent);
        dialog.setVisible(true);
        return accepted.get();
    }

    public static void showTextDialog(Component parent, String title, String content) {
        JTextArea area = new JTextArea(content == null ? "" : content);
        area.setEditable(false);
        area.setFont(AppTheme.pickCodeFont(13f));
        area.setLineWrap(true);
        area.setWrapStyleWord(true);
        JScrollPane scroll = new JScrollPane(area);
        scroll.setPreferredSize(new Dimension(720, 420));
        showMessage(parent, title, scroll);
    }

    private static void showMessage(Component parent, String title, Object message) {
        Window owner = parent == null ? null : SwingUtilities.getWindowAncestor(parent);
        if (owner == null && parent instanceof Window window) {
            owner = window;
        }
        JDialog dialog = owner instanceof Frame
                ? new JDialog((Frame) owner, title == null ? "提示" : title, true)
                : new JDialog(owner, title == null ? "提示" : title, Dialog.ModalityType.APPLICATION_MODAL);
        dialog.setDefaultCloseOperation(JDialog.DISPOSE_ON_CLOSE);

        JPanel body = new JPanel(new BorderLayout(0, 12));
        body.setBackground(AppTheme.SURFACE);
        body.setBorder(BorderFactory.createEmptyBorder(18, 20, 12, 20));

        if (message instanceof Component component) {
            body.add(component, BorderLayout.CENTER);
        } else {
            JLabel messageLabel = new JLabel("<html><body style='width:320px'>"
                    + escapeHtml(String.valueOf(message)).replace("\n", "<br>")
                    + "</body></html>");
            messageLabel.setFont(AppTheme.pickFont(14f));
            messageLabel.setForeground(AppTheme.TEXT);
            body.add(messageLabel, BorderLayout.CENTER);
        }

        JPanel actions = new JPanel(new FlowLayout(FlowLayout.RIGHT, 8, 0));
        actions.setOpaque(false);
        actions.add(primaryButton("确定", dialog::dispose));
        body.add(actions, BorderLayout.SOUTH);

        dialog.setContentPane(body);
        dialog.pack();
        dialog.setMinimumSize(new Dimension(360, 140));
        dialog.setLocationRelativeTo(parent);
        dialog.setVisible(true);
    }

    private static String escapeHtml(String text) {
        return text
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    private static void setBusy(Component parent, boolean busy) {
        SwingUtilities.invokeLater(() -> {
            if (parent != null) {
                parent.setCursor(busy
                        ? Cursor.getPredefinedCursor(Cursor.WAIT_CURSOR)
                        : Cursor.getDefaultCursor());
            }
        });
    }
}
