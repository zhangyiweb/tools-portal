package com.easyssh.ui;

import com.easyssh.ui.theme.AppTheme;

import javax.swing.BorderFactory;
import javax.swing.JDialog;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.WindowConstants;
import java.awt.BorderLayout;
import java.awt.FlowLayout;
import java.awt.Font;
import java.awt.Window;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.util.function.Consumer;

public class FileEditDialog extends JDialog {
    private final JTextArea editor = new JTextArea();
    private final String remotePath;
    private String originalContent;
    private Consumer<String> onSaveHandler;
    private boolean saved;
    private boolean allowClose;

    public FileEditDialog(Window owner, String remotePath, String content) {
        super(owner, "编辑文件", ModalityType.APPLICATION_MODAL);
        this.remotePath = remotePath;
        this.originalContent = content == null ? "" : content;
        setDefaultCloseOperation(WindowConstants.DO_NOTHING_ON_CLOSE);
        setSize(860, 640);
        setLocationRelativeTo(owner);
        setLayout(new BorderLayout());
        getContentPane().setBackground(AppTheme.BG);

        JPanel header = new JPanel(new BorderLayout(8, 4));
        header.setBackground(AppTheme.SURFACE);
        header.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createMatteBorder(0, 0, 1, 0, AppTheme.BORDER),
                BorderFactory.createEmptyBorder(12, 16, 12, 16)
        ));
        header.add(AppTheme.title("编辑文件", 16f), BorderLayout.NORTH);
        JLabel pathLabel = AppTheme.muted(remotePath);
        pathLabel.setToolTipText(remotePath);
        header.add(pathLabel, BorderLayout.SOUTH);

        editor.setText(originalContent);
        editor.setCaretPosition(0);
        editor.setFont(new Font(Font.MONOSPACED, Font.PLAIN, 14));
        editor.setForeground(AppTheme.TEXT);
        editor.setBackground(AppTheme.SURFACE);
        editor.setBorder(BorderFactory.createEmptyBorder(10, 12, 10, 12));
        editor.setTabSize(4);
        editor.setLineWrap(false);

        JScrollPane scroll = new JScrollPane(editor);
        scroll.setBorder(BorderFactory.createEmptyBorder(12, 12, 0, 12));
        scroll.getViewport().setBackground(AppTheme.SURFACE);

        JPanel actions = new JPanel(new FlowLayout(FlowLayout.RIGHT, 8, 10));
        actions.setOpaque(false);
        actions.setBorder(BorderFactory.createEmptyBorder(4, 12, 8, 12));
        actions.add(UiSupport.button("取消", this::tryClose));
        actions.add(UiSupport.primaryButton("保存", this::requestSave));

        add(header, BorderLayout.NORTH);
        add(scroll, BorderLayout.CENTER);
        add(actions, BorderLayout.SOUTH);

        addWindowListener(new WindowAdapter() {
            @Override
            public void windowClosing(WindowEvent e) {
                tryClose();
            }
        });
    }

    private void requestSave() {
        if (onSaveHandler != null) {
            onSaveHandler.accept(editor.getText());
        }
    }

    private void tryClose() {
        if (allowClose || !isDirty() || UiSupport.confirm(this, "未保存的修改", "内容已修改，确定放弃并关闭？")) {
            allowClose = true;
            dispose();
        }
    }

    public void setOnSave(Consumer<String> onSave) {
        this.onSaveHandler = onSave;
    }

    public String getRemotePath() {
        return remotePath;
    }

    public String getContent() {
        return editor.getText();
    }

    public boolean isDirty() {
        return !editor.getText().equals(originalContent);
    }

    public void markSaved(String content) {
        this.originalContent = content == null ? "" : content;
        this.saved = true;
    }

    public boolean wasSaved() {
        return saved;
    }
}
