package com.tanmaysinghx.portalsso.security.web;

import com.tanmaysinghx.portalsso.client.entity.OAuthClient;
import com.tanmaysinghx.portalsso.client.repository.OAuthClientRepository;
import java.net.URI;
import java.util.Locale;
import java.util.Optional;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Decides whether a {@code return_url} on the sign-in page may be followed.
 *
 * <p>Without this, {@code /login?return_url=https://evil.example} sent a signed-in user anywhere —
 * an open redirect on the one host every user has learned to trust, which is exactly what a
 * phishing link wants. Allowed: a path on this server, or an http(s) URL whose origin is the origin
 * of a redirect URI registered on an enabled OAuth client (so an app can send its users back to
 * itself). Everything else, including {@code //host} and {@code javascript:}, is refused.
 */
@Component
public class ReturnUrlPolicy {

    private final OAuthClientRepository clientRepository;

    public ReturnUrlPolicy(OAuthClientRepository clientRepository) {
        this.clientRepository = clientRepository;
    }

    /** The URL to follow, or empty when it must not be followed. */
    public Optional<String> accept(String candidate) {
        if (candidate == null || candidate.isBlank()) {
            return Optional.empty();
        }
        String url = candidate.strip();
        if (isLocalPath(url)) {
            return Optional.of(url);
        }
        String origin = originOf(url);
        if (origin == null) {
            return Optional.empty();
        }
        boolean registered = clientRepository.findAll().stream()
                .filter(OAuthClient::isEnabled)
                .flatMap(c -> StringUtils.commaDelimitedListToSet(c.getRedirectUris()).stream())
                .map(ReturnUrlPolicy::originOf)
                .anyMatch(origin::equals);
        return registered ? Optional.of(url) : Optional.empty();
    }

    /** "/apps" yes; "//evil.example" and "/\evil.example" are protocol-relative to a browser. */
    static boolean isLocalPath(String url) {
        return url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/\\");
    }

    static String originOf(String url) {
        try {
            URI uri = URI.create(url.strip());
            String scheme = uri.getScheme() == null ? null : uri.getScheme().toLowerCase(Locale.ROOT);
            if (!"http".equals(scheme) && !"https".equals(scheme) || uri.getHost() == null) {
                return null;
            }
            int port = uri.getPort() != -1 ? uri.getPort() : ("https".equals(scheme) ? 443 : 80);
            return scheme + "://" + uri.getHost().toLowerCase(Locale.ROOT) + ":" + port;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
