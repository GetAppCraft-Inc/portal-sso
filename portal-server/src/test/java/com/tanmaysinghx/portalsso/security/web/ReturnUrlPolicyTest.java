package com.tanmaysinghx.portalsso.security.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.tanmaysinghx.portalsso.client.entity.OAuthClient;
import com.tanmaysinghx.portalsso.client.repository.OAuthClientRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ReturnUrlPolicyTest {

    private ReturnUrlPolicy policy;

    @BeforeEach
    void setUp() {
        OAuthClient app = mock(OAuthClient.class);
        when(app.isEnabled()).thenReturn(true);
        when(app.getRedirectUris()).thenReturn("https://tickets.example.com/callback,http://localhost:3000/cb");
        OAuthClient disabled = mock(OAuthClient.class);
        when(disabled.isEnabled()).thenReturn(false);
        when(disabled.getRedirectUris()).thenReturn("https://retired.example.com/callback");

        OAuthClientRepository repository = mock(OAuthClientRepository.class);
        when(repository.findAll()).thenReturn(List.of(app, disabled));
        policy = new ReturnUrlPolicy(repository);
    }

    @Test
    void pathsOnThisServerAreFollowed() {
        assertThat(policy.accept("/apps")).contains("/apps");
        assertThat(policy.accept("/oauth2/authorize?client_id=x")).isPresent();
    }

    @Test
    void aRegisteredAppsOriginIsFollowedOnAnyPath() {
        assertThat(policy.accept("https://tickets.example.com/inbox?id=4")).isPresent();
        assertThat(policy.accept("https://TICKETS.example.com:443/")).isPresent();
        assertThat(policy.accept("http://localhost:3000/home")).isPresent();
    }

    @Test
    void everythingElseIsRefused() {
        assertThat(policy.accept("https://evil.example/phish")).isEmpty();
        assertThat(policy.accept("//evil.example/phish")).isEmpty();
        assertThat(policy.accept("/\\evil.example")).isEmpty();
        assertThat(policy.accept("javascript:alert(1)")).isEmpty();
        assertThat(policy.accept("https://tickets.example.com.evil.example/")).isEmpty();
        assertThat(policy.accept("http://tickets.example.com/")).as("scheme is part of the origin").isEmpty();
        assertThat(policy.accept("http://localhost:3001/")).as("so is the port").isEmpty();
        assertThat(policy.accept("https://retired.example.com/")).as("disabled clients don't count").isEmpty();
        assertThat(policy.accept("  ")).isEmpty();
    }
}
