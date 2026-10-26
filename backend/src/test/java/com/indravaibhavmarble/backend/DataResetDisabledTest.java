package com.indravaibhavmarble.backend;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

// The reset switch is forced off here, so this test can never remove data.
@SpringBootTest(properties = "app.data-reset.enabled=false")
@AutoConfigureMockMvc
class DataResetDisabledTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @WithMockUser(authorities = {"ROLE_ADMIN", "USER_READ", "USER_MANAGE"})
    void dataResetIsRejectedWhenDisabled() throws Exception {
        mockMvc.perform(post("/api/users/data-reset")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"x\","
                                + "\"confirmation\":\"DELETE ALL BUSINESS DATA\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message")
                        .value("Removing business data is disabled on this server"));
    }

    @Test
    void currentUserRequiresLogin() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized());
    }
}
