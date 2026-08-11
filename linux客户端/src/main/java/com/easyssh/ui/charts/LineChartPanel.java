package com.easyssh.ui.charts;

import com.easyssh.ui.theme.AppTheme;

import javax.swing.JPanel;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.FontMetrics;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.Path2D;
import java.util.ArrayDeque;
import java.util.Deque;

/** 简易折线/面积图，用于 CPU、内存等趋势。 */
public class LineChartPanel extends JPanel {
    private final Deque<Double> values = new ArrayDeque<>();
    private final int capacity;
    private final Color lineColor;
    private final String title;
    private String unitSuffix = "%";
    private double latest;

    public LineChartPanel(String title, Color lineColor, int capacity) {
        this.title = title;
        this.lineColor = lineColor;
        this.capacity = capacity;
        setOpaque(false);
        setPreferredSize(new Dimension(280, 110));
    }

    public void setUnitSuffix(String unitSuffix) {
        this.unitSuffix = unitSuffix;
    }

    public void addValue(double value) {
        latest = Math.max(0, Math.min(100, value));
        values.addLast(latest);
        while (values.size() > capacity) {
            values.removeFirst();
        }
        repaint();
    }

    public void clearValues() {
        values.clear();
        latest = 0;
        repaint();
    }

    @Override
    protected void paintComponent(Graphics g) {
        super.paintComponent(g);
        Graphics2D g2 = (Graphics2D) g.create();
        g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);

        int w = getWidth();
        int h = getHeight();
        int padL = 8;
        int padR = 8;
        int padT = 22;
        int padB = 10;

        g2.setColor(new Color(0xF8FBFE));
        g2.fillRoundRect(0, 0, w - 1, h - 1, 12, 12);
        g2.setColor(AppTheme.BORDER);
        g2.drawRoundRect(0, 0, w - 1, h - 1, 12, 12);

        g2.setFont(AppTheme.pickFont(12f).deriveFont(java.awt.Font.BOLD));
        g2.setColor(AppTheme.TEXT);
        g2.drawString(title, padL + 2, 16);
        g2.setFont(AppTheme.pickFont(11f));
        g2.setColor(AppTheme.TEXT_MUTED);
        String latestText = String.format("%.0f%s", latest, unitSuffix);
        FontMetrics fm = g2.getFontMetrics();
        g2.drawString(latestText, w - padR - fm.stringWidth(latestText) - 2, 16);

        int chartW = Math.max(1, w - padL - padR);
        int chartH = Math.max(1, h - padT - padB);
        int baseY = padT + chartH;

        g2.setColor(new Color(0xE7EEF6));
        for (int i = 1; i <= 3; i++) {
            int y = padT + chartH * i / 4;
            g2.drawLine(padL, y, padL + chartW, y);
        }

        if (values.size() >= 2) {
            Double[] arr = values.toArray(new Double[0]);
            Path2D.Double line = new Path2D.Double();
            Path2D.Double area = new Path2D.Double();
            for (int i = 0; i < arr.length; i++) {
                double x = padL + (chartW * i / (double) Math.max(1, capacity - 1));
                double y = padT + chartH * (1.0 - arr[i] / 100.0);
                if (i == 0) {
                    line.moveTo(x, y);
                    area.moveTo(x, baseY);
                    area.lineTo(x, y);
                } else {
                    line.lineTo(x, y);
                    area.lineTo(x, y);
                }
            }
            double lastX = padL + (chartW * (arr.length - 1) / (double) Math.max(1, capacity - 1));
            area.lineTo(lastX, baseY);
            area.closePath();

            Color fill = new Color(lineColor.getRed(), lineColor.getGreen(), lineColor.getBlue(), 55);
            g2.setColor(fill);
            g2.fill(area);
            g2.setStroke(new BasicStroke(2.2f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
            g2.setColor(lineColor);
            g2.draw(line);
        } else {
            g2.setColor(AppTheme.TEXT_MUTED);
            g2.drawString("等待数据...", padL + 8, padT + chartH / 2);
        }

        g2.dispose();
    }
}
