package com.indravaibhavmarble.cash;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/** The server, not the screen, decides who may see and close the cash book. */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CashPermissionsTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void signedOutUsersCannotReadTheCashBook() throws Exception {
        mockMvc.perform(get("/api/cash/today")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(authorities = {"SALES_READ", "SALES_MANAGE"})
    void salespeopleCannotSeeTheCashBook() throws Exception {
        mockMvc.perform(get("/api/cash/today")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/cash/reports/cashbook")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(authorities = "CASH_READ")
    void accountantsCanReadButNotOpenOrClose() throws Exception {
        mockMvc.perform(get("/api/cash/today"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.denominations[0]").value(500));
        mockMvc.perform(post("/api/cash/sessions/open")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"openingBalance\": 100}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/cash/movements")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"movementType\": \"OWNER_CASH_OUT\", \"amount\": 100}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(authorities = {"CASH_READ", "CASH_MANAGE"})
    void reopeningAndSettingsNeedApproval() throws Exception {
        mockMvc.perform(post("/api/cash/sessions/1/reopen")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\": \"x\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/api/cash/settings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"approvalThreshold\": 0}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(authorities = {"CASH_READ", "CASH_MANAGE"})
    void invalidMoneyIsRejected() throws Exception {
        mockMvc.perform(post("/api/cash/movements")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"movementType\": \"OWNER_CASH_IN\", \"amount\": 10.555}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/cash/movements")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"movementType\": \"OWNER_CASH_IN\", \"amount\": -5}"))
                .andExpect(status().isBadRequest());
    }
}
