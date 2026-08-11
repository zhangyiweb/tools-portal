package com.easyssh.model;

public class ContainerInfo {
    private String id;
    private String name;
    private String image;
    private String status;
    private String ports;
    private String created;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

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

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getPorts() {
        return ports;
    }

    public void setPorts(String ports) {
        this.ports = ports;
    }

    public String getCreated() {
        return created;
    }

    public void setCreated(String created) {
        this.created = created;
    }

    public boolean isRunning() {
        return status != null && status.toLowerCase().startsWith("up");
    }

    public String shortId() {
        if (id == null) {
            return "";
        }
        return id.length() > 12 ? id.substring(0, 12) : id;
    }
}
