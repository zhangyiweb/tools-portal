package com.easyssh.service;

import com.easyssh.model.ServerProfile;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;

import java.io.IOException;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

public class ServerProfileStore {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Type LIST_TYPE = new TypeToken<List<ServerProfile>>() {
    }.getType();

    private final Path storePath;

    public ServerProfileStore() {
        this(Path.of(System.getProperty("user.home"), ".easy-ssh", "servers.json"));
    }

    public ServerProfileStore(Path storePath) {
        this.storePath = storePath;
    }

    public List<ServerProfile> load() {
        if (!Files.exists(storePath)) {
            return new ArrayList<>();
        }
        try {
            String json = Files.readString(storePath, StandardCharsets.UTF_8);
            List<ServerProfile> list = GSON.fromJson(json, LIST_TYPE);
            return list == null ? new ArrayList<>() : list;
        } catch (IOException e) {
            return new ArrayList<>();
        }
    }

    public void save(List<ServerProfile> profiles) {
        try {
            Files.createDirectories(storePath.getParent());
            Files.writeString(storePath, GSON.toJson(profiles), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("保存服务器配置失败: " + e.getMessage(), e);
        }
    }
}
