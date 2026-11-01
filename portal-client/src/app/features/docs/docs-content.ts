/**
 * Every page under /docs, as data. One guide per task an operator or developer actually has, so
 * each can be linked to on its own ("send them /docs/users") instead of scrolling one long page.
 *
 * Text supports two inline marks: `code` and **bold**. Code blocks may contain {{ORIGIN}}, which
 * the page replaces with this server's own address so snippets are copy-paste ready.
 */

export type DocBlock =
  | { kind: 'p'; text: string }
  | { kind: 'h'; text: string }
  | { kind: 'steps'; items: { title: string; body: string }[] }
  | { kind: 'list'; items: string[] }
  | { kind: 'code'; label: string; code: string }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'note'; tone: 'tip' | 'warn'; text: string }
  | { kind: 'links'; items: { guide: string; text: string }[] }
  | { kind: 'stacks' }
  | { kind: 'endpoints' };

export interface DocGuide {
  id: string;
  group: string;
  title: string;
  summary: string;
  blocks: DocBlock[];
}

export const DOC_GROUPS = ['Start here', 'Administer', 'Integrate', 'Reference'];

export const DOC_GUIDES: DocGuide[] = [
  // ---------------------------------------------------------------------------------------------
  {
    id: 'getting-started',
    group: 'Start here',
    title: 'Getting started',
    summary: 'Install Portal SSO and finish first-time setup: your organization, your administrator and your database.',
    blocks: [
      { kind: 'p', text: 'Setup takes about five minutes. You need **Java 25+** or **Docker**, and nothing else: Portal SSO starts on a built-in database and you can move to PostgreSQL or MySQL during setup or at any time later.' },
      { kind: 'h', text: '1. Start the server' },
      {
        kind: 'code',
        label: 'Java (single JAR)',
        code: `curl -LO https://github.com/tanmaysinghx/portal-sso/releases/latest/download/portal-sso.jar
java -jar portal-sso.jar --httpPort=8080`,
      },
      {
        kind: 'code',
        label: 'Docker',
        code: `docker run -d --name portal-sso -p 8080:8080 \\
  -v portal-sso-data:/root/.portal-sso \\
  tanmaysinghx/portal-sso:latest`,
      },
      { kind: 'p', text: 'Everything the server keeps — database, keys, the setup key and the configuration file — lives in its home folder: `~/.portal-sso` by default, or `--portalHome=/var/lib/portal-sso`. Back this folder up.' },
      { kind: 'h', text: '2. Find the setup key' },
      { kind: 'p', text: 'On first start the server prints a one-time **setup key** in its log, inside a box of asterisks, and also writes it to a file:' },
      {
        kind: 'code',
        label: 'Read the key',
        code: `# Java
cat ~/.portal-sso/secrets/initialAdminPassword

# Docker
docker exec portal-sso cat /root/.portal-sso/secrets/initialAdminPassword`,
      },
      { kind: 'note', tone: 'tip', text: 'The key proves you control the server: setup is the only page that can create an administrator without signing in. It works once. If the server restarts before setup is finished, a new key replaces it — read the file again.' },
      { kind: 'h', text: '3. Run the setup wizard' },
      { kind: 'p', text: 'Open `http://your-server:8080` in a browser. A fresh server sends you to `/setup`:' },
      {
        kind: 'steps',
        items: [
          { title: 'Organization', body: 'Company name, logo URL and help link. Users see these on the sign-in page and in every email. All optional, and editable later under **Settings**. The logo must be a public `https://` address because email clients load it themselves.' },
          { title: 'Administrator', body: 'Paste the setup key, then your email, name and a password of at least 12 characters. When this step completes you are signed in, the key is spent and the setup page closes for good.' },
          { title: 'Database', body: 'Keep **Built-in (H2)** for a trial or a small team, or choose **PostgreSQL** or **MySQL / MariaDB**, enter the connection, click **Test connection**, then **Switch database & restart**. Everything created so far is copied across. You sign in once more after the restart. See [Choosing a database](database).' },
          { title: 'Get started', body: 'Shortcuts to the three things most teams do next: connect an app, set up email, add people.' },
        ],
      },
      { kind: 'h', text: '4. Set the public address' },
      { kind: 'p', text: 'Before connecting any app, tell Portal SSO the exact URL users reach it on. It becomes the **issuer** in every token, and apps reject tokens whose issuer does not match.' },
      {
        kind: 'code',
        label: '~/.portal-sso/portal.properties',
        code: `spring.security.oauth2.authorizationserver.issuer=https://sso.example.com`,
      },
      { kind: 'p', text: 'Or set the `ISSUER_URL` environment variable. Restart after changing it. Behind nginx, a load balancer or Cloudflare, also set `FORWARD_HEADERS_STRATEGY=FRAMEWORK` so sign-in records show real client addresses.' },
      { kind: 'note', tone: 'tip', text: 'Prefer to skip the wizard entirely? Everything it asks for can go in a file instead — see [Configuration file](configuration-file).' },
      { kind: 'h', text: 'Next steps' },
      {
        kind: 'links',
        items: [
          { guide: 'add-application', text: 'Connect your first application' },
          { guide: 'email', text: 'Set up email (password resets, alerts)' },
          { guide: 'users', text: 'Add users' },
          { guide: 'roles', text: 'Control who sees which app' },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------------------------
  {
    id: 'configuration-file',
    group: 'Start here',
    title: 'Configuration file',
    summary: 'Set up and run Portal SSO from portal.properties instead of (or as well as) the browser.',
    blocks: [
      { kind: 'p', text: 'On first start the server writes `portal.properties` into its home folder with **every option listed and commented out**. It changes nothing until you edit it. Uncomment what you need and restart.' },
      {
        kind: 'table',
        head: ['How you run it', 'File location'],
        rows: [
          ['`java -jar portal-sso.jar`', '`~/.portal-sso/portal.properties`'],
          ['`--portalHome=/var/lib/portal-sso`', '`/var/lib/portal-sso/portal.properties`'],
          ['`--config=/etc/portal-sso/portal.properties`', 'Exactly that file. It must exist, or the server refuses to start.'],
          ['`PORTAL_CONFIG=/etc/portal-sso/portal.properties`', 'Same as `--config`, for systemd units and containers.'],
          ['Docker', '`/root/.portal-sso/portal.properties` inside the volume'],
        ],
      },
      { kind: 'h', text: 'A complete example' },
      {
        kind: 'code',
        label: 'portal.properties',
        code: `# Public address — the OIDC issuer in every token
spring.security.oauth2.authorizationserver.issuer=https://sso.example.com

# Database (leave out for the built-in H2)
spring.datasource.url=jdbc:postgresql://db.internal:5432/portalsso
spring.datasource.username=portal
spring.datasource.password=change-me

# Organization — shown on the sign-in page and in emails
app.organization.name=Acme Corp
app.organization.logo-url=https://www.example.com/logo.png
app.organization.support-url=https://support.example.com

# First administrator — skips the setup wizard. Remove once signed in.
app.bootstrap.admin-email=admin@example.com
app.bootstrap.admin-password=Choose-A-Long-Passphrase-1

# Public sign-up (off by default)
app.registration.enabled=false`,
      },
      { kind: 'h', text: 'How it combines with everything else' },
      {
        kind: 'table',
        head: ['Source', 'Wins over'],
        rows: [
          ['Command-line arguments (`--server.port=9090`)', 'everything'],
          ['Environment variables (`SPRING_DATASOURCE_URL`, `APP_ORGANIZATION_NAME`, …)', 'this file and the defaults'],
          ['`portal.properties`', 'the built-in defaults'],
        ],
      },
      { kind: 'p', text: 'Any property name works as an environment variable in upper case with `_` for `.` and `-`: `app.organization.name` → `APP_ORGANIZATION_NAME`. The short `DB_URL` variable only replaces the built-in default, so a `spring.datasource.url` in the file wins over it.' },
      { kind: 'h', text: 'Rules worth knowing' },
      {
        kind: 'list',
        items: [
          '**Organization values fill gaps only.** They apply where nothing has been set in the console, so an edit under Settings is never undone by a restart.',
          '**The bootstrap administrator** is created only when no enabled administrator exists, never overwrites an existing password, and needs 12+ characters. With it set, no setup key is issued.',
          '**The console edits this file too** (the setup wizard\'s database step, Settings → Database), but only the keys it owns. Your other lines and comments are kept.',
          '**It can hold your database password.** Make it readable by the service account only: `chmod 600 portal.properties`.',
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------------------------
  {
    id: 'database',
    group: 'Start here',
    title: 'Choosing a database',
    summary: 'Built-in H2, PostgreSQL or MySQL — what each is for and how to switch with no data loss.',
    blocks: [
      {
        kind: 'table',
        head: ['Database', 'Use it for', 'Setup needed'],
        rows: [
          ['**Built-in (H2)**', 'Trials, evaluations, small teams on one server', 'None. Stored in `<home>/data`.'],
          ['**PostgreSQL 15+**', 'Production (recommended)', 'An empty database and a user that owns it'],
          ['**MySQL 8.0+ / MariaDB**', 'Production, where MySQL is the house standard', 'An empty `utf8mb4` database and a user with full rights on it'],
        ],
      },
      { kind: 'p', text: 'Portal SSO creates and upgrades its own tables on every start, so the target only needs to exist and be empty.' },
      {
        kind: 'code',
        label: 'Create the database',
        code: `-- PostgreSQL
CREATE USER portal WITH PASSWORD 'change-me';
CREATE DATABASE portalsso OWNER portal;

-- MySQL / MariaDB
CREATE DATABASE portalsso CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'portal'@'%' IDENTIFIED BY 'change-me';
GRANT ALL PRIVILEGES ON portalsso.* TO 'portal'@'%';`,
      },
      { kind: 'h', text: 'Switch from the console (copies your data)' },
      {
        kind: 'steps',
        items: [
          { title: 'Open the database step', body: 'During first-time setup it is step 3. Afterwards: **Settings → Database**.' },
          { title: 'Enter the connection', body: 'Choose PostgreSQL or MySQL, then host, port, database name, username and password.' },
          { title: 'Test connection', body: 'Must succeed before you can switch. A failure shows the database driver\'s own message — usually a firewall, a wrong password, or a database that does not exist yet.' },
          { title: 'Switch & restart', body: 'Portal SSO creates its tables on the target, copies users, roles, clients, applications, signing keys, email settings and audit history, saves the connection to `portal.properties`, and restarts onto it.' },
          { title: 'Sign in again', body: 'Sessions are stored in the database, so everyone (including you) signs in once more after the switch.' },
        ],
      },
      { kind: 'h', text: 'Or configure it in a file (fresh start, no copy)' },
      {
        kind: 'code',
        label: 'portal.properties',
        code: `spring.datasource.url=jdbc:postgresql://db.internal:5432/portalsso
# MySQL: jdbc:mysql://db.internal:3306/portalsso  (MySQL settings are applied automatically)
spring.datasource.username=portal
spring.datasource.password=change-me`,
      },
      { kind: 'note', tone: 'warn', text: 'Pointing the file at a new database starts that server empty — nothing is copied. Use the console switch when you already have users or apps you want to keep.' },
    ],
  },

  // ---------------------------------------------------------------------------------------------
  {
    id: 'add-application',
    group: 'Administer',
    title: 'Adding an application',
    summary: 'Put an app on the launchpad and give it single sign-on in one step.',
    blocks: [
      { kind: 'p', text: 'This is the usual way to connect an app. One form creates the launchpad entry, the OAuth client it signs in with, and (if needed) an API key — all together, or nothing at all if something fails.' },
      {
        kind: 'table',
        head: ['Term', 'What it is'],
        rows: [
          ['**Application**', 'The tile on users\' launchpad: name, launch URL, icon, category, and who may see it.'],
          ['**OAuth client**', 'The sign-in registration the app uses: client ID, redirect URIs, scopes, optional secret. See [OAuth clients](oauth-clients).'],
          ['**API key**', 'Optional. Lets the app\'s backend check passwords and register users for its own login screen.'],
        ],
      },
      { kind: 'h', text: 'Steps' },
      {
        kind: 'steps',
        items: [
          { title: 'Applications → New application', body: 'Enter the **Application name** and **Launch URL** (where users go when they click the tile). Description, category and icon URL are optional.' },
          { title: 'Choose how it signs in', body: '**New client (Recommended)** creates a client for you: the client ID is made from the app name, the redirect URI defaults to the launch URL, scopes are `openid profile email`. Tick **Confidential client** only if the app has a server-side backend — that issues a client secret. **Link a registered client** reuses one from the OAuth Clients page. **Launchpad bookmark only** adds a tile with no sign-in.' },
          { title: 'Sign-in URL (recommended)', body: 'The address in the app that starts "Sign in with Portal SSO". With it, clicking the app on **My Apps** signs the user straight in instead of showing the app\'s login page. See **Open from My Apps** below.' },
          { title: 'Decide who sees it', body: '**All Users (Public)** — every signed-in user. **Restricted to Roles** — pick one or more roles; only users holding one see the app. See [Roles & access](roles).' },
          { title: 'Optional: external login API', body: 'Tick **Allow external app login and registration API** only if the app has its own login form and backend. Most apps redirect to Portal SSO instead and do not need this.' },
          { title: 'Create application', body: 'The **Keys & Setup** window opens with everything the app needs.' },
        ],
      },
      { kind: 'h', text: 'Keys & Setup: what to copy into the app' },
      {
        kind: 'table',
        head: ['Item', 'Notes'],
        rows: [
          ['Issuer URL / discovery URL', 'Point your OIDC library here. Must match your public address.'],
          ['Client ID', 'Public. Safe in browser code.'],
          ['**Client secret**', '**Shown once.** Server-side only. Lost it? **Regenerate secret** — the old one stops working immediately.'],
          ['**API key**', '**Shown once**, if enabled. Backend only, sent as `X-Portal-App-Key`. Rotate from the same window.'],
          ['Redirect URIs, scopes', 'The values actually registered.'],
          ['`.env` block', 'Ready-made environment variables for the app.'],
          ['Agent guide (.md)', 'A `PORTAL_SSO.md` brief for Claude Code, Cursor or Copilot. Contains no secrets.'],
        ],
      },
      { kind: 'note', tone: 'warn', text: 'While a secret is on screen the window will not close by accident — you must click the confirmation button. Copy it into your app\'s secret store first.' },
      { kind: 'p', text: 'Reopen the window any time from **Keys & Setup** on the app\'s row. Deleting an application never deletes its OAuth client (and vice versa).' },
      { kind: 'h', text: 'Open from My Apps — already signed in' },
      { kind: 'p', text: 'Without a **Sign-in URL**, clicking an app on **My Apps** opens its launch URL, and the user may meet the app\'s own login page. With one, Portal SSO opens `<sign-in URL>?iss={{ORIGIN}}&target_link_uri=<launch URL>` (OIDC third-party initiated login). The app starts its sign-in, finds the user already signed in to Portal SSO, and they land in the app with no login form. The tile then reads **Open & sign in**.' },
      {
        kind: 'table',
        head: ['App built with', 'Sign-in URL to enter'],
        rows: [
          ['Spring Boot (`oauth2Login`)', '`https://app.example.com/oauth2/authorization/portal-sso`'],
          ['Portal SSO JS SDK', 'Any page that calls `await sso.handleInitiatedLogin(redirectUri)`'],
          ['oauth2-proxy (legacy apps)', '`https://app.example.com/oauth2/start`'],
          ['Grafana', '`https://grafana.example.com/login/generic_oauth`'],
          ['Anything else', 'The library\'s "start login" route'],
        ],
      },
      { kind: 'note', tone: 'tip', text: 'The Agent guide (.md) from Keys & Setup tells a coding agent to build this route, so apps you integrate with an agent get it for free.' },
      { kind: 'links', items: [{ guide: 'integrate', text: 'Now wire up the app code' }] },
    ],
  },

  // ---------------------------------------------------------------------------------------------
  {
    id: 'oauth-clients',
    group: 'Administer',
    title: 'OAuth clients',
    summary: 'Register and manage sign-in clients directly: APIs, mobile apps, or anything not on the launchpad.',
    blocks: [
      { kind: 'p', text: 'Creating an [application](add-application) makes its client for you. Use the **OAuth Clients** page directly when the thing signing in should not appear on the launchpad — a mobile app, a CLI, a service — or to edit redirect URIs and scopes later.' },
      { kind: 'h', text: 'Public or confidential?' },
      {
        kind: 'table',
        head: ['App type', 'Client type', 'Why'],
        rows: [
          ['Single-page app (React, Angular, Vue)', 'Public', 'Code runs in the browser, so it cannot keep a secret.'],
          ['Mobile or desktop app', 'Public', 'Same: anything shipped to a device can be extracted.'],
          ['Server-rendered web app (Spring, Express, Django, Rails)', 'Confidential', 'Has a backend that can hold a secret.'],
          ['Backend-for-frontend', 'Confidential', 'The secret stays on the server.'],
        ],
      },
      { kind: 'p', text: '**PKCE (S256) is required for every client**, public and confidential. A confidential client sends PKCE *and* its secret.' },
      { kind: 'h', text: 'Register a client' },
      {
        kind: 'steps',
        items: [
          { title: 'OAuth Clients → New client', body: 'Opens **Register an application**.' },
          { title: 'Display name', body: 'Shown to users on the sign-in and consent screens.' },
          { title: 'Client ID', body: 'The public identifier your app sends. Letters, numbers, `.`, `_` and `-` only. Cannot be changed later.' },
          { title: 'Redirect URIs', body: 'One per line. Where Portal SSO may send users back after sign-in, e.g. `https://app.example.com/callback`. Matched **exactly**.' },
          { title: 'Scopes', body: '`openid` is always on. Add `profile` for name claims and `email` for the email claim.' },
          { title: 'Confidential client', body: 'Tick for server-side apps and choose how the secret is sent: `client_secret_basic` (HTTP Basic header — the default in most libraries) or `client_secret_post` (form body).' },
          { title: 'Create client', body: 'The client secret is displayed **only once**, with an `.env` block. Copy it now.' },
        ],
      },
      { kind: 'h', text: 'Redirect URIs must match exactly' },
      {
        kind: 'table',
        head: ['Registered', 'App sends', 'Result'],
        rows: [
          ['`https://app.example.com/callback`', '`https://app.example.com/callback`', 'OK'],
          ['`https://app.example.com/callback`', '`https://app.example.com/callback/`', 'Rejected (trailing slash)'],
          ['`https://app.example.com/callback`', '`http://app.example.com/callback`', 'Rejected (scheme)'],
          ['`http://localhost:3000/callback`', '`http://localhost:5173/callback`', 'Rejected (port) — register each dev port'],
        ],
      },
      { kind: 'h', text: 'Managing clients' },
      {
        kind: 'list',
        items: [
          '**Edit client** changes the display name, redirect URIs and scopes. The client ID is permanent.',
          'Untick **Enabled** in **Edit client** to stop new sign-ins while keeping the registration.',
          '**Delete client** removes it and revokes its tokens. An application linked to it stays, showing that its client is missing — edit the app to link another.',
          'Lost a secret? Open the linked application\'s **Keys & Setup → Regenerate secret**.',
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------------------------------
  {
    id: 'users',
    group: 'Administer',
    title: 'Users',
    summary: 'Create accounts one by one or in bulk, and handle lockouts, 2FA resets and access.',
    blocks: [
      { kind: 'p', text: 'A Portal SSO account is global: one account signs in to every application behind this server. What each person can open is controlled by [roles](roles).' },
      { kind: 'h', text: 'Create a user' },
      {
        kind: 'steps',
        items: [
          { title: 'Users → Create user', body: 'Opens **Create New User**.' },
          { title: 'Details', body: '**Email Address** (their sign-in name), first and last name.' },
          { title: 'Initial Password', body: 'Must meet the password policy — by default 10+ characters with upper case, lower case and a digit. Send it to them securely; they can change it under **My Account**.' },
          { title: 'Administrator?', body: 'Tick **Grant Administrator Role** only for people who should manage this whole console.' },
          { title: 'Add roles', body: 'After creating, use **Edit roles** on their row to give them the roles that unlock their apps.' },
        ],
      },
      { kind: 'h', text: 'Import many users (CSV)' },
      { kind: 'p', text: '**Users → Import users**, then upload a file or paste rows. The header row is optional; roles are separated by semicolons.' },
      {
        kind: 'code',
        label: 'users.csv',
        code: `email,firstName,lastName,password,roles,enabled
jane@example.com,Jane,Doe,Temp-Pass-2026,ROLE_USER;ROLE_SUPPORT,true
raj@example.com,Raj,Patel,,ROLE_USER,true`,
      },
      { kind: 'p', text: 'Choose a **Default Platform Role** for rows without one. Leave **Default Password** empty to auto-generate passwords for rows that have none. The result lists how many rows were imported and skipped (for example, addresses that already exist).' },
      { kind: 'h', text: 'Everyday tasks' },
      {
        kind: 'table',
        head: ['Task', 'Where'],
        rows: [
          ['Disable / re-enable an account', 'The **Access** toggle on the user\'s row. A disabled user cannot sign in anywhere; their open sessions end and the refresh tokens their apps hold are revoked at once.'],
          ['Unlock after too many failed sign-ins', '**Locked** badge → clear the lockout. Accounts lock after 5 failures by default.'],
          ['Lost authenticator / reset 2FA', 'The **2FA (TOTP)** column → reset. They enrol again at next sign-in.'],
          ['See or end someone\'s sessions', '**View active sessions** on their row.'],
          ['Change their roles', '**Edit roles** on their row.'],
        ],
      },
      { kind: 'note', tone: 'tip', text: 'Safety rails: you cannot disable your own account or remove your own administrator role, and the last active administrator can never be disabled.' },
      { kind: 'p', text: 'Want people to create their own accounts instead? See [Self-registration](registration).' },
    ],
  },

  // ---------------------------------------------------------------------------------------------
  {
    id: 'roles',
    group: 'Administer',
    title: 'Roles & access',
    summary: 'Use roles to decide who sees which application, and pass them to your apps in tokens.',
    blocks: [
      { kind: 'p', text: 'Roles do two jobs: they decide which **restricted applications** a user sees on the launchpad, and they are sent to every app in the `roles` claim so the app can make its own permission decisions.' },
      { kind: 'h', text: 'Built-in roles' },
      {
        kind: 'table',
        head: ['Role', 'Meaning', 'Can delete?'],
        rows: [
          ['`ROLE_ADMIN`', 'Full access to this admin console.', 'No (platform role)'],
          ['`ROLE_USER`', 'An ordinary signed-in user. Everyone gets it.', 'No (platform role)'],
        ],
      },
      { kind: 'h', text: 'Restrict an app to a team' },
      {
        kind: 'steps',
        items: [
          { title: 'Roles → New role', body: 'Name it after the group, e.g. `SUPPORT` (stored as `ROLE_SUPPORT`), and add a description.' },
          { title: 'Assign it to people', body: '**Users → Edit roles** on each person, or include it in a CSV import.' },
          { title: 'Restrict the application', body: 'Edit the app, choose **Restricted to Roles**, and tick `ROLE_SUPPORT`. Everyone else no longer sees the tile.' },
        ],
      },
      { kind: 'note', tone: 'warn', text: 'Restricting an app hides it from the launchpad. Your app should still check the `roles` claim itself before granting access to anything sensitive.' },
      { kind: 'h', text: 'Roles in tokens' },
      {
        kind: 'code',
        label: 'ID / access token claims',
        code: `{
  "sub": "jane@example.com",
  "email": "jane@example.com",
  "name": "Jane Doe",
  "roles": ["ROLE_USER", "ROLE_SUPPORT"]
}`,
      },
      { kind: 'p', text: 'A role that an application names directly cannot be deleted until it is removed from that app — otherwise its users would lose access silently.' },
      { kind: 'links', items: [{ guide: 'access-requests', text: 'Let users ask for access to restricted apps' }] },
    ],
  },

  // ---------------------------------------------------------------------------------------------
  {
    id: 'access-requests',
    group: 'Administer',
    title: 'Access requests',
    summary: 'Let users ask for a restricted app, and approve it in one click.',
    blocks: [
      { kind: 'p', text: 'Users see restricted apps they do not have yet under **By request** on their **Applications** page. Instead of emailing an admin, they ask from there.' },
      {
        kind: 'steps',
        items: [
          { title: 'User: Request access', body: 'They pick an administrator under **Send request to** and add an optional reason. The request appears under **Pending requests**.' },
          { title: 'Admin: Access Requests', body: 'Shows every request with its status. Open one to see the reason.' },
          { title: 'Approve or deny', body: 'Add an optional note for the requester. **Approving gives the user the application\'s roles**, so they get that app — and anything else those roles unlock. `ROLE_ADMIN` is never granted this way.' },
        ],
      },
      { kind: 'note', tone: 'tip', text: 'Because approval grants roles, keep one role per app (or per team) if you want approvals to be narrow. Apps restricted to administrators only do not appear under **By request** and cannot be requested.' },
    ],
  },

  // ---------------------------------------------------------------------------------------------
  {
    id: 'email',
    group: 'Administer',
    title: 'Email (SMTP)',
    summary: 'Connect a mail relay so Portal SSO can send password resets, sign-in links and security alerts.',
    blocks: [
      { kind: 'p', text: 'Without email Portal SSO still works, but **Forgot password**, sign-in links and new-device alerts are unavailable. Any SMTP relay works: SendGrid, Amazon SES, Mailgun, Postmark, Microsoft 365, Google Workspace or your own.' },
      {
        kind: 'steps',
        items: [
          { title: 'Settings → Delivery (SMTP)', body: 'Turn on **Send email from this server**.' },
          { title: 'Connection Security', body: '**STARTTLS** on port 587 (recommended), **SSL / TLS** on port 465, or **None** only for a relay on a private network.' },
          { title: 'Relay Connection', body: '**SMTP Host**, **Port**, and the username and password your provider gave you (for SendGrid the username is literally `apikey`). The password is encrypted at rest and never shown again.' },
          { title: 'Sender Identity', body: '**From Address** must be one your relay is allowed to send as, e.g. `no-reply@example.com`. From name and Reply-To are optional.' },
          { title: 'Send a Test Message', body: 'Send to yourself. The status card then shows when the relay last proved it works.' },
        ],
      },
      { kind: 'h', text: 'What gets sent' },
      {
        kind: 'table',
        head: ['Email', 'When', 'Can switch off?'],
        rows: [
          ['Password reset', 'User clicks **Forgot password?**', 'No — the user asked for it'],
          ['Welcome', 'An account is created', 'Yes'],
          ['New-device sign-in alert', 'Sign-in from a browser not seen before', 'Yes'],
          ['Sign-in notice', 'Every sign-in', 'Yes (off by default)'],
          ['Sign-in link (passwordless)', 'User requests one, if enabled', 'Via the magic-link setting'],
        ],
      },
      { kind: 'p', text: 'Branding (product name, logo, accent colour, footer) and the per-email switches are under **Settings → Templates & notifications**, with a live preview.' },
    ],
  },

  // ---------------------------------------------------------------------------------------------
  {
    id: 'registration',
    group: 'Administer',
    title: 'Self-registration',
    summary: 'Let people create their own accounts, with or without your approval.',
    blocks: [
      { kind: 'p', text: 'Off by default, because a Portal SSO account opens every application behind this server that is not restricted to roles.' },
      {
        kind: 'steps',
        items: [
          { title: 'Settings → Registration', body: 'Turn on **Allow public sign-up**. A create-account link appears on the sign-in page (`/sign-up`).' },
          { title: 'Optional: require approval', body: 'Turn on **Require administrator approval**. New accounts stay disabled until you enable them with the **Access** toggle in **Users**.' },
        ],
      },
      { kind: 'p', text: 'New accounts get `ROLE_USER` only. Give extra roles from **Users**, or let them [request access](access-requests) to restricted apps.' },
      { kind: 'note', tone: 'warn', text: 'Email addresses are not verified yet. Turn on approval if you need to be sure someone owns the address they signed up with.' },
    ],
  },

  // ---------------------------------------------------------------------------------------------
  {
    id: 'integrate',
    group: 'Integrate',
    title: 'Integrate your app (OIDC)',
    summary: 'Copy-paste sign-in setup for React, Angular, Spring Boot, Node.js, Python, Go and legacy apps.',
    blocks: [
      { kind: 'p', text: 'Portal SSO is a standard OpenID Connect provider, so any certified OIDC library works. You need three values from **Keys & Setup**: the issuer URL, the client ID and (for confidential clients) the client secret.' },
      {
        kind: 'table',
        head: ['Setting', 'Value'],
        rows: [
          ['Issuer / authority', '`{{ORIGIN}}`'],
          ['Discovery', '`{{ORIGIN}}/.well-known/openid-configuration`'],
          ['Flow', 'Authorization Code with PKCE (S256) — required'],
          ['Scopes', '`openid profile email`'],
        ],
      },
      { kind: 'stacks' },
      { kind: 'h', text: 'Claims you receive' },
      {
        kind: 'table',
        head: ['Claim', 'Scope', 'Example'],
        rows: [
          ['`sub`', '`openid`', '`jane@example.com`'],
          ['`email`', '`email`', '`jane@example.com`'],
          ['`given_name`, `family_name`, `name`', '`profile`', '`Jane`, `Doe`, `Jane Doe`'],
          ['`roles`', 'always', '`["ROLE_USER", "ROLE_SUPPORT"]`'],
        ],
      },
      { kind: 'h', text: 'Sign out' },
      { kind: 'p', text: 'Clear your app\'s session, then send the browser to `{{ORIGIN}}/connect/logout` to end the Portal SSO session too.' },
      { kind: 'note', tone: 'tip', text: 'Using a coding agent? Download the **Agent guide (.md)** from the app\'s Keys & Setup window and give it to the agent — it has this server\'s real values and no secrets.' },
    ],
  },

  // ---------------------------------------------------------------------------------------------
  {
    id: 'api-reference',
    group: 'Reference',
    title: 'API reference',
    summary: 'The OAuth 2.1 / OpenID Connect endpoints this server exposes.',
    blocks: [
      { kind: 'endpoints' },
      { kind: 'p', text: 'All admin endpoints live under `/api/admin/**`, require an administrator session and a CSRF token, and are what this console itself calls. Error responses carry a `code` such as `PRTL-3001` and a human-readable `message`.' },
    ],
  },

  // ---------------------------------------------------------------------------------------------
  {
    id: 'troubleshooting',
    group: 'Reference',
    title: 'Troubleshooting',
    summary: 'The common problems, what causes them, and the fix.',
    blocks: [
      { kind: 'h', text: 'Setup' },
      {
        kind: 'table',
        head: ['Symptom', 'Fix'],
        rows: [
          ['"The setup key is incorrect"', 'The server restarted and issued a new key. Read `secrets/initialAdminPassword` again.'],
          ['"Setup is locked on this server"', 'Key generation is off. Set `app.bootstrap.admin-email` and `app.bootstrap.admin-password` (or `app.bootstrap.auto-generate=true`) and restart.'],
          ['Locked out — every administrator disabled', 'Set `app.bootstrap.admin-email` to an existing account and restart: it is re-enabled and made admin (its password is not changed).'],
          ['Test connection fails', 'Check the database exists, the host is reachable from this server (firewall), and the user\'s password.'],
        ],
      },
      { kind: 'h', text: 'Signing in to an app' },
      {
        kind: 'table',
        head: ['Symptom', 'Cause', 'Fix'],
        rows: [
          ['`redirect_uri` error', 'The app sent a URI that is not registered exactly.', 'Compare with **Keys & Setup → Redirect URIs**; edit on **OAuth Clients**.'],
          ['"invalid issuer" in the app', 'The public address does not match what the app uses.', 'Set `ISSUER_URL` to the public `https://` address and restart.'],
          ['`invalid_request` about `code_challenge`', 'The app is not sending PKCE.', 'Enable PKCE (S256) in the app\'s OIDC library.'],
          ['`invalid_client`', 'Wrong secret, or secret sent the wrong way.', 'Regenerate the secret; check `client_secret_basic` vs `_post`.'],
          ['User signs in but does not see the app', 'The app is restricted to roles they lack.', 'Give them the role, or approve their access request.'],
          ['"Account locked"', 'Too many failed passwords.', '**Users** → clear the lockout.'],
        ],
      },
    ],
  },
];
