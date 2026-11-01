package com.tanmaysinghx.portalsso.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class PortalConfigFileTest {

    @TempDir
    Path dir;

    @Test
    void updateKeepsEverythingTheOperatorWroteAndChangesOnlyItsOwnKeys() throws IOException {
        Path file = dir.resolve("portal.properties");
        Files.writeString(file, """
                # my notes
                spring.security.oauth2.authorizationserver.issuer=https://sso.example.com
                spring.datasource.url=jdbc:h2:file:/old
                app.organization.name=Acme Corp
                # spring.datasource.username=commented-out
                """);

        Map<String, String> changes = new LinkedHashMap<>();
        changes.put("spring.datasource.url", "jdbc:postgresql://db:5432/portalsso");
        changes.put("spring.datasource.password", "p@ss\\word");
        changes.put("spring.profiles.include", null);
        PortalConfigFile.update(file, changes, "Database, set from the console");

        String content = Files.readString(file);
        assertThat(content)
                .contains("# my notes")
                .contains("issuer=https://sso.example.com")
                .contains("app.organization.name=Acme Corp")
                .contains("# spring.datasource.username=commented-out")
                .doesNotContain("jdbc:h2:file:/old")
                .doesNotContain("spring.profiles.include");

        Map<String, String> values = PortalConfigFile.read(file);
        assertThat(values.get("spring.datasource.url")).isEqualTo("jdbc:postgresql://db:5432/portalsso");
        // Escaped so java.util.Properties (and Spring) read the backslash back.
        assertThat(values.get("spring.datasource.password")).isEqualTo("p@ss\\\\word");
        var loaded = new java.util.Properties();
        try (var reader = Files.newBufferedReader(file)) {
            loaded.load(reader);
        }
        assertThat(loaded.getProperty("spring.datasource.password")).isEqualTo("p@ss\\word");
    }

    @Test
    void theTemplateIsWrittenOnceAndChangesNothingUntilEdited() throws IOException {
        Path file = dir.resolve("home").resolve("portal.properties");

        PortalConfigFile.writeTemplateIfAbsent(file);

        assertThat(file).exists();
        assertThat(PortalConfigFile.read(file)).as("every line is a comment").isEmpty();
        assertThat(Files.readString(file)).contains("# spring.datasource.url=jdbc:postgresql://");

        Files.writeString(file, "app.organization.name=Mine\n");
        PortalConfigFile.writeTemplateIfAbsent(file);
        assertThat(Files.readString(file)).isEqualTo("app.organization.name=Mine\n");
    }
}
