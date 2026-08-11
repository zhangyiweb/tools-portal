package com.easyssh.model;

public class MigrateOptions {
    public enum ImageMode {
        /** 使用目标服务器已有镜像重建容器（只迁配置与数据） */
        USE_TARGET_IMAGE,
        /** 提交源容器并整包传输镜像（体积大，最一致） */
        TRANSFER_COMMITTED
    }

    private String targetName;
    private boolean stopSource = false;
    private boolean includeVolumes = true;
    private boolean startAfterMigrate = true;
    private boolean removeSourceAfterSuccess = false;
    private ImageMode imageMode = ImageMode.USE_TARGET_IMAGE;
    private String targetImage = "";
    private boolean pullIfMissing = false;

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

    public ImageMode getImageMode() {
        return imageMode == null ? ImageMode.USE_TARGET_IMAGE : imageMode;
    }

    public void setImageMode(ImageMode imageMode) {
        this.imageMode = imageMode;
    }

    public String getTargetImage() {
        return targetImage;
    }

    public void setTargetImage(String targetImage) {
        this.targetImage = targetImage;
    }

    public boolean isPullIfMissing() {
        return pullIfMissing;
    }

    public void setPullIfMissing(boolean pullIfMissing) {
        this.pullIfMissing = pullIfMissing;
    }

    public boolean useTargetImage() {
        return getImageMode() == ImageMode.USE_TARGET_IMAGE;
    }
}
