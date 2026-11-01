package com.tanmaysinghx.portalsso.config;

import com.tanmaysinghx.portalsso.bootstrap.AdminBootstrapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The operator's configuration file: {@code <portal home>/portal.properties} by default, or the file
 * named by {@code --config=<file>} / {@code PORTAL_CONFIG}.
 *
 * <p>Read before Spring starts (see {@code PortalSsoAuthServerApplication}), so anything Spring
 * accepts can go in it — database, issuer URL, bootstrap administrator, organization details.
 * Environment variables and command-line arguments still win over it.
 *
 * <p>Written by the console too (the database step of setup, and Settings → Database). Those writes
 * {@linkplain #update merge}: only the keys being changed are touched, and every other line,
 * comments included, is kept — this file is also the operator's to edit by hand.
 */
public final class PortalConfigFile {

    /** System property set from {@code --config=<file>}. */
    public static final String CONFIG_PROPERTY = "portal.config";
    public static final String CONFIG_ENV = "PORTAL_CONFIG";
    static final String DEFAULT_FILE_NAME = "portal.properties";

    private PortalConfigFile() {}

    public static Path resolve() {
        String explicit = System.getProperty(CONFIG_PROPERTY);
        if (explicit == null || explicit.isBlank()) {
            explicit = System.getenv(CONFIG_ENV);
        }
        if (explicit != null && !explicit.isBlank()) {
            return Path.of(explicit.trim()).toAbsolutePath().normalize();
        }
        return AdminBootstrapper.resolvePortalHome().resolve(DEFAULT_FILE_NAME);
    }

    /** Whether the operator named the file, rather than relying on the one in the portal home. */
    public static boolean isExplicit() {
        String explicit = System.getProperty(CONFIG_PROPERTY);
        if (explicit == null || explicit.isBlank()) {
            explicit = System.getenv(CONFIG_ENV);
        }
        return explicit != null && !explicit.isBlank();
    }

    /**
     * Writes the commented-out template if the default file does not exist yet, so an operator who
     * prefers files to the wizard finds every option in one place. Every line is a comment, so the
     * file changes nothing until someone edits it. Never touches a file the operator named.
     */
    public static void writeTemplateIfAbsent(Path file) {
        if (Files.exists(file)) {
            return;
        }
        try (var in = PortalConfigFile.class.getResourceAsStream("/portal.properties.template")) {
            if (in == null) {
                return;
            }
            Files.createDirectories(file.getParent());
            Files.write(file, in.readAllBytes(), StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE);
            restrictPermissions(file);
        } catch (IOException ignored) {
            // A read-only home is not a reason to refuse to start; the wizard still works.
        }
    }

    /** Reads the active (uncommented) entries. Good enough for a pre-Spring peek at one key. */
    public static Map<String, String> read(Path file) {
        Map<String, String> values = new LinkedHashMap<>();
        if (!Files.exists(file)) {
            return values;
        }
        try {
            for (String line : Files.readAllLines(file, StandardCharsets.UTF_8)) {
                String key = keyOf(line);
                if (key != null) {
                    values.put(key, line.substring(line.indexOf('=') + 1).trim());
                }
            }
        } catch (IOException ignored) {
            // Treated as empty; Spring will report an unreadable file itself.
        }
        return values;
    }

    /**
     * Sets or removes keys in place. A {@code null} value removes the key. Keys not already in the
     * file are appended under a dated comment; everything else in the file is left exactly as it was.
     */
    public static void update(Path file, Map<String, String> changes, String reason) throws IOException {
        List<String> lines = Files.exists(file)
                ? new ArrayList<>(Files.readAllLines(file, StandardCharsets.UTF_8))
                : new ArrayList<>();
        Map<String, String> pending = new LinkedHashMap<>(changes);

        List<String> result = new ArrayList<>(lines.size() + pending.size() + 2);
        for (String line : lines) {
            String key = keyOf(line);
            if (key != null && pending.containsKey(key)) {
                String value = pending.remove(key);
                if (value != null) {
                    result.add(key + "=" + escape(value));
                }
                // Removed keys are simply dropped.
            } else if (key != null && changes.containsKey(key)) {
                // A duplicate of a key already rewritten above; the first occurrence won.
            } else {
                result.add(line);
            }
        }

        List<String> appended = pending.entrySet().stream()
                .filter(e -> e.getValue() != null)
                .map(e -> e.getKey() + "=" + escape(e.getValue()))
                .toList();
        if (!appended.isEmpty()) {
            if (!result.isEmpty() && !result.getLast().isBlank()) {
                result.add("");
            }
            result.add("# " + reason);
            result.addAll(appended);
        }

        Files.createDirectories(file.toAbsolutePath().getParent());
        Files.write(file, result, StandardCharsets.UTF_8,
                StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING, StandardOpenOption.WRITE);
        restrictPermissions(file);
    }

    private static String keyOf(String line) {
        String trimmed = line.strip();
        if (trimmed.isEmpty() || trimmed.startsWith("#") || trimmed.startsWith("!")) {
            return null;
        }
        int eq = trimmed.indexOf('=');
        return eq <= 0 ? null : trimmed.substring(0, eq).strip();
    }

    /** Backslash is the properties escape character; a Windows path or password would lose them. */
    private static String escape(String value) {
        return value.replace("\\", "\\\\").replace("\n", "\\n").replace("\r", "\\r");
    }

    private static void restrictPermissions(Path file) {
        // It can hold the database password.
        try {
            Files.setPosixFilePermissions(file, PosixFilePermissions.fromString("rw-------"));
        } catch (UnsupportedOperationException | IOException ignored) {
            // Windows filesystem does not support POSIX permissions
        }
    }
}
