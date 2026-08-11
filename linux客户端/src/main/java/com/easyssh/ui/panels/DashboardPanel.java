package com.easyssh.ui.panels;

import com.easyssh.model.SystemStats;
import com.easyssh.service.ServerOpsService;
import com.easyssh.ui.UiSupport;

import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.SwingConstants;
import java.awt.BorderLayout;
import java.awt.Font;
import java.awt.GridLayout;

public class DashboardPanel extends JPanel {
    private final JLabel hostname = metric("-");
    private final JLabel osInfo = metric("-");
    private final JLabel uptime = metric("-");
    private final JLabel cpu = metric("-");
    private final JLabel memory = metric("-");
    private final JLabel disk = metric("-");
    private final JLabel load = metric("-");
    private ServerOpsService ops;

    public DashboardPanel() {
        setLayout(new BorderLayout(12, 12));
        setBorder(BorderFactory.createEmptyBorder(16, 16, 16, 16));

        JPanel header = new JPanel(new BorderLayout());
        JLabel title = new JLabel("服务器概览");
        title.setFont(title.getFont().deriveFont(Font.BOLD, 18f));
        header.add(title, BorderLayout.WEST);
        JButton refresh = UiSupport.button("刷新状态", this::refresh);
        header.add(refresh, BorderLayout.EAST);

        JPanel grid = new JPanel(new GridLayout(0, 2, 12, 12));
        grid.add(card("主机名", hostname));
        grid.add(card("系统", osInfo));
        grid.add(card("运行时长", uptime));
        grid.add(card("负载", load));
        grid.add(card("CPU 使用率", cpu));
        grid.add(card("内存", memory));
        grid.add(card("磁盘 /", disk));

        add(header, BorderLayout.NORTH);
        add(grid, BorderLayout.CENTER);
    }

    public void bind(ServerOpsService ops) {
        this.ops = ops;
        refresh();
    }

    public void clear() {
        this.ops = null;
        hostname.setText("-");
        osInfo.setText("-");
        uptime.setText("-");
        cpu.setText("-");
        memory.setText("-");
        disk.setText("-");
        load.setText("-");
    }

    private void refresh() {
        if (ops == null) {
            return;
        }
        UiSupport.runAsync(this, "刷新服务器状态", ops::fetchStats, this::apply);
    }

    private void apply(SystemStats stats) {
        hostname.setText(stats.getHostname());
        osInfo.setText("<html><body style='width:280px'>" + stats.getOsInfo() + "</body></html>");
        uptime.setText(stats.getUptime());
        cpu.setText(stats.getCpuUsage());
        memory.setText(stats.getMemoryUsage());
        disk.setText(stats.getDiskUsage());
        load.setText(stats.getLoadAverage());
    }

    private static JPanel card(String title, JLabel value) {
        JPanel panel = new JPanel(new BorderLayout(4, 8));
        panel.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createTitledBorder(title),
                BorderFactory.createEmptyBorder(8, 10, 10, 10)
        ));
        panel.add(value, BorderLayout.CENTER);
        return panel;
    }

    private static JLabel metric(String text) {
        JLabel label = new JLabel(text, SwingConstants.LEFT);
        label.setFont(label.getFont().deriveFont(Font.PLAIN, 15f));
        return label;
    }
}
