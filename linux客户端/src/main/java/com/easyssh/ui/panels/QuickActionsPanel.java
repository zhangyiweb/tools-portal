package com.easyssh.ui.panels;

import com.easyssh.service.ServerOpsService;
import com.easyssh.ui.UiSupport;

import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;
import java.awt.BorderLayout;
import java.awt.FlowLayout;
import java.awt.Font;
import java.awt.GridLayout;

public class QuickActionsPanel extends JPanel {
    private ServerOpsService ops;
    private OutputConsumer outputConsumer;

    public interface OutputConsumer {
        void show(String title, String content);
    }

    public QuickActionsPanel() {
        setLayout(new BorderLayout(12, 12));
        setBorder(BorderFactory.createEmptyBorder(16, 16, 16, 16));

        JLabel title = new JLabel("常用操作（按钮代替命令）");
        title.setFont(title.getFont().deriveFont(Font.BOLD, 18f));
        JLabel tip = new JLabel("面向前端同学：点按钮即可，无需记忆 Linux / Docker 命令。");

        JPanel north = new JPanel(new BorderLayout(4, 8));
        north.add(title, BorderLayout.NORTH);
        north.add(tip, BorderLayout.SOUTH);

        JPanel grid = new JPanel(new GridLayout(0, 2, 12, 12));
        grid.add(actionButton("重载 Nginx 配置", "nginx-reload"));
        grid.add(actionButton("重启 Nginx", "nginx-restart"));
        grid.add(actionButton("查看 Nginx 状态", "nginx-status"));
        grid.add(actionButton("看 Nginx 错误日志", "nginx-error-log"));
        grid.add(actionButton("看 Nginx 访问日志", "nginx-access-log"));
        grid.add(actionButton("查看占用端口", "check-ports"));
        grid.add(actionButton("查看内存占用 TOP", "top-processes"));
        grid.add(actionButton("清理 /tmp 旧文件", "disk-cleanup-tmp"));
        grid.add(actionButton("重启 Docker 服务", "restart-docker"));
        grid.add(actionButton("更新 apt 软件源", "update-apt"));

        add(north, BorderLayout.NORTH);
        add(grid, BorderLayout.CENTER);

        JPanel note = new JPanel(new FlowLayout(FlowLayout.LEFT));
        note.add(new JLabel("提示：部分操作需要服务器用户具备 sudo 权限。"));
        add(note, BorderLayout.SOUTH);
    }

    public void setOutputConsumer(OutputConsumer outputConsumer) {
        this.outputConsumer = outputConsumer;
    }

    public void bind(ServerOpsService ops) {
        this.ops = ops;
    }

    public void clear() {
        this.ops = null;
    }

    private JButton actionButton(String label, String actionId) {
        JButton button = new JButton(label);
        button.setFont(button.getFont().deriveFont(Font.PLAIN, 14f));
        button.addActionListener(e -> runAction(label, actionId));
        return button;
    }

    private void runAction(String label, String actionId) {
        if (ops == null) {
            UiSupport.showInfo(this, "提示", "请先连接服务器");
            return;
        }
        UiSupport.runAsync(this, label, () -> ops.runQuickAction(actionId), result -> {
            if (outputConsumer != null) {
                outputConsumer.show(label, result);
            } else {
                UiSupport.showTextDialog(this, label, result);
            }
        });
    }
}
