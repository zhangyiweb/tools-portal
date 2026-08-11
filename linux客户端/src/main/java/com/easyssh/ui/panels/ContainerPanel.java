package com.easyssh.ui.panels;

import com.easyssh.model.ContainerInfo;
import com.easyssh.model.ServerProfile;
import com.easyssh.service.ContainerMigrateService;
import com.easyssh.service.DockerService;
import com.easyssh.ssh.SshClient;
import com.easyssh.ui.MigrateDialog;
import com.easyssh.ui.UiSupport;
import com.easyssh.ui.components.AntdButton;
import com.easyssh.ui.theme.AppTheme;
import com.easyssh.util.AccessUrlHelper;

import javax.swing.AbstractCellEditor;
import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import javax.swing.JTextField;
import javax.swing.ListSelectionModel;
import javax.swing.RowFilter;
import javax.swing.SwingUtilities;
import javax.swing.SwingWorker;
import javax.swing.table.DefaultTableCellRenderer;
import javax.swing.table.DefaultTableModel;
import javax.swing.table.TableCellEditor;
import javax.swing.table.TableCellRenderer;
import javax.swing.table.TableColumn;
import javax.swing.table.TableRowSorter;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.Cursor;
import java.awt.FlowLayout;
import java.awt.Font;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.Supplier;

public class ContainerPanel extends JPanel {
    private static final int COL_URL = 4;
    private static final int COL_ACTIONS = 6;
    private static final int COL_ID = 7;

    private final DefaultTableModel model = new DefaultTableModel(
            new Object[]{"名称", "镜像", "状态", "端口", "访问地址", "创建时间", "操作", "编号"}, 0) {
        @Override
        public boolean isCellEditable(int row, int column) {
            return column == COL_ACTIONS;
        }
    };
    private final JTable table = new JTable(model);
    private final TableRowSorter<DefaultTableModel> sorter = new TableRowSorter<>(model);
    private final JTextField filterField = new JTextField(18);
    private final JLabel accessHint = AppTheme.muted("点击列表中的访问地址即可打开网页");
    private final List<ContainerInfo> containers = new ArrayList<>();
    private DockerService docker;
    private SshClient sourceClient;
    private ServerProfile sourceProfile;
    private Supplier<List<ServerProfile>> profilesSupplier = List::of;
    private OutputConsumer outputConsumer;

    public interface OutputConsumer {
        void show(String title, String content);
    }

    public ContainerPanel() {
        setLayout(new BorderLayout(12, 12));
        setBackground(AppTheme.BG);
        setBorder(BorderFactory.createEmptyBorder(14, 14, 14, 14));

        JLabel title = AppTheme.title("容器列表", 17f);
        JLabel tip = AppTheme.muted("运行中的服务会显示访问地址，点击蓝色地址即可在浏览器打开；操作在每行最后一列");

        JPanel titleBox = new JPanel(new BorderLayout(0, 2));
        titleBox.setOpaque(false);
        titleBox.add(title, BorderLayout.NORTH);
        titleBox.add(tip, BorderLayout.SOUTH);

        JPanel filterBar = new JPanel(new FlowLayout(FlowLayout.RIGHT, 8, 0));
        filterBar.setOpaque(false);
        filterBar.add(new JLabel("搜索"));
        filterBar.add(filterField);
        filterField.addActionListener(e -> applyFilter());
        filterBar.add(UiSupport.button("筛选", this::applyFilter));
        filterBar.add(UiSupport.button("刷新列表", this::refresh));

        JPanel top = new JPanel(new BorderLayout(8, 8));
        top.setOpaque(false);
        top.add(titleBox, BorderLayout.WEST);
        top.add(filterBar, BorderLayout.EAST);

        table.setRowSorter(sorter);
        table.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        table.setRowHeight(40);
        AppTheme.styleTable(table);
        hideIdColumn();
        table.getColumnModel().getColumn(COL_URL).setPreferredWidth(200);
        table.getColumnModel().getColumn(COL_URL).setCellRenderer(new UrlCellRenderer());

        ActionColumn actionColumn = new ActionColumn();
        TableColumn actionsCol = table.getColumnModel().getColumn(COL_ACTIONS);
        actionsCol.setPreferredWidth(360);
        actionsCol.setMinWidth(320);
        actionsCol.setCellRenderer(actionColumn);
        actionsCol.setCellEditor(actionColumn);

        table.getSelectionModel().addListSelectionListener(e -> {
            if (!e.getValueIsAdjusting()) {
                updateAccessHint();
            }
        });
        table.addMouseListener(new MouseAdapter() {
            @Override
            public void mousePressed(MouseEvent e) {
                int viewRow = table.rowAtPoint(e.getPoint());
                int viewCol = table.columnAtPoint(e.getPoint());
                if (viewRow < 0 || viewCol < 0) {
                    return;
                }
                int modelCol = table.convertColumnIndexToModel(viewCol);
                if (modelCol == COL_ACTIONS) {
                    table.setRowSelectionInterval(viewRow, viewRow);
                    table.editCellAt(viewRow, viewCol);
                    Component editor = table.getEditorComponent();
                    if (editor != null) {
                        editor.dispatchEvent(SwingUtilities.convertMouseEvent(table, e, editor));
                    }
                }
            }

            @Override
            public void mouseClicked(MouseEvent e) {
                int viewRow = table.rowAtPoint(e.getPoint());
                int viewCol = table.columnAtPoint(e.getPoint());
                if (viewRow < 0 || viewCol < 0) {
                    return;
                }
                int modelCol = table.convertColumnIndexToModel(viewCol);
                if (modelCol == COL_URL) {
                    table.setRowSelectionInterval(viewRow, viewRow);
                    Object value = table.getValueAt(viewRow, viewCol);
                    if (value != null && String.valueOf(value).startsWith("http")) {
                        openUrl(String.valueOf(value));
                    }
                }
            }
        });

        JScrollPane scroll = new JScrollPane(table);
        scroll.setBorder(BorderFactory.createLineBorder(AppTheme.BORDER, 1, true));

        add(top, BorderLayout.NORTH);
        add(scroll, BorderLayout.CENTER);
        add(accessHint, BorderLayout.SOUTH);
        updateAccessHint();
    }

    private void hideIdColumn() {
        TableColumn idCol = table.getColumnModel().getColumn(COL_ID);
        idCol.setMinWidth(0);
        idCol.setMaxWidth(0);
        idCol.setPreferredWidth(0);
    }

    public void setOutputConsumer(OutputConsumer outputConsumer) {
        this.outputConsumer = outputConsumer;
    }

    public void setProfilesSupplier(Supplier<List<ServerProfile>> profilesSupplier) {
        this.profilesSupplier = profilesSupplier == null ? List::of : profilesSupplier;
    }

    public void bind(DockerService docker, SshClient sourceClient, ServerProfile sourceProfile) {
        this.docker = docker;
        this.sourceClient = sourceClient;
        this.sourceProfile = sourceProfile;
        refresh();
    }

    public void clear() {
        this.docker = null;
        this.sourceClient = null;
        this.sourceProfile = null;
        containers.clear();
        model.setRowCount(0);
        updateAccessHint();
    }

    private void refresh() {
        if (docker == null) {
            return;
        }
        if (table.isEditing()) {
            table.getCellEditor().stopCellEditing();
        }
        UiSupport.runAsync(this, "刷新容器列表", docker::listContainers, list -> {
            containers.clear();
            containers.addAll(list);
            model.setRowCount(0);
            for (ContainerInfo c : list) {
                String url = AccessUrlHelper.displayUrls(sourceProfile, c);
                String name = c.getName();
                if (AccessUrlHelper.looksLikeNginx(c)) {
                    name = "[Nginx] " + name;
                }
                model.addRow(new Object[]{
                        name,
                        c.getImage(),
                        chineseStatus(c.getStatus()),
                        c.getPorts(),
                        url,
                        c.getCreated(),
                        "",
                        c.getId()
                });
            }
            updateAccessHint();
        });
    }

    private void updateAccessHint() {
        ContainerInfo selected = selectedContainerSilent();
        if (selected == null || sourceProfile == null) {
            accessHint.setText("点击列表中的访问地址即可打开网页；每行最后一列可启停、重启、删除");
            return;
        }
        String url = AccessUrlHelper.primaryUrl(sourceProfile, selected);
        if (url.isBlank()) {
            accessHint.setText("当前容器没有可访问的对外端口");
            return;
        }
        String prefix = AccessUrlHelper.looksLikeNginx(selected) ? "Nginx 访问地址：" : "访问地址：";
        accessHint.setText(prefix + AccessUrlHelper.displayUrls(sourceProfile, selected) + "（点击列表中的蓝色地址打开）");
    }

    private void openUrl(String url) {
        try {
            AccessUrlHelper.openInBrowser(url);
            if (outputConsumer != null) {
                outputConsumer.show("打开网页", "已在浏览器打开：\n" + url.split("\\|")[0].trim());
            }
        } catch (Exception ex) {
            UiSupport.showError(this, "无法打开网页", ex.getMessage());
        }
    }

    private void act(ContainerInfo selected, String action) {
        if (selected == null || docker == null) {
            return;
        }
        String actionName = switch (action) {
            case "start" -> "启动容器";
            case "stop" -> "停止容器";
            case "restart" -> "重启容器";
            default -> "容器操作";
        };
        UiSupport.runAsync(this, actionName, () -> switch (action) {
            case "start" -> docker.start(selected.getId());
            case "stop" -> docker.stop(selected.getId());
            case "restart" -> docker.restart(selected.getId());
            default -> throw new IllegalArgumentException(action);
        }, msg -> {
            if (outputConsumer != null) {
                outputConsumer.show(actionName + "结果", msg);
            }
            refresh();
        });
    }

    private void showLogs(ContainerInfo selected) {
        if (selected == null || docker == null) {
            return;
        }
        UiSupport.runAsync(this, "读取日志", () -> docker.logs(selected.getId(), 200), logs -> {
            if (outputConsumer != null) {
                outputConsumer.show("容器日志 - " + selected.getName(), logs);
            } else {
                UiSupport.showTextDialog(this, "容器日志 - " + selected.getName(), logs);
            }
        });
    }

    private void migrateSelected(ContainerInfo selected) {
        if (selected == null) {
            return;
        }
        if (sourceClient == null || sourceProfile == null) {
            UiSupport.showInfo(this, "提示", "请先连接源服务器");
            return;
        }
        List<ServerProfile> profiles = profilesSupplier.get();
        JFrame frame = (JFrame) SwingUtilities.getWindowAncestor(this);
        MigrateDialog dialog = new MigrateDialog(frame, selected.getName(), sourceProfile, profiles);
        dialog.setVisible(true);
        MigrateDialog.Result result = dialog.getResult();
        if (result == null) {
            return;
        }

        StringBuilder live = new StringBuilder();
        live.append("准备迁移「").append(selected.getName()).append("」...\n");
        if (outputConsumer != null) {
            outputConsumer.show("容器迁移进度", live.toString());
        }

        setCursor(Cursor.getPredefinedCursor(Cursor.WAIT_CURSOR));
        new SwingWorker<String, String>() {
            @Override
            protected String doInBackground() throws Exception {
                ContainerMigrateService service = new ContainerMigrateService(sourceClient, this::publish);
                return service.migrate(selected.getId(), result.target(), result.options());
            }

            @Override
            protected void process(List<String> chunks) {
                for (String chunk : chunks) {
                    live.append(chunk).append('\n');
                }
                if (outputConsumer != null) {
                    outputConsumer.show("容器迁移进度", live.toString());
                }
            }

            @Override
            protected void done() {
                setCursor(Cursor.getDefaultCursor());
                try {
                    String report = get();
                    if (outputConsumer != null) {
                        outputConsumer.show("容器迁移完成", live + "\n" + report);
                    }
                    UiSupport.showInfo(ContainerPanel.this, "迁移完成",
                            "容器「" + selected.getName() + "」已迁移到「" + result.target().getName() + "」");
                    refresh();
                } catch (Exception ex) {
                    Throwable cause = ex.getCause() == null ? ex : ex.getCause();
                    if (outputConsumer != null) {
                        outputConsumer.show("容器迁移失败", live + "\n失败原因：\n" + cause.getMessage());
                    }
                    UiSupport.showError(ContainerPanel.this, "迁移失败", cause.getMessage());
                }
            }
        }.execute();
    }

    private void removeSelected(ContainerInfo selected) {
        if (selected == null || docker == null) {
            return;
        }
        if (!UiSupport.confirm(this, "删除确认", "确认删除容器「" + selected.getName() + "」？")) {
            return;
        }
        UiSupport.runAsync(this, "删除容器", () -> docker.remove(selected.getId()), msg -> {
            if (outputConsumer != null) {
                outputConsumer.show("删除结果", msg);
            }
            refresh();
        });
    }

    private ContainerInfo containerAtViewRow(int viewRow) {
        if (viewRow < 0) {
            return null;
        }
        int modelRow = table.convertRowIndexToModel(viewRow);
        String id = String.valueOf(model.getValueAt(modelRow, COL_ID));
        return containers.stream().filter(c -> id.equals(c.getId())).findFirst().orElse(null);
    }

    private ContainerInfo selectedContainerSilent() {
        return containerAtViewRow(table.getSelectedRow());
    }

    private void applyFilter() {
        String text = filterField.getText().trim();
        if (text.isEmpty()) {
            sorter.setRowFilter(null);
        } else {
            sorter.setRowFilter(RowFilter.regexFilter("(?i)" + java.util.regex.Pattern.quote(text)));
        }
    }

    private static String chineseStatus(String status) {
        if (status == null) {
            return "-";
        }
        String s = status;
        s = s.replace("Up", "运行中");
        s = s.replace("Exited", "已退出");
        s = s.replace("Created", "已创建");
        s = s.replace("Restarting", "重启中");
        s = s.replace("Paused", "已暂停");
        s = s.replace("ago", "前");
        s = s.replace("hours", "小时");
        s = s.replace("hour", "小时");
        s = s.replace("minutes", "分钟");
        s = s.replace("minute", "分钟");
        s = s.replace("seconds", "秒");
        s = s.replace("second", "秒");
        s = s.replace("days", "天");
        s = s.replace("day", "天");
        s = s.replace("About a", "约 1");
        s = s.replace("Less than a", "不到 1");
        return s;
    }

    private final class ActionColumn extends AbstractCellEditor implements TableCellRenderer, TableCellEditor {
        private final ActionBar renderBar = new ActionBar();
        private final ActionBar editBar = new ActionBar();
        private int editingViewRow = -1;

        private final class ActionBar {
            private final JPanel panel = new JPanel(new FlowLayout(FlowLayout.LEFT, 4, 2));
            private final JButton startBtn = mini("启动", AntdButton.Type.SUCCESS, row -> act(row, "start"));
            private final JButton stopBtn = mini("停止", AntdButton.Type.DEFAULT, row -> act(row, "stop"));
            private final JButton restartBtn = mini("重启", AntdButton.Type.PRIMARY, row -> act(row, "restart"));
            private final JButton logsBtn = mini("日志", AntdButton.Type.DEFAULT, ContainerPanel.this::showLogs);
            private final JButton migrateBtn = mini("迁移", AntdButton.Type.PRIMARY, ContainerPanel.this::migrateSelected);
            private final JButton deleteBtn = mini("删除", AntdButton.Type.DANGER, ContainerPanel.this::removeSelected);

            private ActionBar() {
                panel.setOpaque(true);
                panel.add(startBtn);
                panel.add(stopBtn);
                panel.add(restartBtn);
                panel.add(logsBtn);
                panel.add(migrateBtn);
                panel.add(deleteBtn);
            }

            private void apply(ContainerInfo info, JTable table, boolean isSelected) {
                panel.setBackground(isSelected ? table.getSelectionBackground() : table.getBackground());
                boolean running = info != null && info.isRunning();
                startBtn.setVisible(!running);
                stopBtn.setVisible(running);
                restartBtn.setVisible(running);
                panel.revalidate();
            }
        }

        private JButton mini(String text, AntdButton.Type type, Consumer<ContainerInfo> action) {
            JButton button = AntdButton.of(text, type, () -> {
                int row = editingViewRow >= 0 ? editingViewRow : table.getSelectedRow();
                ContainerInfo info = containerAtViewRow(row);
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
            renderBar.apply(containerAtViewRow(row), table, isSelected);
            return renderBar.panel;
        }

        @Override
        public Component getTableCellEditorComponent(JTable table, Object value, boolean isSelected,
                                                     int row, int column) {
            editingViewRow = row;
            table.setRowSelectionInterval(row, row);
            editBar.apply(containerAtViewRow(row), table, true);
            return editBar.panel;
        }

        @Override
        public Object getCellEditorValue() {
            return "";
        }
    }

    private static class UrlCellRenderer extends DefaultTableCellRenderer {
        @Override
        public Component getTableCellRendererComponent(JTable table, Object value, boolean isSelected,
                                                       boolean hasFocus, int row, int column) {
            Component c = super.getTableCellRendererComponent(table, value, isSelected, hasFocus, row, column);
            String text = value == null ? "" : String.valueOf(value);
            if (text.startsWith("http")) {
                setForeground(AppTheme.PRIMARY);
                setFont(getFont().deriveFont(Font.BOLD));
                setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
            } else {
                setForeground(AppTheme.TEXT_MUTED);
                setFont(getFont().deriveFont(Font.PLAIN));
                setCursor(Cursor.getDefaultCursor());
            }
            return c;
        }
    }
}
