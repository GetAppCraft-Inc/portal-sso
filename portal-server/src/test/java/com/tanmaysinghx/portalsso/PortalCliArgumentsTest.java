package com.tanmaysinghx.portalsso;

import static org.assertj.core.api.Assertions.assertThat;

import com.tanmaysinghx.portalsso.config.PortalConfigFile;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class PortalCliArgumentsTest {

    @Test
    void normalizesJenkinsStyleHttpPort() {
        String[] args = new String[]{"--httpPort=9090"};
        String[] result = PortalSsoAuthServerApplication.normalizeArguments(args);
        assertThat(result).containsExactly("--server.port=9090");
    }

    @Test
    void normalizesJenkinsStyleHttpPortWithSpace() {
        String[] args = new String[]{"--httpPort", "9090"};
        String[] result = PortalSsoAuthServerApplication.normalizeArguments(args);
        assertThat(result).containsExactly("--server.port=9090");
    }

    @Test
    void normalizesJenkinsStyleHttpListenAddress() {
        String[] args = new String[]{"--httpListenAddress=127.0.0.1"};
        String[] result = PortalSsoAuthServerApplication.normalizeArguments(args);
        assertThat(result).containsExactly("--server.address=127.0.0.1");
    }

    @Test
    void normalizesPortalHomeAndPrefix() {
        String[] args = new String[]{"--portalHome=/var/lib/portal-sso", "--prefix=/sso"};
        String[] result = PortalSsoAuthServerApplication.normalizeArguments(args);
        assertThat(result).contains("--portal.home=/var/lib/portal-sso", "--server.servlet.context-path=/sso");
        assertThat(System.getProperty("PORTAL_HOME")).isEqualTo("/var/lib/portal-sso");
    }

    @Test
    void configNamesTheConfigurationFileAndIsNotPassedToSpring() {
        try {
            String[] result = PortalSsoAuthServerApplication.normalizeArguments(
                    new String[]{"--config=/etc/portal-sso/portal.properties", "--foo=bar"});
            assertThat(result).containsExactly("--foo=bar");
            assertThat(PortalConfigFile.isExplicit()).isTrue();
            assertThat(PortalConfigFile.resolve()).isEqualTo(Path.of("/etc/portal-sso/portal.properties").toAbsolutePath());
        } finally {
            System.clearProperty(PortalConfigFile.CONFIG_PROPERTY);
        }
    }

    @Test
    void preservesOtherSpringArguments() {
        String[] args = new String[]{"--spring.profiles.active=prod", "--foo=bar"};
        String[] result = PortalSsoAuthServerApplication.normalizeArguments(args);
        assertThat(result).containsExactly("--spring.profiles.active=prod", "--foo=bar");
    }
}
