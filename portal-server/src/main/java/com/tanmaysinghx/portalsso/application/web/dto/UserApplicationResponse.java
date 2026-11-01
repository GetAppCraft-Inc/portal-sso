package com.tanmaysinghx.portalsso.application.web.dto;

import com.tanmaysinghx.portalsso.application.entity.Application;
import java.util.UUID;

/**
 * @param launchUrl what the tile opens: the app's sign-in URL with {@code iss} and
 *     {@code target_link_uri} when one is configured (so the user arrives signed in), otherwise
 *     {@code appUrl}
 * @param signsInDirectly whether {@code launchUrl} is an initiated sign-in rather than the home page
 */
public record UserApplicationResponse(
        UUID id,
        String name,
        String description,
        String appUrl,
        String launchUrl,
        boolean signsInDirectly,
        String iconUrl,
        String category,
        String clientId,
        boolean accessible,
        String pendingRequestStatus) {

    public static UserApplicationResponse from(
            Application app, boolean accessible, String pendingRequestStatus, String issuerUrl) {
        return new UserApplicationResponse(
                app.getId(),
                app.getName(),
                app.getDescription(),
                app.getAppUrl(),
                app.launchUrl(issuerUrl),
                app.getLoginUrl() != null,
                app.getIconUrl(),
                app.getCategory() == null ? "General" : app.getCategory(),
                app.getClientId(),
                accessible,
                pendingRequestStatus);
    }
}
