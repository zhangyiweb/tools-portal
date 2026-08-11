package com.easyssh.ui.charts;

import com.easyssh.ui.theme.AppTheme;

import javax.swing.JPanel;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.Arc2D;

/** 环形占比图。 */
public class RingGaugePanel extends JPanel {
    private final String label;
    private final Color color;
    private int percent;
    private String detail = "";

    public RingGaugePanel(String label, Color color) {
        this.label = label;
        this.color = color;
        setOpaque(false);
        setPreferredSize(new Dimension(96, 110));
    }

    public void setPercent(int percent, String detail) {
        this.percent = Math.max(0, Math.min(100, percent));
        this.detail = detail == null ? "" : detail;
        repaint();
    }

    public void reset() {
        setPercent(0, "-");
    }

    @Override
    protected void paintComponent(Graphics g) {
        super.paintComponent(g);
        Graphics2D g2 = (Graphics2D) g.create();
        g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);

        int size = Math.min(getWidth(), getHeight() - 28);
        int x = (getWidth() - size) / 2;
        int y = 4;
        float thickness = Math.max(8f, size * 0.12f);

        g2.setStroke(new BasicStroke(thickness, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
        g2.setColor(new Color(0xE6EEF7));
        g2.draw(new Arc2D.Double(x + thickness / 2, y + thickness / 2,
                size - thickness, size - thickness, 90, -360, Arc2D.OPEN));

        g2.setColor(color);
        double angle = -360.0 * percent / 100.0;
        g2.draw(new Arc2D.Double(x + thickness / 2, y + thickness / 2,
                size - thickness, size - thickness, 90, angle, Arc2D.OPEN));

        g2.setFont(AppTheme.pickFont(14f).deriveFont(Font.BOLD));
        g2.setColor(AppTheme.TEXT);
        String text = percent + "%";
        int tw = g2.getFontMetrics().stringWidth(text);
        g2.drawString(text, getWidth() / 2 - tw / 2, y + size / 2 + 5);

        g2.setFont(AppTheme.pickFont(11.5f).deriveFont(Font.BOLD));
        g2.setColor(AppTheme.TEXT);
        int lw = g2.getFontMetrics().stringWidth(label);
        g2.drawString(label, getWidth() / 2 - lw / 2, getHeight() - 14);

        if (!detail.isBlank()) {
            g2.setFont(AppTheme.pickFont(10f));
            g2.setColor(AppTheme.TEXT_MUTED);
        }

        g2.dispose();
    }
}
