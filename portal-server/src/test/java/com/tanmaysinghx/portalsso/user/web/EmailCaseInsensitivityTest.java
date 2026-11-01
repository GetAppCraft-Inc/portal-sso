package com.tanmaysinghx.portalsso.user.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tanmaysinghx.portalsso.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/** An address is one account however it is capitalised — when created and when signing in. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class EmailCaseInsensitivityTest {

    private static final String PASSWORD = "Mixed-Case-Pass-42";

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;

    @Test
    void anAdminCreatedAccountIsStoredLowerCaseAndSignsInWithAnyCase() throws Exception {
        mockMvc.perform(post("/api/admin/users")
                        .with(user("admin@example.com").roles("ADMIN"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email": "Jane.Case@Example.COM", "password": "%s"}
                                """.formatted(PASSWORD)))
                .andExpect(status().isCreated());

        assertThat(userRepository.findOneByEmail("jane.case@example.com")).isPresent();

        // The same person cannot be created twice by changing the capitals.
        mockMvc.perform(post("/api/admin/users")
                        .with(user("admin@example.com").roles("ADMIN"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email": "JANE.CASE@example.com", "password": "%s"}
                                """.formatted(PASSWORD)))
                .andExpect(status().isConflict());

        mockMvc.perform(post("/login")
                        .with(csrf())
                        .param("username", "Jane.Case@EXAMPLE.com")
                        .param("password", PASSWORD))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("/"));
    }
}
