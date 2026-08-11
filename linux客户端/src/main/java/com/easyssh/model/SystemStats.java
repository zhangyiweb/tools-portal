package com.easyssh.model;

import java.util.ArrayList;
import java.util.List;

public class SystemStats {
    private String hostname = "-";
    private String uptime = "-";
    private String cpuUsage = "-";
    private String memoryUsage = "-";
    private String diskUsage = "-";
    private String loadAverage = "-";
    private String osInfo = "-";
    private String syncTip = "未同步";
    private String ipAddress = "-";

    private int cpuPercent;
    private int memPercent;
    private int swapPercent;
    private String memDetail = "-";
    private String swapDetail = "-";
    private String load1 = "-";
    private String load5 = "-";
    private String load15 = "-";

    private final List<ProcessInfo> topProcesses = new ArrayList<>();
    private final List<DiskInfo> disks = new ArrayList<>();

    public String getHostname() {
        return hostname;
    }

    public void setHostname(String hostname) {
        this.hostname = hostname;
    }

    public String getUptime() {
        return uptime;
    }

    public void setUptime(String uptime) {
        this.uptime = uptime;
    }

    public String getCpuUsage() {
        return cpuUsage;
    }

    public void setCpuUsage(String cpuUsage) {
        this.cpuUsage = cpuUsage;
    }

    public String getMemoryUsage() {
        return memoryUsage;
    }

    public void setMemoryUsage(String memoryUsage) {
        this.memoryUsage = memoryUsage;
    }

    public String getDiskUsage() {
        return diskUsage;
    }

    public void setDiskUsage(String diskUsage) {
        this.diskUsage = diskUsage;
    }

    public String getLoadAverage() {
        return loadAverage;
    }

    public void setLoadAverage(String loadAverage) {
        this.loadAverage = loadAverage;
    }

    public String getOsInfo() {
        return osInfo;
    }

    public void setOsInfo(String osInfo) {
        this.osInfo = osInfo;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public void setIpAddress(String ipAddress) {
        this.ipAddress = ipAddress == null || ipAddress.isBlank() ? "-" : ipAddress.trim();
    }

    public String getSyncTip() {
        return syncTip;
    }

    public void setSyncTip(String syncTip) {
        this.syncTip = syncTip;
    }

    public int getCpuPercent() {
        return cpuPercent;
    }

    public void setCpuPercent(int cpuPercent) {
        this.cpuPercent = clamp(cpuPercent);
    }

    public int getMemPercent() {
        return memPercent;
    }

    public void setMemPercent(int memPercent) {
        this.memPercent = clamp(memPercent);
    }

    public int getSwapPercent() {
        return swapPercent;
    }

    public void setSwapPercent(int swapPercent) {
        this.swapPercent = clamp(swapPercent);
    }

    public String getMemDetail() {
        return memDetail;
    }

    public void setMemDetail(String memDetail) {
        this.memDetail = memDetail;
    }

    public String getSwapDetail() {
        return swapDetail;
    }

    public void setSwapDetail(String swapDetail) {
        this.swapDetail = swapDetail;
    }

    public String getLoad1() {
        return load1;
    }

    public void setLoad1(String load1) {
        this.load1 = load1;
    }

    public String getLoad5() {
        return load5;
    }

    public void setLoad5(String load5) {
        this.load5 = load5;
    }

    public String getLoad15() {
        return load15;
    }

    public void setLoad15(String load15) {
        this.load15 = load15;
    }

    public List<ProcessInfo> getTopProcesses() {
        return topProcesses;
    }

    public List<DiskInfo> getDisks() {
        return disks;
    }

    private static int clamp(int value) {
        return Math.max(0, Math.min(100, value));
    }
}
