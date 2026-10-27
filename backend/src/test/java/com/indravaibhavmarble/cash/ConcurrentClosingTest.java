package com.indravaibhavmarble.cash;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.indravaibhavmarble.cash.dto.CashSessionDtos.CloseRequest;
import com.indravaibhavmarble.cash.dto.CashSessionDtos.CountLine;
import com.indravaibhavmarble.cash.service.CashSessionService;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Two people press "Close day" at the same moment. This needs real commits,
 * so it uses a day far in the future and deletes it afterwards.
 */
@SpringBootTest
class ConcurrentClosingTest {

    @Autowired private CashSessionService sessionService;
    @Autowired private JdbcTemplate jdbc;

    @Test
    void onlyOneOfTwoSimultaneousClosesWins() throws Exception {
        Integer open = jdbc.queryForObject("SELECT COUNT(*) FROM cash_sessions WHERE status = 'OPEN'"
                + " OR business_date >= '2099-12-31'", Integer.class);
        assumeTrue(open != null && open == 0, "Another day is open in this database");

        Long id = jdbc.queryForObject("INSERT INTO cash_sessions (business_date, status, opening_balance, opened_by)"
                + " VALUES ('2099-12-31', 'OPEN', 0, 'test') RETURNING id", Long.class);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            CountDownLatch start = new CountDownLatch(1);
            List<String> outcomes = Collections.synchronizedList(new ArrayList<>());
            List<Future<?>> futures = new ArrayList<>();
            for (int i = 0; i < 2; i++) {
                futures.add(pool.submit(() -> {
                    SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(
                            "owner@example.com", null, "CASH_MANAGE", "CASH_APPROVE"));
                    try {
                        start.await();
                        sessionService.close(id, new CloseRequest(
                                List.of(new CountLine(new BigDecimal("500"), 1)),
                                "Concurrency test", null, UUID.randomUUID()));
                        outcomes.add("closed");
                    } catch (Exception exception) {
                        outcomes.add(exception.getMessage());
                    } finally {
                        SecurityContextHolder.clearContext();
                    }
                    return null;
                }));
            }
            start.countDown();
            for (Future<?> future : futures) {
                future.get();
            }

            assertThat(outcomes).containsOnlyOnce("closed");
            assertThat(outcomes).anyMatch(outcome -> outcome.contains("already closed"));
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM cash_count_lines WHERE session_id = ?",
                    Integer.class, id)).isEqualTo(1);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM financial_audit_log"
                    + " WHERE entity_type = 'CASH_SESSION' AND entity_id = ? AND action = 'CLOSE'",
                    Integer.class, id)).isEqualTo(1);
        } finally {
            pool.shutdownNow();
            jdbc.update("DELETE FROM financial_audit_log WHERE entity_type = 'CASH_SESSION' AND entity_id = ?", id);
            jdbc.update("DELETE FROM cash_count_lines WHERE session_id = ?", id);
            jdbc.update("DELETE FROM cash_sessions WHERE id = ?", id);
        }
    }
}
