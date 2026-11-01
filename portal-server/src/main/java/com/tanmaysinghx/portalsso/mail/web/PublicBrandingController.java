package com.tanmaysinghx.portalsso.mail.web;

import com.tanmaysinghx.portalsso.mail.entity.EmailSettings;
import com.tanmaysinghx.portalsso.mail.service.EmailSettingsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The organization's name and logo for the sign-in page, before anyone has signed in.
 *
 * <p>The console keeps its own per-browser branding in {@code localStorage}; this is what it shows
 * when that is empty, so a colleague opening the sign-in page for the first time sees the company
 * the setup wizard named rather than an unbranded product. Both fields are null until set, letting
 * the console fall back to its own defaults.
 */
@RestController
public class PublicBrandingController {

    public record PublicBrandingResponse(String productName, String logoUrl) {}

    private final EmailSettingsService emailSettingsService;

    public PublicBrandingController(EmailSettingsService emailSettingsService) {
        this.emailSettingsService = emailSettingsService;
    }

    @GetMapping("/api/public/branding")
    public PublicBrandingResponse branding() {
        EmailSettings settings = emailSettingsService.currentSettings();
        return new PublicBrandingResponse(settings.getProductName(), settings.getLogoUrl());
    }
}
