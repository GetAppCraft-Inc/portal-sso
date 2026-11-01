package com.tanmaysinghx.portalsso.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.tanmaysinghx.portalsso.application.entity.AccessRequest;
import com.tanmaysinghx.portalsso.application.entity.Application;
import com.tanmaysinghx.portalsso.application.entity.ApplicationAccessType;
import com.tanmaysinghx.portalsso.application.repository.AccessRequestRepository;
import com.tanmaysinghx.portalsso.application.repository.ApplicationRepository;
import com.tanmaysinghx.portalsso.common.error.BusinessRuleViolationException;
import com.tanmaysinghx.portalsso.user.entity.Role;
import com.tanmaysinghx.portalsso.user.entity.User;
import com.tanmaysinghx.portalsso.user.repository.RoleRepository;
import com.tanmaysinghx.portalsso.user.repository.UserRepository;
import com.tanmaysinghx.portalsso.user.service.RoleService;
import com.tanmaysinghx.portalsso.application.web.dto.SubmitAccessRequestRequest;
import com.tanmaysinghx.portalsso.application.web.dto.UserApplicationResponse;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AccessRequestApprovalTest {

    @Autowired private AccessRequestService accessRequestService;
    @Autowired private ApplicationService applicationService;
    @Autowired private AccessRequestRepository accessRequestRepository;
    @Autowired private ApplicationRepository applicationRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;

    private AccessRequest requestFor(Set<Role> appRoles) {
        User admin = new User("reviewer-" + appRoles.size() + "@example.com", "x");
        admin.setEnabled(true);
        admin.addRole(roleRepository.findByName(RoleService.ADMIN_ROLE).orElseThrow());
        userRepository.save(admin);

        User requester = new User("requester-" + appRoles.size() + "@example.com", "x");
        requester.setEnabled(true);
        roleRepository.findByName("ROLE_USER").ifPresent(requester::addRole);
        userRepository.save(requester);

        Application app = new Application("Restricted " + appRoles.size(), "https://app.example.com");
        app.setAccessType(ApplicationAccessType.RESTRICTED);
        app.setRoles(appRoles);
        applicationRepository.save(app);

        return accessRequestRepository.save(new AccessRequest(requester, app, admin));
    }

    @Test
    void approvingAnAdminOnlyAppNeverMakesTheRequesterAnAdministrator() {
        AccessRequest request = requestFor(Set.of(roleRepository.findByName(RoleService.ADMIN_ROLE).orElseThrow()));

        assertThatThrownBy(() -> accessRequestService.approve(request.getId(), "reviewer@example.com", null))
                .isInstanceOf(BusinessRuleViolationException.class)
                .hasMessageContaining("restricted to administrators");

        User requester = userRepository.findByIdWithRoles(request.getUser().getId()).orElseThrow();
        assertThat(requester.getRoles()).extracting(Role::getName).doesNotContain(RoleService.ADMIN_ROLE);
    }

    @Test
    void anAdminOnlyAppCannotBeRequestedOrSeenByOrdinaryUsers() {
        AccessRequest existing = requestFor(Set.of(roleRepository.findByName(RoleService.ADMIN_ROLE).orElseThrow()));
        UUID appId = existing.getApplication().getId();
        accessRequestRepository.delete(existing);

        assertThatThrownBy(() -> accessRequestService.submitRequest(
                        existing.getUser().getEmail(),
                        new SubmitAccessRequestRequest(appId, existing.getReviewer().getId(), "please")))
                .isInstanceOf(BusinessRuleViolationException.class)
                .hasMessageContaining("administrators only");

        var auth = new UsernamePasswordAuthenticationToken(
                existing.getUser().getEmail(), null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
        assertThat(applicationService.getUserApplications(auth))
                .extracting(UserApplicationResponse::id)
                .doesNotContain(appId);
    }

    @Test
    void approvingGrantsTheAppsOtherRolesButNotAdmin() {
        Role support = roleRepository.save(new Role("ROLE_SUPPORT_TEST", "Support"));
        AccessRequest request = requestFor(Set.of(
                support, roleRepository.findByName(RoleService.ADMIN_ROLE).orElseThrow()));

        accessRequestService.approve(request.getId(), "reviewer@example.com", "ok");

        User requester = userRepository.findByIdWithRoles(request.getUser().getId()).orElseThrow();
        assertThat(requester.getRoles()).extracting(Role::getName)
                .contains("ROLE_SUPPORT_TEST")
                .doesNotContain(RoleService.ADMIN_ROLE);
    }
}
