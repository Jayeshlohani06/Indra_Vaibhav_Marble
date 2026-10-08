package com.indravaibhavmarble.health.dto;

public class HealthResponse {

    private String status;
    private String service;
    private String database;

    public HealthResponse(String status, String service, String database) {
        this.status = status;
        this.service = service;
        this.database = database;
    }

    public String getStatus() {
        return status;
    }

    public String getService() {
        return service;
    }

    public String getDatabase() {
        return database;
    }
}