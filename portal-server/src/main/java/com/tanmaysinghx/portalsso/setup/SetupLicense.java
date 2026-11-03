package com.tanmaysinghx.portalsso.setup;

import com.tanmaysinghx.portalsso.common.error.BusinessRuleViolationException;
import com.tanmaysinghx.portalsso.common.error.ErrorCode;

/** The license explicitly accepted when creating an administrator through the first-run wizard. */
public final class SetupLicense {
    public static final String ID = "Apache-2.0";

    private SetupLicense() {}

    public static void requireAcceptance(Boolean accepted, String licenseId) {
        if (!Boolean.TRUE.equals(accepted) || !ID.equals(licenseId)) {
            throw new BusinessRuleViolationException(
                    ErrorCode.VALIDATION_FAILED, "Accept the Apache License 2.0 before continuing setup.");
        }
    }
}
