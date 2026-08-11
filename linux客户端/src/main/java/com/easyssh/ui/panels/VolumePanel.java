package com.easyssh.ui.panels;

import com.easyssh.model.VolumeInfo;
import com.easyssh.service.DockerService;
import com.easyssh.ui.UiSupport;
import com.easyssh.ui.components.AntdButton;
import com.easyssh.ui.theme.AppTheme;

import javax.swing.AbstractCellEditor;
import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import javax.swing.JTextField;
import javax.swing.ListSelectionModel;
import javax.swing.table.DefaultTableModel;
import javax.swing.table.TableCellEditor;
import javax.swing.table.TableCellRenderer;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.FlowLayout;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

public class VolumePanel extends JPanel {
    private static final int COL_ACTIONS = 3;

    private final DefaultTableModel model = new DefaultTableModel(
            new Object[]{"名称", "驱动", "挂载点", "操作"}, 0) {
        @Override
        public boolean isCellEditable(int row, int column) {
            return column == COL_ACTIONS;
        }
    };
    private final JTable table = new JTable(model);
    private final List<VolumeInfo> volumes = new ArrayList<>();

    private DockerService docker;
    private OutputConsumer outputConsumer;
    private Consumer<String> openPathHandler;

    public interface OutputConsumer {
        void show(String title, String content);
    }

    public VolumePanel() {
        setLayout(new BorderLayout(12, 12));
        setBackground(AppTheme.BG);
        setBorder(BorderFactory.createEmptyBorder(14, 14, 14, 14));

        JLabel title = AppTheme.title("数据卷管理", 17f);
        JLabel tip = AppTheme.muted("每行可打开挂载路径到文件管理，再拖拽上传网站文件");

        JPanel titleBox = new JPanel(new BorderLayout(0, 2));
        titleBox.setOpaque(false);
        titleBox.add(title, BorderLayout.NORTH);
        titleBox.add(tip, BorderLayout.SOUTH);

        JPanel createBar = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));
        createBar.setOpaque(false);
        createBar.add(UiSupport.primaryButton("创建数据卷", this::createVolume));
        createBar.add(UiSupport.button("刷新列表", this::refresh));

        JPanel north = new JPanel(new BorderLayout(8, 10));
        north.setOpaque(false);
        north.add(titleBox, BorderLayout.NORTH);
        north.add(createBar, BorderLayout.SOUTH);

        table.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        AppTheme.styleTable(table);
        table.setRowHeight(36);
        ActionColumn actions = new ActionColumn();
        table.getColumnModel().getColumn(COL_ACTIONS).setCellRenderer(actions);
        table.getColumnModel().getColumn(COL_ACTIONS).setCellEditor(actions);
        table.getColumnModel().getColumn(COL_ACTIONS).setMinWidth(180);
        table.getColumnModel().getColumn(COL_ACTIONS).setPreferredWidth(200);
        table.addMouseListener(new java.awt.event.MouseAdapter() {
            @Override
            public void mouseClicked(java.awt.event.MouseEvent e) {
                if (e.getClickCount() == 2) {
                    int col = table.columnAtPoint(e.getPoint());
                    if (col != COL_ACTIONS) {
                        openSelectedPath();
                    }
                }
            }
        });

        JScrollPane tableScroll = new JScrollPane(table);
        tableScroll.setBorder(AppTheme.cardBorder("数据卷列表"));

        add(north, BorderLayout.NORTH);
        add(tableScroll, BorderLayout.CENTER);
    }

    public void setOutputConsumer(OutputConsumer outputConsumer) {
        this.outputConsumer = outputConsumer;
    }

    public void setOpenPathHandler(Consumer<String> openPathHandler) {
        this.openPathHandler = openPathHandler;
    }

    public void bind(DockerService docker) {
        this.docker = docker;
        refresh();
    }

    public void clear() {
        this.docker = null;
        volumes.clear();
        model.setRowCount(0);
    }

    public List<String> currentVolumeNames() {
        List<String> names = new ArrayList<>();
        for (VolumeInfo v : volumes) {
            names.add(v.getName());
        }
        return names;
    }

    private void refresh() {
        if (docker == null) {
            return;
        }
        UiSupport.runAsync(this, "刷新数据卷", docker::listVolumes, list -> {
            volumes.clear();
            volumes.addAll(list);
            model.setRowCount(0);
            for (VolumeInfo v : list) {
                model.addRow(new Object[]{v.getName(), v.getDriver(), v.getMountpoint(), ""});
            }
        });
    }

    private void createVolume() {
        if (docker == null) {
            UiSupport.showInfo(this, "提示", "请先连接服务器");
            return;
        }
        JTextField nameField = new JTextField("web-data", 20);
        JPanel form = new JPanel(new BorderLayout(8, 8));
        form.add(new JLabel("数据卷名称："), BorderLayout.WEST);
        form.add(nameField, BorderLayout.CENTER);
        int result = JOptionPane.showConfirmDialog(
                this,
                form,
                "创建数据卷",
                JOptionPane.OK_CANCEL_OPTION,
                JOptionPane.PLAIN_MESSAGE
        );
        if (result != JOptionPane.OK_OPTION) {
            return;
        }
        String name = nameField.getText().trim();
        if (name.isEmpty()) {
            UiSupport.showInfo(this, "提示", "请填写数据卷名称");
            return;
        }
        if (!name.matches("[a-zA-Z0-9][a-zA-Z0-9_.-]{0,62}")) {
            UiSupport.showInfo(this, "提示", "名称只能包含字母、数字、下划线、点和短横线，并以字母或数字开头");
            return;
        }
        UiSupport.runAsync(this, "创建数据卷", () -> docker.createVolume(name), msg -> {
            if (outputConsumer != null) {
                outputConsumer.show("创建数据卷", msg);
            }
            refresh();
        });
    }

    private void openPath(VolumeInfo volume) {
        if (volume == null) {
            return;
        }
        String mount = volume.getMountpoint();
        if (mount == null || mount.isBlank()) {
            UiSupport.showInfo(this, "提示", "该数据卷没有可用的挂载路径");
            return;
        }
        if (openPathHandler == null) {
            UiSupport.showInfo(this, "提示", "无法打开文件管理");
            return;
        }
        openPathHandler.accept(mount.trim());
    }

    private void openSelectedPath() {
        VolumeInfo selected = selectedVolume();
        if (selected != null) {
            openPath(selected);
        }
    }

    private void removeVolume(VolumeInfo volume) {
        if (volume == null || docker == null) {
            return;
        }
        if (!UiSupport.confirm(this, "删除确认",
                "确认删除数据卷「" + volume.getName() + "」？\n卷内文件将一并删除。")) {
            return;
        }
        UiSupport.runAsync(this, "删除数据卷", () -> docker.removeVolume(volume.getName()), msg -> {
            if (outputConsumer != null) {
                outputConsumer.show("删除数据卷", msg);
            }
            refresh();
        });
    }

    private VolumeInfo selectedVolume() {
        VolumeInfo selected = volumeAtViewRow(table.getSelectedRow());
        if (selected == null) {
            UiSupport.showInfo(this, "提示", "请先在列表中选中一个数据卷");
        }
        return selected;
    }

    private VolumeInfo volumeAtViewRow(int viewRow) {
        if (viewRow < 0) {
            return null;
        }
        int modelRow = table.convertRowIndexToModel(viewRow);
        if (modelRow < 0 || modelRow >= volumes.size()) {
            return null;
        }
        return volumes.get(modelRow);
    }

    private final class ActionColumn extends AbstractCellEditor implements TableCellRenderer, TableCellEditor {
        private final ActionBar renderBar = new ActionBar();
        private final ActionBar editBar = new ActionBar();
        private int editingViewRow = -1;

        private final class ActionBar {
            private final JPanel panel = new JPanel(new FlowLayout(FlowLayout.LEFT, 4, 2));
            private final JButton openBtn = mini("打开路径", AntdButton.Type.PRIMARY, VolumePanel.this::openPath);
            private final JButton deleteBtn = mini("删除", AntdButton.Type.DANGER, VolumePanel.this::removeVolume);

            private ActionBar() {
                panel.setOpaque(true);
                panel.add(openBtn);
                panel.add(deleteBtn);
            }

            private void apply(JTable table, boolean isSelected) {
                panel.setBackground(isSelected ? table.getSelectionBackground() : table.getBackground());
            }
        }

        private JButton mini(String text, AntdButton.Type type, Consumer<VolumeInfo> action) {
            JButton button = AntdButton.of(text, type, () -> {
                int row = editingViewRow >= 0 ? editingViewRow : table.getSelectedRow();
                VolumeInfo info = volumeAtViewRow(row);
                stopCellEditing();
                if (info != null) {
                    action.accept(info);
                }
            });
            button.setFont(AppTheme.pickFont(12f));
            button.setBorder(BorderFactory.createCompoundBorder(
                    BorderFactory.createLineBorder(buttonBorder(type), 1, true),
                    BorderFactory.createEmptyBorder(2, 8, 2, 8)
            ));
            return button;
        }

        private Color buttonBorder(AntdButton.Type type) {
            return switch (type) {
                case PRIMARY -> AppTheme.PRIMARY;
                case SUCCESS -> AppTheme.SUCCESS;
                case DANGER -> new Color(0xFFCCC7);
                default -> AppTheme.BORDER;
            };
        }

        @Override
        public Component getTableCellRendererComponent(JTable table, Object value, boolean isSelected,
                                                       boolean hasFocus, int row, int column) {
            renderBar.apply(table, isSelected);
            return renderBar.panel;
        }

        @Override
        public Component getTableCellEditorComponent(JTable table, Object value, boolean isSelected,
                                                     int row, int column) {
            editingViewRow = row;
            table.setRowSelectionInterval(row, row);
            editBar.apply(table, true);
            return editBar.panel;
        }

        @Override
        public Object getCellEditorValue() {
            return "";
        }
    }
}
