package com.easyssh.ui.panels;

import com.easyssh.model.FileEntry;
import com.easyssh.service.ServerOpsService;
import com.easyssh.ui.FileEditDialog;
import com.easyssh.ui.UiSupport;
import com.easyssh.ui.theme.AppTheme;

import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JFileChooser;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JSplitPane;
import javax.swing.JTable;
import javax.swing.JTextField;
import javax.swing.JTree;
import javax.swing.ListSelectionModel;
import javax.swing.SwingUtilities;
import javax.swing.event.TreeExpansionEvent;
import javax.swing.event.TreeWillExpandListener;
import javax.swing.table.DefaultTableModel;
import javax.swing.tree.DefaultMutableTreeNode;
import javax.swing.tree.DefaultTreeModel;
import javax.swing.tree.TreePath;
import java.awt.BorderLayout;
import java.awt.FlowLayout;
import java.awt.Window;
import java.awt.datatransfer.DataFlavor;
import java.awt.dnd.DnDConstants;
import java.awt.dnd.DropTarget;
import java.awt.dnd.DropTargetAdapter;
import java.awt.dnd.DropTargetDropEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.io.File;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;
import java.util.function.BiConsumer;

public class FileBrowserPanel extends JPanel {
    private final DefaultTableModel model = new DefaultTableModel(
            new Object[]{"名称", "大小", "类型", "修改时间", "权限", "路径"}, 0) {
        @Override
        public boolean isCellEditable(int row, int column) {
            return false;
        }
    };
    private final JTable table = new JTable(model);
    private final JTextField pathField = new JTextField("/");
    private final List<FileEntry> files = new ArrayList<>();

    private final DefaultMutableTreeNode rootNode = new DefaultMutableTreeNode(new DirNode("根目录", "/"));
    private final DefaultTreeModel treeModel = new DefaultTreeModel(rootNode);
    private final JTree tree = new JTree(treeModel);

    private final JPanel dockerBanner = new JPanel(new BorderLayout(12, 0));
    private final JButton installDockerButton = UiSupport.primaryButton("安装 Docker", this::installDocker);

    private ServerOpsService ops;
    private String currentPath = "/";
    private boolean syncingTree;
    private BiConsumer<String, String> outputConsumer;

    public FileBrowserPanel() {
        setLayout(new BorderLayout(8, 8));
        setBackground(AppTheme.BG);
        setBorder(BorderFactory.createEmptyBorder(12, 12, 12, 12));

        JLabel title = AppTheme.title("远程文件", 16f);
        JLabel tip = AppTheme.muted("左侧目录树，右侧文件列表；双击文件可编辑，也可拖拽上传");

        JPanel titleBox = new JPanel(new BorderLayout(0, 2));
        titleBox.setOpaque(false);
        titleBox.add(title, BorderLayout.NORTH);
        titleBox.add(tip, BorderLayout.SOUTH);

        dockerBanner.setOpaque(true);
        dockerBanner.setBackground(new java.awt.Color(0xFFF7E6));
        dockerBanner.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(new java.awt.Color(0xFFD591), 1, true),
                BorderFactory.createEmptyBorder(10, 12, 10, 12)
        ));
        dockerBanner.add(AppTheme.muted("未检测到 Docker，容器 / 数据卷 / 一键部署需要先安装"), BorderLayout.CENTER);
        dockerBanner.add(installDockerButton, BorderLayout.EAST);
        dockerBanner.setVisible(false);

        JPanel pathBar = new JPanel(new BorderLayout(8, 0));
        pathBar.setOpaque(false);
        pathBar.add(new JLabel("当前路径"), BorderLayout.WEST);
        pathBar.add(pathField, BorderLayout.CENTER);
        JPanel pathActions = new JPanel(new FlowLayout(FlowLayout.RIGHT, 6, 0));
        pathActions.setOpaque(false);
        pathActions.add(UiSupport.button("打开", () -> openPath(pathField.getText().trim())));
        pathActions.add(UiSupport.button("上级目录", this::goUp));
        pathActions.add(UiSupport.primaryButton("刷新", this::refreshCurrent));
        pathBar.add(pathActions, BorderLayout.EAST);

        JPanel north = new JPanel(new BorderLayout(6, 8));
        north.setOpaque(false);
        north.add(titleBox, BorderLayout.NORTH);
        north.add(dockerBanner, BorderLayout.CENTER);
        north.add(pathBar, BorderLayout.SOUTH);

        rootNode.add(new DefaultMutableTreeNode("加载中..."));
        tree.setRootVisible(true);
        tree.setShowsRootHandles(true);
        tree.setRowHeight(24);
        tree.setBackground(AppTheme.SURFACE);
        tree.setForeground(AppTheme.TEXT);
        tree.setCellRenderer(new DirTreeCellRenderer());
        tree.addTreeWillExpandListener(new TreeWillExpandListener() {
            @Override
            public void treeWillExpand(TreeExpansionEvent event) {
                DefaultMutableTreeNode node = (DefaultMutableTreeNode) event.getPath().getLastPathComponent();
                loadChildren(node, false);
            }

            @Override
            public void treeWillCollapse(TreeExpansionEvent event) {
            }
        });
        tree.addTreeSelectionListener(e -> {
            if (syncingTree) {
                return;
            }
            TreePath path = tree.getSelectionPath();
            if (path == null) {
                return;
            }
            DefaultMutableTreeNode node = (DefaultMutableTreeNode) path.getLastPathComponent();
            Object user = node.getUserObject();
            if (user instanceof DirNode dir) {
                openPath(dir.path(), false);
            }
        });

        table.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        AppTheme.styleTable(table);
        table.getColumnModel().getColumn(5).setMinWidth(0);
        table.getColumnModel().getColumn(5).setMaxWidth(0);
        table.addMouseListener(new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent e) {
                if (e.getClickCount() == 2) {
                    enterSelected();
                }
            }
        });

        JScrollPane treeScroll = new JScrollPane(tree);
        treeScroll.setBorder(AppTheme.cardBorder("目录树"));
        JScrollPane tableScroll = new JScrollPane(table);
        tableScroll.setBorder(AppTheme.cardBorder("文件列表（支持拖拽上传）"));

        JSplitPane split = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT, treeScroll, tableScroll);
        split.setResizeWeight(0.28);
        split.setDividerLocation(230);
        split.setBorder(BorderFactory.createEmptyBorder());

        installDropUpload(table);
        installDropUpload(tableScroll);
        installDropUpload(this);

        JPanel actions = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 4));
        actions.setOpaque(false);
        actions.add(UiSupport.primaryButton("编辑", this::editSelected));
        actions.add(UiSupport.button("下载到本地", this::downloadSelected));
        actions.add(UiSupport.successButton("上传文件", this::uploadFile));
        actions.add(UiSupport.dangerButton("删除", this::deleteSelected));

        add(north, BorderLayout.NORTH);
        add(split, BorderLayout.CENTER);
        add(actions, BorderLayout.SOUTH);
    }

    public void setOutputConsumer(BiConsumer<String, String> outputConsumer) {
        this.outputConsumer = outputConsumer;
    }

    /**
     * 从其他页跳转打开指定远程目录。
     */
    public void navigateTo(String remotePath) {
        if (ops == null) {
            UiSupport.showInfo(this, "提示", "请先连接服务器");
            return;
        }
        String target = normalize(remotePath);
        openPath(target, true);
    }

    public void bind(ServerOpsService ops) {
        this.ops = ops;
        rootNode.removeAllChildren();
        rootNode.add(new DefaultMutableTreeNode("加载中..."));
        treeModel.reload(rootNode);
        loadChildren(rootNode, true);
        openPath("/", false);
        SwingUtilities.invokeLater(() -> {
            TreePath rootPath = new TreePath(rootNode.getPath());
            tree.expandPath(rootPath);
            tree.setSelectionPath(rootPath);
        });
        checkDocker();
    }

    public void clear() {
        this.ops = null;
        files.clear();
        model.setRowCount(0);
        currentPath = "/";
        pathField.setText("/");
        dockerBanner.setVisible(false);
        rootNode.removeAllChildren();
        rootNode.setUserObject(new DirNode("根目录", "/"));
        treeModel.reload(rootNode);
    }

    private void refreshCurrent() {
        DefaultMutableTreeNode node = findNode(rootNode, currentPath);
        if (node != null) {
            loadChildren(node, true);
            SwingUtilities.invokeLater(() -> tree.expandPath(new TreePath(node.getPath())));
        } else if ("/".equals(currentPath)) {
            loadChildren(rootNode, true);
            SwingUtilities.invokeLater(() -> tree.expandPath(new TreePath(rootNode.getPath())));
        }
        openPath(currentPath, false);
    }

    private void checkDocker() {
        if (ops == null) {
            dockerBanner.setVisible(false);
            return;
        }
        UiSupport.runAsync(this, "检测 Docker", ops::isDockerInstalled, installed -> {
            dockerBanner.setVisible(!installed);
            revalidate();
            repaint();
        });
    }

    private void installDocker() {
        if (ops == null) {
            UiSupport.showInfo(this, "提示", "请先连接服务器");
            return;
        }
        UiSupport.runAsync(this, "安装 Docker", ops::installDocker, result -> {
            UiSupport.showInfo(this, "安装 Docker", result);
            checkDocker();
        });
    }

    private void loadChildren(DefaultMutableTreeNode node, boolean force) {
        if (ops == null) {
            return;
        }
        Object user = node.getUserObject();
        if (!(user instanceof DirNode dir)) {
            return;
        }
        if (!force) {
            if (node.getChildCount() == 1) {
                Object only = ((DefaultMutableTreeNode) node.getChildAt(0)).getUserObject();
                if (!"加载中...".equals(String.valueOf(only))) {
                    return;
                }
            } else if (node.getChildCount() > 0) {
                return;
            }
        }

        if (force || node.getChildCount() == 0) {
            node.removeAllChildren();
            node.add(new DefaultMutableTreeNode("加载中..."));
            treeModel.reload(node);
        }

        String path = dir.path();
        UiSupport.runAsync(this, "加载目录树", () -> ops.listDirectories(path), dirs -> {
            // 异步返回时路径可能已变，仍按该节点刷新
            node.removeAllChildren();
            for (FileEntry entry : dirs) {
                DefaultMutableTreeNode child = new DefaultMutableTreeNode(new DirNode(entry.getName(), entry.getPath()));
                child.add(new DefaultMutableTreeNode("加载中..."));
                node.add(child);
            }
            if (dirs.isEmpty()) {
                // 空目录也保留可展开状态取消：无子节点
            }
            treeModel.nodeStructureChanged(node);
            if (node == rootNode || "/".equals(path)) {
                tree.expandPath(new TreePath(rootNode.getPath()));
            }
        });
    }

    private void openPath(String path) {
        openPath(path, true);
    }

    private void openPath(String path, boolean ensureTree) {
        if (ops == null) {
            return;
        }
        String target = normalize(path);
        UiSupport.runAsync(this, "读取目录", () -> ops.listFiles(target), list -> {
            currentPath = target;
            pathField.setText(target);
            files.clear();
            files.addAll(list);
            model.setRowCount(0);
            for (FileEntry file : list) {
                model.addRow(new Object[]{
                        (file.isDirectory() ? "[目录] " : "") + file.getName(),
                        file.sizeLabel(),
                        file.typeLabel(),
                        file.getModified(),
                        file.getPermissions(),
                        file.getPath()
                });
            }
            if (ensureTree) {
                ensureTreePathLoaded(target);
            } else {
                selectTreePath(target);
            }
        });
    }

    private void ensureTreePathLoaded(String path) {
        if ("/".equals(path)) {
            if (rootNode.getChildCount() == 0
                    || (rootNode.getChildCount() == 1
                    && "加载中...".equals(String.valueOf(((DefaultMutableTreeNode) rootNode.getChildAt(0)).getUserObject())))) {
                loadChildren(rootNode, true);
            }
            selectTreePath("/");
            return;
        }
        selectTreePath(path);
    }

    private void selectTreePath(String path) {
        syncingTree = true;
        try {
            DefaultMutableTreeNode node = findNode(rootNode, path);
            if (node != null) {
                TreePath treePath = new TreePath(node.getPath());
                tree.expandPath(treePath.getParentPath() == null ? treePath : treePath.getParentPath());
                tree.setSelectionPath(treePath);
                tree.scrollPathToVisible(treePath);
            } else if ("/".equals(path)) {
                TreePath rootPath = new TreePath(rootNode.getPath());
                tree.setSelectionPath(rootPath);
                tree.expandPath(rootPath);
            }
        } finally {
            syncingTree = false;
        }
    }

    private DefaultMutableTreeNode findNode(DefaultMutableTreeNode node, String path) {
        Object user = node.getUserObject();
        if (user instanceof DirNode dir && path.equals(dir.path())) {
            return node;
        }
        Enumeration<?> children = node.children();
        while (children.hasMoreElements()) {
            DefaultMutableTreeNode child = (DefaultMutableTreeNode) children.nextElement();
            DefaultMutableTreeNode found = findNode(child, path);
            if (found != null) {
                return found;
            }
        }
        return null;
    }

    private void goUp() {
        if ("/".equals(currentPath)) {
            return;
        }
        int idx = currentPath.lastIndexOf('/');
        String parent = idx <= 0 ? "/" : currentPath.substring(0, idx);
        openPath(parent);
    }

    private void enterSelected() {
        FileEntry selected = selectedFile();
        if (selected == null) {
            return;
        }
        if (selected.isDirectory()) {
            openPath(selected.getPath());
        } else {
            editSelected();
        }
    }

    private void editSelected() {
        FileEntry selected = selectedFile();
        if (selected == null || ops == null) {
            return;
        }
        if (selected.isDirectory()) {
            UiSupport.showInfo(this, "提示", "请选择文件进行编辑。");
            return;
        }
        String remotePath = selected.getPath();
        UiSupport.runAsync(this, "打开文件",
                () -> ops.readText(remotePath),
                content -> openEditor(remotePath, content));
    }

    private void openEditor(String remotePath, String content) {
        Window owner = SwingUtilities.getWindowAncestor(this);
        FileEditDialog dialog = new FileEditDialog(owner, remotePath, content);
        dialog.setOnSave(text -> UiSupport.runAsyncVoid(dialog, "保存文件", () -> {
            try {
                if (ops == null) {
                    throw new IllegalStateException("未连接服务器");
                }
                ops.writeText(remotePath, text);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }, () -> {
            dialog.markSaved(text);
            if (outputConsumer != null) {
                outputConsumer.accept("保存文件", "已保存：" + remotePath);
            }
            UiSupport.showInfo(dialog, "保存成功", "已写入远程文件：\n" + remotePath);
        }));
        dialog.setVisible(true);
    }

    private void downloadSelected() {
        FileEntry selected = selectedFile();
        if (selected == null || ops == null) {
            return;
        }
        if (selected.isDirectory()) {
            UiSupport.showInfo(this, "提示", "当前仅支持下载文件。");
            return;
        }
        JFileChooser chooser = new JFileChooser();
        chooser.setSelectedFile(new java.io.File(selected.getName()));
        if (chooser.showSaveDialog(this) != JFileChooser.APPROVE_OPTION) {
            return;
        }
        Path local = chooser.getSelectedFile().toPath();
        UiSupport.runAsyncVoid(this, "下载文件", () -> {
            try {
                ops.download(selected.getPath(), local);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }, () -> UiSupport.showInfo(this, "下载完成", "已保存到: " + local));
    }

    private void uploadFile() {
        if (ops == null) {
            return;
        }
        JFileChooser chooser = new JFileChooser();
        chooser.setMultiSelectionEnabled(true);
        chooser.setFileSelectionMode(JFileChooser.FILES_AND_DIRECTORIES);
        if (chooser.showOpenDialog(this) != JFileChooser.APPROVE_OPTION) {
            return;
        }
        File[] selected = chooser.getSelectedFiles();
        if (selected == null || selected.length == 0) {
            return;
        }
        List<Path> paths = new ArrayList<>();
        for (File file : selected) {
            paths.add(file.toPath());
        }
        uploadPaths(paths);
    }

    private void installDropUpload(java.awt.Component target) {
        new DropTarget(target, DnDConstants.ACTION_COPY, new DropTargetAdapter() {
            @Override
            public void drop(DropTargetDropEvent event) {
                try {
                    event.acceptDrop(DnDConstants.ACTION_COPY);
                    @SuppressWarnings("unchecked")
                    List<File> files = (List<File>) event.getTransferable()
                            .getTransferData(DataFlavor.javaFileListFlavor);
                    if (files == null || files.isEmpty()) {
                        event.dropComplete(false);
                        return;
                    }
                    List<Path> paths = new ArrayList<>();
                    for (File file : files) {
                        if (file != null) {
                            paths.add(file.toPath());
                        }
                    }
                    event.dropComplete(true);
                    uploadPaths(paths);
                } catch (Exception ex) {
                    event.dropComplete(false);
                    UiSupport.showError(FileBrowserPanel.this, "拖拽上传失败", ex.getMessage());
                }
            }
        }, true);
    }

    private void uploadPaths(List<Path> paths) {
        if (ops == null) {
            UiSupport.showInfo(this, "提示", "请先连接服务器");
            return;
        }
        if (paths == null || paths.isEmpty()) {
            return;
        }
        String targetDir = currentPath;
        if (outputConsumer != null) {
            outputConsumer.accept("上传文件", "正在上传 " + paths.size() + " 项到 " + targetDir + " ...\n请稍候");
        }
        UiSupport.runAsync(this, "批量上传",
                () -> ops.uploadBatch(paths, targetDir),
                result -> {
                    if (outputConsumer != null) {
                        outputConsumer.accept("上传完成", result);
                    } else {
                        UiSupport.showInfo(this, "上传完成", result);
                    }
                    refreshCurrent();
                });
    }

    private void deleteSelected() {
        FileEntry selected = selectedFile();
        if (selected == null || ops == null) {
            return;
        }
        if (!UiSupport.confirm(this, "删除确认", "确认删除 " + selected.getPath() + " ？")) {
            return;
        }
        UiSupport.runAsyncVoid(this, "删除", () -> {
            try {
                ops.delete(selected.getPath());
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }, this::refreshCurrent);
    }

    private FileEntry selectedFile() {
        int row = table.getSelectedRow();
        if (row < 0) {
            UiSupport.showInfo(this, "提示", "请先在右侧列表中选中一项");
            return null;
        }
        String path = String.valueOf(model.getValueAt(row, 5));
        return files.stream().filter(f -> path.equals(f.getPath())).findFirst().orElse(null);
    }

    private static String normalize(String path) {
        if (path == null || path.isBlank()) {
            return "/";
        }
        String value = path.trim().replace('\\', '/');
        if (!value.startsWith("/")) {
            value = "/" + value;
        }
        while (value.contains("//")) {
            value = value.replace("//", "/");
        }
        if (value.length() > 1 && value.endsWith("/")) {
            value = value.substring(0, value.length() - 1);
        }
        return value;
    }

    private record DirNode(String name, String path) {
        @Override
        public String toString() {
            return name;
        }
    }

    private static final class DirTreeCellRenderer extends javax.swing.tree.DefaultTreeCellRenderer {
        @Override
        public java.awt.Component getTreeCellRendererComponent(JTree tree, Object value, boolean selected,
                                                              boolean expanded, boolean leaf, int row, boolean hasFocus) {
            super.getTreeCellRendererComponent(tree, value, selected, expanded, leaf, row, hasFocus);
            setBackgroundNonSelectionColor(AppTheme.SURFACE);
            setBackgroundSelectionColor(new java.awt.Color(0xE6F4FF));
            setTextNonSelectionColor(AppTheme.TEXT);
            setTextSelectionColor(AppTheme.TEXT);
            setBorderSelectionColor(new java.awt.Color(0x91CAFF));
            if (selected) {
                setForeground(AppTheme.TEXT);
                setOpaque(true);
                setBackground(new java.awt.Color(0xE6F4FF));
            } else {
                setForeground(AppTheme.TEXT);
                setOpaque(false);
            }
            return this;
        }
    }
}
