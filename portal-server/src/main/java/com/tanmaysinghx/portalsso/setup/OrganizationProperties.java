package com.tanmaysinghx.portalsso.setup;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Organization details from configuration, for operators who set a deployment up from a file
 * ({@code portal.properties}) or environment ({@code APP_ORGANIZATION_NAME}, ...) instead of the
 * wizard. They pre-fill the wizard and fill in whatever the console has not set — never override
 * it, so an edit made under Settings is not undone by the next restart.
 */
@ConfigurationProperties(prefix = "app.organization")
public record OrganizationProperties(String name, String logoUrl, String supportUrl) {

    public Organization toOrganization() {
        return new Organization(name, logoUrl, supportUrl);
    }
}
