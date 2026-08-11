package com.easyssh.model;

public class MigrateOptions {
    private String targetName;
    private boolean stopSource = true;
    private boolean includeVolumes = true;
    private boolean startAfterMigrate = true;
    private boolean removeSourceAfterSuccess = false;

    public String getTargetName() {
        return targetName;
    }

    public void setTargetName(String targetName) {
        this.targetName = targetName;
    }

    public boolean isStopSource() {
        return stopSource;
    }

    public void setStopSource(boolean stopSource) {
        this.stopSource = stopSource;
    }

    public boolean isIncludeVolumes() {
        return includeVolumes;
    }

    public void setIncludeVolumes(boolean includeVolumes) {
        this.includeVolumes = includeVolumes;
    }

    public boolean isStartAfterMigrate() {
        return startAfterMigrate;
    }

    public void setStartAfterMigrate(boolean startAfterMigrate) {
        this.startAfterMigrate = startAfterMigrate;
    }

    public boolean isRemoveSourceAfterSuccess() {
        return removeSourceAfterSuccess;
    }

    public void setRemoveSourceAfterSuccess(boolean removeSourceAfterSuccess) {
        this.removeSourceAfterSuccess = removeSourceAfterSuccess;
    }
}
