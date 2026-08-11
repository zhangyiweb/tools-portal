package com.easyssh.ui.panels;

import com.easyssh.model.DiskInfo;
import com.easyssh.model.ProcessInfo;
import com.easyssh.model.ServerProfile;
import com.easyssh.model.SystemStats;
import com.easyssh.service.ServerOpsService;
import com.easyssh.ui.UiSupport;
import com.easyssh.ui.theme.AppTheme;

import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JProgressBar;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import javax.swing.SwingConstants;
import javax.swing.Timer;
import javax.swing.table.DefaultTableModel;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.FlowLayout;
import java.awt.Toolkit;
import java.awt.datatransfer.StringSelection;

/**
 * FinalShell 风格紧凑左侧状态栏。
 */
public class SystemStatusPanel extends JPanel {
    private final JLabel syncLabel = AppTheme.muted("同步状态：未连接");
    private final JLabel ipLabel = new JLabel("IP -");
    private final JLabel uptimeLabel = new JLabel("运行 -");
    private final JLabel loadLabel = new JLabel("负载 -");

    private final JProgressBar cpuBar = bar();
    private final JProgressBar memBar = bar();
    private final JProgressBar swapBar = bar();
    private final JLabel cpuText = valueLabel("0%");
    private final JLabel memText = valueLabel("-");
    private final JLabel swapText = valueLabel("-");

    private final DefaultTableModel processModel = new DefaultTableModel(new Object[]{"内存", "CPU", "命令"}, 0) {
        @Override
        public boolean isCellEditable(int row, int column) {
            return false;
        }
    };
    private final DefaultTableModel diskModel = new DefaultTableModel(new Object[]{"路径", "可用/大小"}, 0) {
        @Override
        public boolean isCellEditable(int row, int column) {
            return false;
        }
    };

    private String currentIp = "";
    private ServerOpsService ops;
    private final Timer timer;

    public SystemStatusPanel() {
        setLayout(new BorderLayout(8, 8));
        setPreferredSize(new Dimension(300, 0));
        setBackground(AppTheme.SURFACE);
        setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createMatteBorder(0, 0, 0, 1, AppTheme.BORDER),
                BorderFactory.createEmptyBorder(10, 10, 10, 10)
        ));

        JPanel top = new JPanel();
        top.setOpaque(false);
        top.setLayout(new BoxLayout(top, BoxLayout.Y_AXIS));

        syncLabel.setAlignmentX(LEFT_ALIGNMENT);
        top.add(syncLabel);
        top.add(Box.createVerticalStrut(8));

        JPanel ipRow = new JPanel(new BorderLayout(6, 0));
        ipRow.setOpaque(false);
        ipRow.setAlignmentX(LEFT_ALIGNMENT);
        ipRow.setMaximumSize(new Dimension(Integer.MAX_VALUE, 28));
        stylePlain(ipLabel);
        ipRow.add(ipLabel, BorderLayout.CENTER);
        ipRow.add(UiSupport.button("复制", this::copyIp), BorderLayout.EAST);
        top.add(ipRow);
        top.add(Box.createVerticalStrut(8));

        stylePlain(uptimeLabel);
        stylePlain(loadLabel);
        uptimeLabel.setAlignmentX(LEFT_ALIGNMENT);
        loadLabel.setAlignmentX(LEFT_ALIGNMENT);
        top.add(uptimeLabel);
        top.add(Box.createVerticalStrut(4));
        top.add(loadLabel);
        top.add(Box.createVerticalStrut(10));

        JPanel gauges = new JPanel();
        gauges.setOpaque(false);
        gauges.setLayout(new BoxLayout(gauges, BoxLayout.Y_AXIS));
        gauges.setAlignmentX(LEFT_ALIGNMENT);
        gauges.add(gaugeRow("CPU", cpuBar, cpuText));
        gauges.add(Box.createVerticalStrut(8));
        gauges.add(gaugeRow("内存", memBar, memText));
        gauges.add(Box.createVerticalStrut(8));
        gauges.add(gaugeRow("交换", swapBar, swapText));
        top.add(gauges);

        JTable processTable = new JTable(processModel);
        AppTheme.styleTable(processTable);
        processTable.setRowHeight(22);
        JScrollPane processScroll = new JScrollPane(processTable);
        processScroll.setBorder(BorderFactory.createTitledBorder("进程"));
        processScroll.setPreferredSize(new Dimension(0, 160));

        JTable diskTable = new JTable(diskModel);
        AppTheme.styleTable(diskTable);
        diskTable.setRowHeight(22);
        JScrollPane diskScroll = new JScrollPane(diskTable);
        diskScroll.setBorder(BorderFactory.createTitledBorder("分区"));
        diskScroll.setPreferredSize(new Dimension(0, 140));

        JPanel lists = new JPanel(new BorderLayout(6, 8));
        lists.setOpaque(false);
        lists.add(processScroll, BorderLayout.CENTER);
        lists.add(diskScroll, BorderLayout.SOUTH);

        JPanel actions = new JPanel(new FlowLayout(FlowLayout.LEFT, 0, 0));
        actions.setOpaque(false);
        actions.add(UiSupport.button("刷新", this::refreshNow));

        add(top, BorderLayout.NORTH);
        add(lists, BorderLayout.CENTER);
        add(actions, BorderLayout.SOUTH);

        timer = new Timer(5000, e -> refreshNow());
        timer.setRepeats(true);
    }

    public void bind(ServerOpsService ops, ServerProfile profile) {
        this.ops = ops;
        syncLabel.setText(profile == null ? "同步状态：未连接" : "同步状态：同步中...");
        refreshNow();
        timer.start();
    }

    public void clear() {
        timer.stop();
        ops = null;
        syncLabel.setText("同步状态：未连接");
        currentIp = "";
        ipLabel.setText("IP -");
        uptimeLabel.setText("运行 -");
        loadLabel.setText("负载 -");
        setBar(cpuBar, cpuText, 0, "0%");
        setBar(memBar, memText, 0, "-");
        setBar(swapBar, swapText, 0, "-");
        processModel.setRowCount(0);
        diskModel.setRowCount(0);
    }

    private void refreshNow() {
        if (ops == null) {
            return;
        }
        UiSupport.runAsync(this, "刷新系统状态", ops::fetchStats, this::apply);
    }

    private void apply(SystemStats stats) {
        syncLabel.setText("同步状态：" + stats.getSyncTip());
        currentIp = stats.getIpAddress() == null ? "" : stats.getIpAddress().trim();
        ipLabel.setText("IP " + (currentIp.isBlank() || "-".equals(currentIp) ? "-" : currentIp));
        uptimeLabel.setText("运行 " + chineseUptime(stats.getUptime()));
        loadLabel.setText("负载 " + stats.getLoad1() + ", " + stats.getLoad5() + ", " + stats.getLoad15());

        setBar(cpuBar, cpuText, stats.getCpuPercent(), stats.getCpuPercent() + "%");
        setBar(memBar, memText, stats.getMemPercent(), formatMem(stats.getMemDetail()) + "  " + stats.getMemPercent() + "%");
        setBar(swapBar, swapText, stats.getSwapPercent(), formatMem(stats.getSwapDetail()) + "  " + stats.getSwapPercent() + "%");

        processModel.setRowCount(0);
        for (ProcessInfo p : stats.getTopProcesses()) {
            processModel.addRow(new Object[]{p.getMem(), p.getCpu(), p.shortCommand()});
        }

        diskModel.setRowCount(0);
        for (DiskInfo d : stats.getDisks()) {
            // FinalShell 风格：可用/大小
            diskModel.addRow(new Object[]{
                    d.getMount(),
                    d.getAvail() + "/" + d.getSize()
            });
        }
    }

    private void copyIp() {
        if (currentIp == null || currentIp.isBlank() || "-".equals(currentIp)) {
            UiSupport.showInfo(this, "提示", "当前没有可复制的 IP 地址");
            return;
        }
        Toolkit.getDefaultToolkit()
                .getSystemClipboard()
                .setContents(new StringSelection(currentIp), null);
        UiSupport.showInfo(this, "已复制", "IP 地址已复制：\n" + currentIp);
    }

    private static JPanel gaugeRow(String name, JProgressBar bar, JLabel value) {
        JPanel row = new JPanel(new BorderLayout(8, 2));
        row.setOpaque(false);
        row.setMaximumSize(new Dimension(Integer.MAX_VALUE, 36));
        JLabel label = new JLabel(name);
        label.setPreferredSize(new Dimension(36, 18));
        label.setForeground(AppTheme.TEXT_MUTED);
        label.setFont(AppTheme.pickFont(12f));
        row.add(label, BorderLayout.WEST);
        row.add(bar, BorderLayout.CENTER);
        row.add(value, BorderLayout.EAST);
        return row;
    }

    private static JProgressBar bar() {
        JProgressBar bar = new JProgressBar(0, 100);
        bar.setStringPainted(false);
        bar.setPreferredSize(new Dimension(120, 12));
        bar.setBackground(new Color(0xE8EEF5));
        return bar;
    }

    private static JLabel valueLabel(String text) {
        JLabel label = new JLabel(text, SwingConstants.RIGHT);
        label.setFont(AppTheme.pickFont(11.5f));
        label.setForeground(AppTheme.TEXT);
        label.setPreferredSize(new Dimension(110, 18));
        return label;
    }

    private static void setBar(JProgressBar bar, JLabel label, int percent, String text) {
        bar.setValue(Math.max(0, Math.min(100, percent)));
        if (percent >= 85) {
            bar.setForeground(AppTheme.DANGER);
        } else if (percent >= 65) {
            bar.setForeground(AppTheme.WARNING);
        } else {
            bar.setForeground(AppTheme.SUCCESS);
        }
        label.setText(text);
    }

    private static void stylePlain(JLabel label) {
        label.setForeground(AppTheme.TEXT);
        label.setFont(AppTheme.pickFont(13f));
    }

    private static String formatMem(String detail) {
        if (detail == null || detail.isBlank() || "-".equals(detail)) {
            return "-";
        }
        // 1.2G / 3.7G 风格：把 "1234M / 3777M" 尽量简化展示
        return detail.replace(" / ", "/").replace("M", "M");
    }

    private static String chineseUptime(String raw) {
        if (raw == null || raw.isBlank() || "-".equals(raw)) {
            return "-";
        }
        return raw
                .replace("up ", "")
                .replace("已运行 ", "")
                .replace("days", "天")
                .replace("day", "天")
                .replace("hours", "小时")
                .replace("hour", "小时")
                .replace("minutes", "分")
                .replace("minute", "分")
                .replace(",", "");
    }
}
