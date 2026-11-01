package com.tanmaysinghx.portalsso.setup;

import com.tanmaysinghx.portalsso.mail.service.EmailSettingsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Applies {@code app.organization.*} at startup, filling in only what the console has not set.
 *
 * <p>Invalid values are logged and skipped rather than failing the start: a typo in a logo URL is
 * not worth an outage, and the operator can fix it in the console.
 */
@Component
public class OrganizationSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(OrganizationSeeder.class);

    private final OrganizationProperties properties;
    private final EmailSettingsService emailSettingsService;

    public OrganizationSeeder(OrganizationProperties properties, EmailSettingsService emailSettingsService) {
        this.properties = properties;
        this.emailSettingsService = emailSettingsService;
    }

    @Override
    public void run(ApplicationArguments args) {
        Organization organization = properties.toOrganization();
        if (organization.hasNothing()) {
            return;
        }
        if (!organization.problems().isEmpty()) {
            log.warn("Ignoring app.organization.* from configuration: {}", String.join(" ", organization.problems()));
            return;
        }
        if (emailSettingsService.applyOrganization(
                organization.name(), organization.logoUrl(), organization.supportUrl(), true, "configuration")) {
            log.info("Applied organization details from app.organization.* configuration.");
        }
    }
}
