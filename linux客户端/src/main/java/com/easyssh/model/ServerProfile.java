package com.easyssh.model;

import java.util.Objects;
import java.util.UUID;

public class ServerProfile {
    private String id = UUID.randomUUID().toString();
    private String name = "未命名服务器";
    private String host = "";
    private int port = 22;
    private String username = "root";
    private String password = "";
    private String privateKeyPath = "";
    private AuthType authType = AuthType.PASSWORD;

    public enum AuthType {
        PASSWORD,
        PRIVATE_KEY
    }

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

    public String getHost() {
        return host;
    }

    public void setHost(String host) {
        this.host = host;
    }

    public int getPort() {
        return port;
    }

    public void setPort(int port) {
        this.port = port;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getPrivateKeyPath() {
        return privateKeyPath;
    }

    public void setPrivateKeyPath(String privateKeyPath) {
        this.privateKeyPath = privateKeyPath;
    }

    public AuthType getAuthType() {
        return authType;
    }

    public void setAuthType(AuthType authType) {
        this.authType = authType;
    }

    public String displayLabel() {
        return name + "（" + username + "@" + host + ":" + port + "）";
    }

    @Override
    public String toString() {
        return displayLabel();
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof ServerProfile that)) {
            return false;
        }
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
