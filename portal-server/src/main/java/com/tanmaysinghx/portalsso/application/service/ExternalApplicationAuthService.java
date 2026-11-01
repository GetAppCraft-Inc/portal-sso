package com.tanmaysinghx.portalsso.application.service;

import com.tanmaysinghx.portalsso.application.entity.Application;
import com.tanmaysinghx.portalsso.application.repository.ApplicationRepository;
import com.tanmaysinghx.portalsso.application.web.dto.ExternalAppAuthResponse;
import com.tanmaysinghx.portalsso.application.web.dto.ExternalAppLoginRequest;
import com.tanmaysinghx.portalsso.audit.entity.AuditAction;
import com.tanmaysinghx.portalsso.audit.service.AuditService;
import com.tanmaysinghx.portalsso.common.error.BusinessRuleViolationException;
import com.tanmaysinghx.portalsso.common.error.ErrorCode;
import com.tanmaysinghx.portalsso.common.error.ResourceConflictException;
import com.tanmaysinghx.portalsso.common.error.ResourceNotFoundException;
import com.tanmaysinghx.portalsso.registration.config.RegistrationProperties;
import com.tanmaysinghx.portalsso.registration.web.dto.RegisterRequest;
import com.tanmaysinghx.portalsso.security.password.PasswordPolicy;
import com.tanmaysinghx.portalsso.user.entity.Role;
import com.tanmaysinghx.portalsso.user.entity.User;
import com.tanmaysinghx.portalsso.user.repository.RoleRepository;
import com.tanmaysinghx.portalsso.user.repository.UserRepository;
import com.tanmaysinghx.portalsso.user.service.RoleService;
import java.util.Comparator;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.authentication.event.AuthenticationFailureBadCredentialsEvent;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.function.SingletonSupplier;

@Service
public class ExternalApplicationAuthService {

    public static final String API_KEY_HEADER = "X-Portal-App-Key";

    private final ApplicationRepository applicationRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final RegistrationProperties registrationProperties;
    private final PasswordPolicy passwordPolicy;
    private final AuditService auditService;
    private final ApplicationEventPublisher eventPublisher;

    /** A real hash to compare against when the address has no account; computed once, on first use. */
    private final Supplier<String> unknownUserHash;

    public ExternalApplicationAuthService(
            ApplicationRepository applicationRepository,
            UserRepository userRepository,
            RoleRepository roleRepository,
            PasswordEncoder passwordEncoder,
            RegistrationProperties registrationProperties,
            PasswordPolicy passwordPolicy,
            AuditService auditService,
            ApplicationEventPublisher eventPublisher) {
        this.applicationRepository = applicationRepository;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.registrationProperties = registrationProperties;
        this.passwordPolicy = passwordPolicy;
        this.auditService = auditService;
        this.eventPublisher = eventPublisher;
        this.unknownUserHash = SingletonSupplier.of(() -> passwordEncoder.encode(UUID.randomUUID().toString()));
    }

    @Transactional
    public ExternalAppAuthResponse register(UUID applicationId, String apiKey, RegisterRequest request) {
        Application app = requireExternalAuthApp(applicationId, apiKey);
        if (!app.isExternalRegistrationEnabled()) {
            throw new BusinessRuleViolationException(
                    ErrorCode.EXTERNAL_REGISTRATION_DISABLED,
                    "Registration is not enabled for this application.");
        }
        passwordPolicy.validate(request.password());

        String email = normalizeEmail(request.email());
        if (userRepository.existsByEmail(email)) {
            throw new ResourceConflictException(
                    ErrorCode.USER_ALREADY_EXISTS, "An account with that email already exists.");
        }

        Role defaultRole = roleRepository
                .findByName(registrationProperties.defaultRole())
                .orElseGet(() -> roleRepository.save(new Role(registrationProperties.defaultRole(), "Externally registered user")));

        User user = new User(email, passwordEncoder.encode(request.password()));
        user.setFirstName(request.firstName());
        user.setLastName(request.lastName());
        user.setEnabled(!registrationProperties.requireAdminApproval());
        user.addRole(defaultRole);

        // Never ROLE_ADMIN: this is a public sign-up form on someone else's site. An app restricted to
        // administrators with registration on used to make every new registrant a console admin.
        if (app.getRoles() != null) {
            app.getRoles().stream()
                    .filter(role -> !RoleService.ADMIN_ROLE.equals(role.getName()))
                    .forEach(user::addRole);
        }

        User saved = userRepository.save(user);
        auditService.record(
                AuditAction.USER_SELF_REGISTERED,
                saved.getId(),
                email,
                "sourceApplication=%s, pendingApproval=%s".formatted(app.getName(), registrationProperties.requireAdminApproval()));

        return new ExternalAppAuthResponse(
                saved.isEnabled(),
                false,
                saved.isEnabled() ? userSummary(saved) : null);
    }

    /**
     * Checks a password for an app with its own login form. Held to the same rules as the sign-in
     * page: failures count toward the lockout (through the same {@code LoginAttemptListener}), and a
     * locked or disabled account is refused <em>before</em> the password is looked at. Previously a
     * failure here was never counted — unlimited guessing — and "locked" was only reported for a
     * correct password, which told a guesser when they had found it.
     *
     * <p>{@code noRollbackFor}: the failure is reported by throwing, and the incremented counter
     * must survive that.
     */
    @Transactional(noRollbackFor = BusinessRuleViolationException.class)
    public ExternalAppAuthResponse login(UUID applicationId, String apiKey, ExternalAppLoginRequest request) {
        Application app = requireExternalAuthApp(applicationId, apiKey);
        String email = normalizeEmail(request.email());
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            // Spend the same time as a real check, so response time does not reveal who has an account.
            passwordEncoder.matches(request.password(), unknownUserHash.get());
            throw invalidCredentials(app, email);
        }

        if (user.isAccountLocked()) {
            throw new BusinessRuleViolationException(ErrorCode.ACCOUNT_LOCKED, "The user account is locked.");
        }
        if (!user.isEnabled()) {
            throw new BusinessRuleViolationException(ErrorCode.ACCOUNT_DISABLED, "The user account is disabled.");
        }
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw invalidCredentials(app, email);
        }
        if (user.getFailedLoginAttempts() != 0) {
            user.setFailedLoginAttempts(0);
        }
        user.setLastLoginAt(java.time.Instant.now());

        auditService.record(
                AuditAction.USER_LOGIN_SUCCESS,
                user.getId(),
                user.getEmail(),
                "sourceApplication=%s, externalApi=true".formatted(app.getName()));

        return new ExternalAppAuthResponse(true, user.isMfaEnabled(), userSummary(user));
    }

    private Application requireExternalAuthApp(UUID applicationId, String apiKey) {
        Application app = applicationRepository.findByIdWithRoles(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.APPLICATION_NOT_FOUND, "Application not found: " + applicationId));
        if (!app.isEnabled() || !app.isExternalAuthEnabled() || app.getExternalAuthApiKeyHash() == null) {
            throw new BusinessRuleViolationException(ErrorCode.ACCESS_DENIED, "External authentication is not enabled for this application.");
        }
        if (apiKey == null || apiKey.isBlank() || !passwordEncoder.matches(apiKey, app.getExternalAuthApiKeyHash())) {
            throw new BusinessRuleViolationException(ErrorCode.UNAUTHORIZED, "Invalid application API key.");
        }
        return app;
    }

    /** Published as a normal failed sign-in, so it is audited, recorded and counted toward lockout. */
    private BusinessRuleViolationException invalidCredentials(Application app, String email) {
        eventPublisher.publishEvent(new AuthenticationFailureBadCredentialsEvent(
                UsernamePasswordAuthenticationToken.unauthenticated(email, null),
                new BadCredentialsException("Bad credentials (external API of " + app.getName() + ")")));
        return new BusinessRuleViolationException(ErrorCode.INVALID_CREDENTIALS, "Invalid email or password.");
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase();
    }

    private static ExternalAppAuthResponse.UserSummary userSummary(User user) {
        return new ExternalAppAuthResponse.UserSummary(
                user.getId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getRoles().stream()
                        .map(Role::getName)
                        .sorted(Comparator.naturalOrder())
                        .toList());
    }

}
