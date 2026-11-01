import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ThemeService } from '../../core/services/theme.service';
import { DOC_GROUPS, DOC_GUIDES, DocGuide } from './docs-content';

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  summary: string;
  auth: 'Admin' | 'Session' | 'Public' | 'OAuth2';
}

/** A run of text with at most one inline mark. */
interface Segment {
  text: string;
  kind: 'text' | 'code' | 'bold' | 'link';
  guide?: string;
}

type Stack = 'react' | 'angular' | 'spring' | 'jsp' | 'nodejs' | 'python' | 'go';

const ORIGIN_TOKEN = /\{\{ORIGIN\}\}/g;
const INLINE = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([a-z0-9-]+)\)/g;

/** Public documentation, one page per guide at /docs/:guide. Content lives in docs-content.ts. */
@Component({
  selector: 'app-docs',
  imports: [RouterLink, NgTemplateOutlet],
  templateUrl: './docs.html',
})
export class Docs {
  readonly themeService = inject(ThemeService);
  private readonly route = inject(ActivatedRoute);
  readonly copied = signal<string | null>(null);

  /** Snippets show this server's own address, so they are right wherever the docs are read. */
  readonly origin = typeof window === 'undefined' ? 'https://sso.example.com' : window.location.origin;

  readonly groups = DOC_GROUPS.map((group) => ({
    group,
    guides: DOC_GUIDES.filter((g) => g.group === group),
  }));

  private readonly guideId = toSignal(this.route.paramMap.pipe(map((p) => p.get('guide'))), {
    initialValue: null,
  });

  readonly guide = computed<DocGuide>(
    () => DOC_GUIDES.find((g) => g.id === this.guideId()) ?? DOC_GUIDES[0],
  );

  readonly position = computed(() => DOC_GUIDES.indexOf(this.guide()));
  readonly previous = computed(() => DOC_GUIDES[this.position() - 1] ?? null);
  readonly next = computed(() => DOC_GUIDES[this.position() + 1] ?? null);

  readonly oidcEndpoints: Endpoint[] = [
    { method: 'GET', path: '/.well-known/openid-configuration', summary: 'Discovery document', auth: 'Public' },
    { method: 'GET', path: '/oauth2/authorize', summary: 'Authorization endpoint (PKCE required)', auth: 'Public' },
    { method: 'POST', path: '/oauth2/token', summary: 'Exchange code or refresh token', auth: 'OAuth2' },
    { method: 'GET', path: '/oauth2/jwks', summary: 'Public signing keys', auth: 'Public' },
    { method: 'GET', path: '/userinfo', summary: 'Claims for the current access token', auth: 'OAuth2' },
    { method: 'POST', path: '/oauth2/revoke', summary: 'Revoke a token', auth: 'OAuth2' },
    { method: 'GET', path: '/connect/logout', summary: 'End the OIDC session', auth: 'Public' },
  ];

  readonly activeStack = signal<Stack>('react');

  readonly stacks: { id: Stack; label: string; caption: string }[] = [
    { id: 'react', label: 'React / Next.js', caption: 'oidc-client-ts configuration' },
    { id: 'angular', label: 'Angular', caption: 'angular-auth-oidc-client setup' },
    { id: 'spring', label: 'Spring Boot', caption: 'application.yml + PKCE customizer' },
    { id: 'nodejs', label: 'Node.js', caption: 'openid-client Express handler' },
    { id: 'python', label: 'Python', caption: 'Authlib (FastAPI / Starlette)' },
    { id: 'go', label: 'Go', caption: 'golang.org/x/oauth2 config' },
    { id: 'jsp', label: 'Legacy JSP / JSF', caption: 'oauth2-proxy.cfg (reverse proxy, no code changes)' },
  ];

  readonly snippets: Record<Stack, string> = {
    react: `// React / Next.js with oidc-client-ts
import { UserManager } from 'oidc-client-ts';

export const userManager = new UserManager({
  authority: '{{ORIGIN}}',
  client_id: 'your-client-id',
  redirect_uri: 'http://localhost:3000/callback',
  response_type: 'code',
  scope: 'openid profile email',
  // PKCE (S256) is on by default in oidc-client-ts and required by Portal SSO.
});

export const signIn = () => userManager.signinRedirect();`,

    angular: `// Angular with angular-auth-oidc-client
import { provideAuth } from 'angular-auth-oidc-client';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAuth({
      config: {
        authority: '{{ORIGIN}}',
        redirectUrl: 'http://localhost:4200/callback',
        clientId: 'your-client-id',
        scope: 'openid profile email',
        responseType: 'code',
        usePkce: true,
      },
    }),
  ],
};`,

    spring: `# Spring Boot application.yml
spring:
  security:
    oauth2:
      client:
        registration:
          portal-sso:
            client-id: your-client-id
            client-secret: your-client-secret
            scope: openid,profile,email
            authorization-grant-type: authorization_code
            redirect-uri: "{baseUrl}/login/oauth2/code/{registrationId}"
        provider:
          portal-sso:
            issuer-uri: {{ORIGIN}}

// Portal SSO requires PKCE for confidential clients too. Turn it on explicitly:
@Bean
SecurityFilterChain security(HttpSecurity http, ClientRegistrationRepository registrations) throws Exception {
    var resolver = new DefaultOAuth2AuthorizationRequestResolver(registrations, "/oauth2/authorization");
    resolver.setAuthorizationRequestCustomizer(OAuth2AuthorizationRequestCustomizers.withPkce());
    http.oauth2Login(login -> login.authorizationEndpoint(a -> a.authorizationRequestResolver(resolver)));
    return http.build();
}`,

    jsp: `## Zero-code reverse proxy for legacy JSP / JSF (oauth2-proxy.cfg)
http_address = "0.0.0.0:4180"
upstreams = ["http://127.0.0.1:8080/"] # Legacy Tomcat / WildFly

provider = "oidc"
oidc_issuer_url = "{{ORIGIN}}"
client_id = "your-client-id"
client_secret = "your-client-secret"
redirect_url = "http://localhost:4180/oauth2/callback"
code_challenge_method = "S256"

# Injects identity headers into JSP requests:
pass_user_headers = true
set_xauthrequest = true
email_domains = ["*"]
cookie_secret = "32-byte-secret-key-goes-here-1234"`,

    nodejs: `// Node.js / Express with openid-client
const { Issuer, generators } = require('openid-client');

const issuer = await Issuer.discover('{{ORIGIN}}');
const client = new issuer.Client({
  client_id: 'your-client-id',
  client_secret: 'your-client-secret',
  redirect_uris: ['http://localhost:3000/callback'],
  response_types: ['code'],
});

// Per sign-in: keep the verifier in the session, send the challenge.
const codeVerifier = generators.codeVerifier();
const url = client.authorizationUrl({
  scope: 'openid profile email',
  code_challenge: generators.codeChallenge(codeVerifier),
  code_challenge_method: 'S256',
});`,

    python: `# Python (FastAPI / Starlette) with Authlib
from authlib.integrations.starlette_client import OAuth

oauth = OAuth()
oauth.register(
    name='portal_sso',
    server_metadata_url='{{ORIGIN}}/.well-known/openid-configuration',
    client_id='your-client-id',
    client_secret='your-client-secret',
    client_kwargs={'scope': 'openid profile email', 'code_challenge_method': 'S256'},
)`,

    go: `// Go with golang.org/x/oauth2
import "golang.org/x/oauth2"

var oauthConfig = &oauth2.Config{
    ClientID:     "your-client-id",
    ClientSecret: "your-client-secret",
    Scopes:       []string{"openid", "profile", "email"},
    Endpoint: oauth2.Endpoint{
        AuthURL:  "{{ORIGIN}}/oauth2/authorize",
        TokenURL: "{{ORIGIN}}/oauth2/token",
    },
    RedirectURL: "http://localhost:8081/callback",
}

// Per sign-in:
//   verifier := oauth2.GenerateVerifier()
//   url := oauthConfig.AuthCodeURL(state, oauth2.S256ChallengeOption(verifier))
//   token, err := oauthConfig.Exchange(ctx, code, oauth2.VerifierOption(verifier))`,
  };

  readonly activeSnippet = computed(() => this.withOrigin(this.snippets[this.activeStack()]));
  readonly activeCaption = computed(() => this.stacks.find((s) => s.id === this.activeStack())?.caption ?? '');

  withOrigin(text: string): string {
    return text.replace(ORIGIN_TOKEN, this.origin);
  }

  /** Splits `code`, **bold** and [text](guide) out of a line. Content is ours, so no HTML is ever built. */
  segments(text: string): Segment[] {
    const source = this.withOrigin(text);
    const out: Segment[] = [];
    let last = 0;
    for (const match of source.matchAll(INLINE)) {
      if (match.index > last) {
        out.push({ text: source.slice(last, match.index), kind: 'text' });
      }
      if (match[1] !== undefined) {
        out.push({ text: match[1], kind: 'code' });
      } else if (match[2] !== undefined) {
        out.push({ text: match[2], kind: 'bold' });
      } else {
        out.push({ text: match[3], kind: 'link', guide: match[4] });
      }
      last = match.index + match[0].length;
    }
    if (last < source.length) {
      out.push({ text: source.slice(last), kind: 'text' });
    }
    return out;
  }

  methodClass(method: Endpoint['method']): string {
    switch (method) {
      case 'GET': return 'bg-sky-50 text-sky-700 ring-sky-600/20';
      case 'POST': return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20';
      case 'PUT':
      case 'PATCH': return 'bg-amber-50 text-amber-700 ring-amber-600/20';
      default: return 'bg-red-50 text-red-700 ring-red-600/20';
    }
  }

  async copy(text: string, id: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.withOrigin(text));
      this.copied.set(id);
      setTimeout(() => this.copied.set(null), 1600);
    } catch {
      // Clipboard blocked (insecure origin or permissions); the text is still selectable.
    }
  }
}
