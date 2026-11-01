package com.tanmaysinghx.portalsso.setup;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Who this deployment belongs to: the name and logo on the sign-in page and in every email, and
 * where users go for help. Stored in {@code email_settings} — the server's only copy of branding.
 *
 * @param logoUrl must be an absolute http(s) URL, because mail clients fetch it themselves; a data
 *     URI or a relative path would render in the console and break in every inbox
 */
public record Organization(String name, String logoUrl, String supportUrl) {

    static final int MAX_NAME_LENGTH = 100;
    static final int MAX_URL_LENGTH = 1000;

    public Organization {
        name = trimToNull(name);
        logoUrl = trimToNull(logoUrl);
        supportUrl = trimToNull(supportUrl);
    }

    public boolean hasNothing() {
        return name == null && logoUrl == null && supportUrl == null;
    }

    /** Problems an operator can fix, worded to be shown to them as they are. */
    public List<String> problems() {
        List<String> problems = new ArrayList<>();
        if (name != null && name.length() > MAX_NAME_LENGTH) {
            problems.add("Organization name must be at most " + MAX_NAME_LENGTH + " characters.");
        }
        if (logoUrl != null && !isHttpUrl(logoUrl)) {
            problems.add("Logo URL must be a full http:// or https:// address, such as https://example.com/logo.png.");
        }
        if (supportUrl != null && !isHttpUrl(supportUrl)) {
            problems.add("Support URL must be a full http:// or https:// address.");
        }
        return problems;
    }

    private static boolean isHttpUrl(String value) {
        if (value.length() > MAX_URL_LENGTH) {
            return false;
        }
        try {
            URI uri = URI.create(value);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            return (scheme.equals("http") || scheme.equals("https")) && uri.getHost() != null;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.strip();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
