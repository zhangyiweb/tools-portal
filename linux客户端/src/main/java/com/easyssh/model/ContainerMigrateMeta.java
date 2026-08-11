package com.easyssh.model;

import java.util.ArrayList;
import java.util.List;

public class ContainerMigrateMeta {
    private String name;
    private String image;
    private String originalImage;
    private String workingDir = "";
    private String restart = "no";
    private String networkMode = "default";
    private List<String> env = new ArrayList<>();
    private List<String> cmd = new ArrayList<>();
    private List<String> entrypoint = new ArrayList<>();
    private List<PortMapping> ports = new ArrayList<>();
    private List<MountMapping> mounts = new ArrayList<>();

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getImage() {
        return image;
    }

    public void setImage(String image) {
        this.image = image;
    }

    public String getOriginalImage() {
        return originalImage;
    }

    public void setOriginalImage(String originalImage) {
        this.originalImage = originalImage;
    }

    public String getWorkingDir() {
        return workingDir;
    }

    public void setWorkingDir(String workingDir) {
        this.workingDir = workingDir;
    }

    public String getRestart() {
        return restart;
    }

    public void setRestart(String restart) {
        this.restart = restart;
    }

    public String getNetworkMode() {
        return networkMode;
    }

    public void setNetworkMode(String networkMode) {
        this.networkMode = networkMode;
    }

    public List<String> getEnv() {
        return env;
    }

    public void setEnv(List<String> env) {
        this.env = env;
    }

    public List<String> getCmd() {
        return cmd;
    }

    public void setCmd(List<String> cmd) {
        this.cmd = cmd;
    }

    public List<String> getEntrypoint() {
        return entrypoint;
    }

    public void setEntrypoint(List<String> entrypoint) {
        this.entrypoint = entrypoint;
    }

    public List<PortMapping> getPorts() {
        return ports;
    }

    public void setPorts(List<PortMapping> ports) {
        this.ports = ports;
    }

    public List<MountMapping> getMounts() {
        return mounts;
    }

    public void setMounts(List<MountMapping> mounts) {
        this.mounts = mounts;
    }

    public static class PortMapping {
        private String hostIp = "";
        private String hostPort;
        private String containerPort;
        private String protocol = "tcp";

        public String getHostIp() {
            return hostIp;
        }

        public void setHostIp(String hostIp) {
            this.hostIp = hostIp;
        }

        public String getHostPort() {
            return hostPort;
        }

        public void setHostPort(String hostPort) {
            this.hostPort = hostPort;
        }

        public String getContainerPort() {
            return containerPort;
        }

        public void setContainerPort(String containerPort) {
            this.containerPort = containerPort;
        }

        public String getProtocol() {
            return protocol;
        }

        public void setProtocol(String protocol) {
            this.protocol = protocol;
        }
    }

    public static class MountMapping {
        private String type;
        private String name;
        private String source;
        private String destination;
        private boolean rw = true;
        private String archive;

        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getSource() {
            return source;
        }

        public void setSource(String source) {
            this.source = source;
        }

        public String getDestination() {
            return destination;
        }

        public void setDestination(String destination) {
            this.destination = destination;
        }

        public boolean isRw() {
            return rw;
        }

        public void setRw(boolean rw) {
            this.rw = rw;
        }

        public String getArchive() {
            return archive;
        }

        public void setArchive(String archive) {
            this.archive = archive;
        }
    }
}
