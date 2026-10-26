package com.indravaibhavmarble.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.indravaibhavmarble.common.payment.PaymentStatus;
import com.indravaibhavmarble.purchase.service.PurchaseNumberGenerator;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class UiSupportTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void paymentStatusFollowsAmountPaid() {
        BigDecimal total = new BigDecimal("1000.00");

        assertThat(PaymentStatus.of(total, BigDecimal.ZERO)).isEqualTo("UNPAID");
        assertThat(PaymentStatus.of(total, new BigDecimal("250.00"))).isEqualTo("PARTIALLY_PAID");
        assertThat(PaymentStatus.of(total, new BigDecimal("1000.00"))).isEqualTo("PAID");
        assertThat(PaymentStatus.of(BigDecimal.ZERO, BigDecimal.ZERO)).isEqualTo("PAID");
    }

    @Test
    void purchaseNumbersAreShortAndPadded() {
        // A mocked sequence keeps this test from using up real numbers.
        EntityManager entityManager = mock(EntityManager.class);
        Query query = mock(Query.class);
        when(entityManager.createNativeQuery("SELECT nextval('purchase_number_seq')"))
                .thenReturn(query);
        when(query.getSingleResult()).thenReturn(17L, 12345L);

        PurchaseNumberGenerator generator = new PurchaseNumberGenerator(entityManager);

        assertThat(generator.generate()).isEqualTo("PUR-0017");
        assertThat(generator.generate()).isEqualTo("PUR-12345");
    }

    @Test
    @WithMockUser(authorities = "SALES_READ")
    void customerDuesReportNeedsReportPermission() throws Exception {
        mockMvc.perform(get("/api/reports/customer-outstanding"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(authorities = "REPORT_READ")
    void customerDuesReportIsAvailableToReportReaders() throws Exception {
        mockMvc.perform(get("/api/reports/customer-outstanding"))
                .andExpect(status().isOk());
    }
}
