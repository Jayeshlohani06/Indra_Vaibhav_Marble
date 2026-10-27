package com.indravaibhavmarble.health;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.indravaibhavmarble.health.controller.HealthController;
import com.indravaibhavmarble.health.service.HealthService;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

class HealthControllerTest {

    private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
    private final HealthController controller =
            new HealthController(new HealthService(jdbcTemplate));

    @Test
    void healthyWhenTheDatabaseAnswers() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class))).thenReturn(1);

        assertThat(controller.getHealth().getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void unavailableWhenTheDatabaseIsDown() {
        // The host must not send traffic to a deploy that cannot reach the database.
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class)))
                .thenThrow(new RuntimeException("connection refused"));

        var response = controller.getHealth();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getBody().getData().getDatabase()).isEqualTo("DOWN");
    }
}
