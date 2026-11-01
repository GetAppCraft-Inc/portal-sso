package com.tanmaysinghx.portalsso.application.entity;

import com.tanmaysinghx.portalsso.common.entity.BaseEntity;
import com.tanmaysinghx.portalsso.user.entity.Role;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "applications")
public class Application extends BaseEntity {

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @Column(name = "description", length = 1000)
    private String description;

    @Column(name = "app_url", nullable = false, length = 1000)
    private String appUrl;

    /** Where the app starts its Portal SSO sign-in (OIDC initiate_login_uri). Optional. */
    @Column(name = "login_url", length = 1000)
    private String loginUrl;

    @Column(name = "icon_url", length = 1000)
    private String iconUrl;

    @Column(name = "category", nullable = false, length = 100)
    private String category = "General";

    @Column(name = "client_id", length = 100)
    private String clientId;

    @Enumerated(EnumType.STRING)
    @Column(name = "access_type", nullable = false, length = 50)
    private ApplicationAccessType accessType = ApplicationAccessType.ALL_USERS;

    @Column(name = "enabled", nullable = false)
    private boolean enabled = true;

    @Column(name = "display_order", nullable = false)
    private int displayOrder = 0;

    @Column(name = "external_auth_enabled", nullable = false)
    private boolean externalAuthEnabled = false;

    @Column(name = "external_registration_enabled", nullable = false)
    private boolean externalRegistrationEnabled = true;

    @Column(name = "external_auth_api_key_hash", length = 255)
    private String externalAuthApiKeyHash;

    @Column(name = "external_auth_api_key_prefix", length = 16)
    private String externalAuthApiKeyPrefix;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "application_roles",
            joinColumns = @JoinColumn(name = "application_id"),
            inverseJoinColumns = @JoinColumn(name = "role_id"))
    private Set<Role> roles = new HashSet<>();

    protected Application() {
        // JPA
    }

    public Application(String name, String appUrl) {
        this.name = name;
        this.appUrl = appUrl;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getAppUrl() {
        return appUrl;
    }

    public void setAppUrl(String appUrl) {
        this.appUrl = appUrl;
    }

    public String getIconUrl() {
        return iconUrl;
    }

    public void setIconUrl(String iconUrl) {
        this.iconUrl = iconUrl;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getClientId() {
        return clientId;
    }

    public void setClientId(String clientId) {
        this.clientId = clientId;
    }

    public ApplicationAccessType getAccessType() {
        return accessType;
    }

    public void setAccessType(ApplicationAccessType accessType) {
        this.accessType = accessType;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public int getDisplayOrder() {
        return displayOrder;
    }

    public void setDisplayOrder(int displayOrder) {
        this.displayOrder = displayOrder;
    }

    public boolean isExternalAuthEnabled() {
        return externalAuthEnabled;
    }

    public void setExternalAuthEnabled(boolean externalAuthEnabled) {
        this.externalAuthEnabled = externalAuthEnabled;
    }

    public boolean isExternalRegistrationEnabled() {
        return externalRegistrationEnabled;
    }

    public void setExternalRegistrationEnabled(boolean externalRegistrationEnabled) {
        this.externalRegistrationEnabled = externalRegistrationEnabled;
    }

    public String getExternalAuthApiKeyHash() {
        return externalAuthApiKeyHash;
    }

    public void setExternalAuthApiKeyHash(String externalAuthApiKeyHash) {
        this.externalAuthApiKeyHash = externalAuthApiKeyHash;
    }

    public String getExternalAuthApiKeyPrefix() {
        return externalAuthApiKeyPrefix;
    }

    public void setExternalAuthApiKeyPrefix(String externalAuthApiKeyPrefix) {
        this.externalAuthApiKeyPrefix = externalAuthApiKeyPrefix;
    }

    public Set<Role> getRoles() {
        return roles;
    }

    public void setRoles(Set<Role> roles) {
        this.roles = roles;
    }

    public String getLoginUrl() {
        return loginUrl;
    }

    public void setLoginUrl(String loginUrl) {
        this.loginUrl = loginUrl == null || loginUrl.isBlank() ? null : loginUrl.strip();
    }

    /**
     * What a tile on My Apps opens. With a sign-in URL this is OIDC third-party initiated login:
     * {@code iss} tells the app which provider to use and {@code target_link_uri} where to land, the
     * app redirects to /oauth2/authorize, the Portal session is already there, and the user arrives
     * signed in. Without one, the app's home page — where the user may meet its own login screen.
     */
    public String launchUrl(String issuer) {
        if (loginUrl == null) {
            return appUrl;
        }
        // Values go in as template variables: those are encoded strictly, so an appUrl carrying its
        // own ?a=1&b=2 stays one parameter instead of spilling into the sign-in URL's query.
        return org.springframework.web.util.UriComponentsBuilder.fromUriString(loginUrl)
                .queryParam("iss", "{iss}")
                .queryParam("target_link_uri", "{target}")
                .encode()
                .buildAndExpand(issuer, appUrl)
                .toUriString();
    }

    /**
     * Restricted to roles of which ROLE_ADMIN is the only one. Access to such an app can never be
     * requested or self-registered, because neither path is allowed to grant ROLE_ADMIN.
     */
    public boolean isAdminOnly() {
        return accessType == ApplicationAccessType.RESTRICTED
                && roles != null
                && !roles.isEmpty()
                && roles.stream().allMatch(r -> "ROLE_ADMIN".equals(r.getName()));
    }
}
