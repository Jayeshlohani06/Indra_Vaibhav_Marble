package com.indravaibhavmarble.health.controller;

import com.indravaibhavmarble.common.response.ApiResponse;
import com.indravaibhavmarble.health.dto.HealthResponse;
import com.indravaibhavmarble.health.service.HealthService;
import org.springframework.http.HttpStatus;
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

    /**
     * The host's health check. Answers 503 when the database is unreachable,
     * so a new deploy that cannot reach the database never takes traffic.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<HealthResponse>> getHealth() {

        HealthResponse healthResponse = healthService.getHealthStatus();

        if (!"UP".equals(healthResponse.getDatabase())) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(ApiResponse.success(
                            "Database is unavailable",
                            healthResponse));
        }

        return ResponseEntity.ok(
                ApiResponse.success(
                        "Application health retrieved successfully",
                        healthResponse
                )
        );
    }
}
