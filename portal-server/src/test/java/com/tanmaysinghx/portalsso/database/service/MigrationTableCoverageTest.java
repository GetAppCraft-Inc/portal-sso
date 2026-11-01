package com.tanmaysinghx.portalsso.database.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/** Every table Liquibase creates is either copied by the in-app migration or knowingly left out. */
class MigrationTableCoverageTest {

    private static final Pattern CREATE_TABLE =
            Pattern.compile("createTable:\\s*\\n\\s*tableName:\\s*(\\S+)");

    @Test
    void everyTableIsCopiedOrDeliberatelySkipped() throws IOException {
        Set<String> created = new HashSet<>();
        try (Stream<Path> files = Files.list(Path.of("src/main/resources/db/changelog/changes"))) {
            for (Path file : files.toList()) {
                Matcher m = CREATE_TABLE.matcher(Files.readString(file));
                while (m.find()) {
                    created.add(m.group(1).toLowerCase(Locale.ROOT));
                }
            }
        }
        assertThat(created).as("changelog parsed").contains("users", "roles");

        Set<String> accounted = new HashSet<>(DatabaseMigrationService.MIGRATION_TABLE_ORDER);
        accounted.addAll(DatabaseMigrationService.NOT_MIGRATED.keySet());

        assertThat(accounted)
                .as("add new tables to MIGRATION_TABLE_ORDER, or to NOT_MIGRATED with a reason")
                .containsAll(created);
    }
}
