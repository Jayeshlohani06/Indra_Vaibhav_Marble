package com.indravaibhavmarble.health.controller;

import com.indravaibhavmarble.common.response.ApiResponse;
import com.indravaibhavmarble.health.dto.HealthResponse;
import com.indravaibhavmarble.health.service.HealthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    private final HealthService healthService;

    public HealthController(HealthService healthService) {
        this.healthService = healthService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<HealthResponse>> getHealth() {

        HealthResponse healthResponse = healthService.getHealthStatus();

        return ResponseEntity.ok(
                ApiResponse.success(
                        "Application health retrieved successfully",
                        healthResponse
                )
        );
    }
}