package com.tanmaysinghx.portalsso.user.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tanmaysinghx.portalsso.user.entity.User;
import com.tanmaysinghx.portalsso.user.repository.UserRepository;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/** Disabling an account is offboarding: what the person's apps hold must stop working at once. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DisableUserRevokesAccessTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    void disablingRevokesTheUsersStoredAuthorizationsButNobodyElses() throws Exception {
        User leaver = new User("leaver@example.com", "x");
        leaver.setEnabled(true);
        userRepository.save(leaver);

        insertAuthorization("leaver@example.com");
        insertAuthorization("stayer@example.com");

        mockMvc.perform(patch("/api/admin/users/" + leaver.getId())
                        .with(user("admin@example.com").roles("ADMIN"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\": false}"))
                .andExpect(status().isOk());

        assertThat(count("leaver@example.com")).isZero();
        assertThat(count("stayer@example.com")).isEqualTo(1);
    }

    private void insertAuthorization(String principal) {
        jdbcTemplate.update(
                "INSERT INTO oauth2_authorization (id, registered_client_id, principal_name, authorization_grant_type) VALUES (?, ?, ?, ?)",
                UUID.randomUUID().toString(), "client-1", principal, "authorization_code");
    }

    private int count(String principal) {
        Integer n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM oauth2_authorization WHERE principal_name = ?", Integer.class, principal);
        return n == null ? 0 : n;
    }
}
