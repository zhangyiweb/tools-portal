package com.easyssh.ui;

import com.easyssh.model.ServerProfile;
import com.easyssh.service.DockerService;
import com.easyssh.service.ServerOpsService;
import com.easyssh.ssh.SshClient;
import com.easyssh.ui.panels.ContainerPanel;
import com.easyssh.ui.panels.DeployPanel;
import com.easyssh.ui.panels.FileBrowserPanel;
import com.easyssh.ui.panels.ImagePanel;
import com.easyssh.ui.panels.OutputPanel;
import com.easyssh.ui.panels.SystemStatusPanel;
import com.easyssh.ui.panels.VolumePanel;
import com.easyssh.ui.theme.AppTheme;

import javax.swing.BorderFactory;
import javax.swing.JPanel;
import javax.swing.JSplitPane;
import javax.swing.JTabbedPane;
import java.awt.BorderLayout;
import java.util.List;
import java.util.function.Supplier;

/**
 * 单个已连接服务器的完整工作区（左侧状态 + 右侧功能页）。
 */
public class ServerSessionPanel extends JPanel {
    private final ServerProfile profile;
    private final SystemStatusPanel systemStatusPanel = new SystemStatusPanel();
    private final FileBrowserPanel fileBrowserPanel = new FileBrowserPanel();
    private final ContainerPanel containerPanel = new ContainerPanel();
    private final VolumePanel volumePanel = new VolumePanel();
    private final ImagePanel imagePanel = new ImagePanel();
    private final DeployPanel deployPanel = new DeployPanel();
    private final OutputPanel outputPanel = new OutputPanel();
    private final JTabbedPane workspaceTabs = new JTabbedPane();

    private SshClient client;
    private boolean connected;

    public ServerSessionPanel(ServerProfile profile, Supplier<List<ServerProfile>> profilesSupplier) {
        this.profile = profile;
        setLayout(new BorderLayout());
        setBackground(AppTheme.BG);

        containerPanel.setOutputConsumer(outputPanel::showOutput);
        containerPanel.setProfilesSupplier(profilesSupplier);
        volumePanel.setOutputConsumer(outputPanel::showOutput);
        volumePanel.setOpenPathHandler(this::openVolumePath);
        imagePanel.setOutputConsumer(outputPanel::showOutput);
        deployPanel.setOutputConsumer(outputPanel::showOutput);
        fileBrowserPanel.setOutputConsumer(outputPanel::showOutput);

        JSplitPane mainSplit = new JSplitPane(
                JSplitPane.HORIZONTAL_SPLIT,
                systemStatusPanel,
                buildRightWorkspace()
        );
        mainSplit.setResizeWeight(0.22);
        mainSplit.setDividerLocation(300);
        mainSplit.setBorder(BorderFactory.createEmptyBorder());
        add(mainSplit, BorderLayout.CENTER);
    }

    private void openVolumePath(String path) {
        workspaceTabs.setSelectedIndex(0);
        fileBrowserPanel.navigateTo(path);
    }

    private JSplitPane buildRightWorkspace() {
        workspaceTabs.setFont(AppTheme.pickFont(14f).deriveFont(java.awt.Font.BOLD));
        workspaceTabs.addTab("文件管理", fileBrowserPanel);
        workspaceTabs.addTab("容器列表", containerPanel);
        workspaceTabs.addTab("数据卷", volumePanel);
        workspaceTabs.addTab("镜像", imagePanel);
        workspaceTabs.addTab("一键部署", deployPanel);

        JSplitPane split = new JSplitPane(JSplitPane.VERTICAL_SPLIT, workspaceTabs, outputPanel);
        split.setResizeWeight(0.76);
        split.setDividerLocation(640);
        split.setBorder(BorderFactory.createEmptyBorder(8, 8, 8, 8));
        return split;
    }

    public ServerProfile getProfile() {
        return profile;
    }

    public boolean isConnected() {
        return connected;
    }

    public void attach(SshClient ssh) {
        this.client = ssh;
        this.connected = true;
        ServerOpsService ops = new ServerOpsService(ssh);
        DockerService docker = new DockerService(ssh);
        systemStatusPanel.bind(ops, profile);
        fileBrowserPanel.bind(ops);
        containerPanel.bind(docker, ssh, profile);
        volumePanel.bind(docker);
        imagePanel.bind(docker);
        deployPanel.bind(ops, docker, profile);
        outputPanel.showOutput("连接成功",
                "已连接到 " + profile.displayLabel()
                        + "\n左侧查看系统状态，右侧可管理文件、容器、镜像，并使用一键部署。");
    }

    public void disposeSession() {
        systemStatusPanel.clear();
        fileBrowserPanel.clear();
        containerPanel.clear();
        volumePanel.clear();
        imagePanel.clear();
        deployPanel.clear();
        if (client != null) {
            client.close();
            client = null;
        }
        connected = false;
    }
}
