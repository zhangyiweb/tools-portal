package com.easyssh.model;

public class ProcessInfo {
    private String user;
    private String pid;
    private String cpu;
    private String mem;
    private String command;

    public String getUser() {
        return user;
    }

    public void setUser(String user) {
        this.user = user;
    }

    public String getPid() {
        return pid;
    }

    public void setPid(String pid) {
        this.pid = pid;
    }

    public String getCpu() {
        return cpu;
    }

    public void setCpu(String cpu) {
        this.cpu = cpu;
    }

    public String getMem() {
        return mem;
    }

    public void setMem(String mem) {
        this.mem = mem;
    }

    public String getCommand() {
        return command;
    }

    public void setCommand(String command) {
        this.command = command;
    }

    public String shortCommand() {
        if (command == null || command.isBlank()) {
            return "-";
        }
        String name = command.trim();
        int slash = name.lastIndexOf('/');
        if (slash >= 0 && slash < name.length() - 1) {
            name = name.substring(slash + 1);
        }
        int space = name.indexOf(' ');
        if (space > 0) {
            name = name.substring(0, space);
        }
        return name.length() > 28 ? name.substring(0, 28) + "..." : name;
    }
}
