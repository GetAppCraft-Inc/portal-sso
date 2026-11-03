import { Component, DestroyRef, ElementRef, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PasswordPolicy, passwordChecklist } from '../../core/services/account.service';
import { AuthService } from '../../core/services/auth.service';
import { BrandingService } from '../../core/services/branding.service';
import {
  DatabaseMigrationService,
  TestConnectionResponse,
} from '../../core/services/database-migration.service';
import { SetupService } from '../../core/services/setup.service';
import { ThemeService } from '../../core/services/theme.service';

type Step = 'license' | 'organization' | 'administrator' | 'database' | 'finish';
type DatabaseChoice = 'EMBEDDED' | 'POSTGRESQL' | 'MYSQL';

export const SETUP_STEPS: { id: Step; label: string }[] = [
  { id: 'license', label: 'License' },
  { id: 'organization', label: 'Organization' },
  { id: 'administrator', label: 'Administrator' },
  { id: 'database', label: 'Database' },
  { id: 'finish', label: 'Get started' },
];

/**
 * The first-run wizard: license → organization → administrator → database → get started.
 *
 * The database step comes after the administrator on purpose. Switching databases restarts the
 * server, and a restart issues a new setup key — so by the time the operator picks a database the
 * administrator already exists, and the switch is the ordinary admin migration (which copies the
 * new account across) rather than something the unauthenticated wizard can do.
 */
@Component({
  selector: 'app-setup',
  imports: [FormsModule, RouterLink],
  templateUrl: './setup.html',
})
export class Setup {
  private readonly setupService = inject(SetupService);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly authService = inject(AuthService);
  private readonly dbService = inject(DatabaseMigrationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly brandingService = inject(BrandingService);
  readonly themeService = inject(ThemeService);

  // The same light/dark pairs as the sign-in page, named once instead of repeated per field.
  readonly inputClass = computed(() =>
    'block w-full rounded-lg border px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 ' +
    (this.themeService.isDark()
      ? 'border-ink-700 bg-ink-950 text-white placeholder:text-ink-600 focus:border-brand-500 focus:ring-brand-500/20'
      : 'border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 focus:border-brand-500 focus:ring-brand-500/20'),
  );
  readonly labelClass = computed(
    () => 'mb-1.5 block text-xs font-medium ' + (this.themeService.isDark() ? 'text-ink-300' : 'text-slate-700'),
  );
  readonly hintClass = computed(
    () => 'mt-1.5 text-[11px] leading-5 ' + (this.themeService.isDark() ? 'text-ink-500' : 'text-slate-500'),
  );
  readonly mutedClass = computed(() => (this.themeService.isDark() ? 'text-ink-400' : 'text-slate-600'));
  readonly headingClass = computed(() => (this.themeService.isDark() ? 'text-white' : 'text-slate-950'));
  readonly cardClass = computed(
    () =>
      'rounded-xl border p-6 shadow-sm ' +
      (this.themeService.isDark() ? 'border-ink-800 bg-ink-900' : 'border-slate-200 bg-white'),
  );
  readonly secondaryButtonClass = computed(
    () =>
      'rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-60 ' +
      (this.themeService.isDark()
        ? 'border-ink-700 text-ink-200 hover:bg-ink-800'
        : 'border-slate-300 text-slate-700 hover:bg-slate-50'),
  );
  readonly primaryButtonClass =
    'flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-60';

  choiceClass(selected: boolean): string {
    const dark = this.themeService.isDark();
    const base = 'flex w-full flex-col items-start rounded-lg border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-brand-500/30 ';
    if (selected) {
      return base + (dark ? 'border-brand-500 bg-brand-500/10' : 'border-brand-500 bg-brand-50');
    }
    return base + (dark ? 'border-ink-700 hover:border-ink-600' : 'border-slate-200 hover:border-slate-300');
  }

  readonly steps = SETUP_STEPS;

  readonly nextSteps = [
    {
      n: 1,
      title: 'Connect your first app',
      body: 'Register an application and copy its client ID, secret and redirect URL into the app. Takes about two minutes.',
      link: '/applications',
      cta: 'Add an application',
    },
    {
      n: 2,
      title: 'Set up email',
      body: 'Needed for password resets, sign-in links and new-device alerts. Any SMTP relay works.',
      link: '/settings/email-delivery',
      cta: 'Configure email',
    },
    {
      n: 3,
      title: 'Add your people',
      body: 'Create accounts one by one or import a CSV, and decide who sees which apps.',
      link: '/users',
      cta: 'Manage users',
    },
  ];
  readonly step = signal<Step>('license');
  readonly licenseAccepted = signal(false);
  readonly licenseId = signal('');
  readonly licenseText = signal<string | null>(null);
  readonly licenseLoading = signal(false);
  readonly licenseFailed = signal(false);
  readonly stepIndex = computed(() => this.steps.findIndex((s) => s.id === this.step()));

  readonly loading = signal(true);
  readonly statusFailed = signal(false);
  readonly setupKeyIssued = signal(false);
  readonly setupKeyFile = signal<string | null>(null);
  readonly configFile = signal<string | null>(null);
  readonly passwordPolicy = signal<PasswordPolicy | null>(null);
  readonly isEmbeddedDatabase = signal(true);
  readonly databaseProduct = signal('');

  // Organization
  readonly organizationName = signal('');
  readonly logoUrl = signal('');
  readonly supportUrl = signal('');
  readonly logoBroken = signal(false);

  // Administrator
  readonly setupKey = signal('');
  readonly email = signal('');
  readonly firstName = signal('');
  readonly lastName = signal('');
  readonly password = signal('');
  readonly confirmPassword = signal('');
  readonly checklist = computed(() => {
    const policy = this.passwordPolicy();
    return policy ? passwordChecklist(policy, this.password()) : [];
  });

  // Database
  readonly dbChoice = signal<DatabaseChoice>('EMBEDDED');
  readonly dbHost = signal('localhost');
  readonly dbPort = signal(5432);
  readonly dbName = signal('portalsso');
  readonly dbUsername = signal('portal');
  readonly dbPassword = signal('');
  readonly testing = signal(false);
  readonly testResult = signal<TestConnectionResponse | null>(null);
  readonly switching = signal(false);
  readonly restartCountdown = signal<number | null>(null);

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  /** The lines an operator would add by hand instead, shown next to the form. */
  readonly configSnippet = computed(() => {
    if (this.dbChoice() === 'EMBEDDED') {
      return '';
    }
    const url =
      this.dbChoice() === 'MYSQL'
        ? `jdbc:mysql://${this.dbHost()}:${this.dbPort()}/${this.dbName()}`
        : `jdbc:postgresql://${this.dbHost()}:${this.dbPort()}/${this.dbName()}`;
    return [
      `spring.datasource.url=${url}`,
      `spring.datasource.username=${this.dbUsername()}`,
      'spring.datasource.password=********',
    ].join('\n');
  });

  constructor() {
    effect(() => {
      this.step();
      if (!this.loading()) {
        requestAnimationFrame(() => this.elementRef.nativeElement.querySelector<HTMLElement>('h1')?.focus());
      }
    });
    this.loadStatus();
  }

  loadStatus(): void {
    this.loading.set(true);
    this.statusFailed.set(false);
    this.error.set(null);
    this.setupService.getStatus().subscribe({
      next: (status) => {
        if (!status.setupRequired) {
          // Finished (perhaps in another tab, or from the config file): the sign-in page routes a
          // signed-in administrator onward.
          this.router.navigateByUrl('/sign-in');
          return;
        }
        this.licenseId.set(status.licenseId);
        this.loadLicense();
        this.setupKeyIssued.set(status.setupKeyIssued);
        this.setupKeyFile.set(status.setupKeyFile ?? null);
        this.configFile.set(status.configFile ?? null);
        this.passwordPolicy.set(status.passwordPolicy);
        this.isEmbeddedDatabase.set(status.isEmbeddedDatabase);
        this.databaseProduct.set(status.databaseProduct);
        this.organizationName.set(status.organization?.name ?? '');
        this.logoUrl.set(status.organization?.logoUrl ?? '');
        this.supportUrl.set(status.organization?.supportUrl ?? '');
        this.loading.set(false);
      },
      error: () => {
        this.statusFailed.set(true);
        this.error.set('Could not reach the server. Check that Portal SSO is running, then try again.');
        this.loading.set(false);
      },
    });
  }

  loadLicense(): void {
    this.licenseLoading.set(true);
    this.licenseFailed.set(false);
    this.setupService.getLicenseText().subscribe({
      next: (text) => {
        this.licenseLoading.set(false);
        this.licenseText.set(text);
      },
      error: () => {
        this.licenseLoading.set(false);
        this.licenseFailed.set(true);
      },
    });
  }

  continueFromLicense(): void {
    if (!this.licenseAccepted() || !this.licenseText() || !this.licenseId()) return;
    this.goTo('organization');
  }

  // --- Organization ---------------------------------------------------------------------------

  continueFromOrganization(): void {
    this.error.set(null);
    const problem =
      this.urlProblem(this.logoUrl(), 'Logo URL') ?? this.urlProblem(this.supportUrl(), 'Support URL');
    if (problem) {
      this.error.set(problem);
      return;
    }
    this.step.set('administrator');
  }

  setLogoUrl(value: string): void {
    this.logoUrl.set(value);
    this.logoBroken.set(false);
  }

  // --- Administrator --------------------------------------------------------------------------

  createAdministrator(): void {
    if (this.submitting()) return;
    if (!this.licenseAccepted() || !this.licenseText() || !this.licenseId()) {
      this.goTo('license');
      this.error.set('Read and accept the license before creating the administrator.');
      return;
    }
    this.error.set(null);
    const email = this.email().trim();
    const setupKey = this.setupKey().trim();
    if (!setupKey) {
      this.error.set('Paste the setup key from the server first.');
      return;
    }
    if (!email || !this.password()) {
      this.error.set('Email and password are required.');
      return;
    }
    if (this.password() !== this.confirmPassword()) {
      this.error.set('Passwords do not match.');
      return;
    }
    const unmet = this.checklist().filter((rule) => !rule.met);
    if (unmet.length > 0) {
      this.error.set(`Password needs: ${unmet.map((rule) => rule.label.toLowerCase()).join(', ')}.`);
      return;
    }

    this.submitting.set(true);
    this.setupService
      .initialize({
        licenseAccepted: this.licenseAccepted(),
        licenseId: this.licenseId(),
        setupKey,
        email,
        password: this.password(),
        firstName: this.firstName().trim() || undefined,
        lastName: this.lastName().trim() || undefined,
        organizationName: this.organizationName().trim() || undefined,
        logoUrl: this.logoUrl().trim() || undefined,
        supportUrl: this.supportUrl().trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.setupKey.set('');
          if (this.organizationName().trim() || this.logoUrl().trim()) {
            this.brandingService.saveBranding(this.organizationName(), this.logoUrl());
          }
          this.signIn(email);
        },
        error: (err) => {
          this.submitting.set(false);
          this.error.set(err.error?.message || err.error?.error || 'Setup failed. Check the details and try again.');
          // Someone else finished setup in the meantime: the wizard no longer applies.
          if (err.error?.code === 'PRTL-1011') {
            this.router.navigateByUrl('/sign-in');
          }
        },
      });
  }

  private signIn(email: string): void {
    this.authService.login(email, this.password(), false).subscribe({
      next: (user) => {
        this.submitting.set(false);
        this.password.set('');
        this.confirmPassword.set('');
        if (user.status === 'second-step') {
          window.location.assign(user.path);
        } else if (user.status === 'authenticated') {
          this.step.set(this.isEmbeddedDatabase() ? 'database' : 'finish');
        } else {
          this.router.navigateByUrl('/sign-in');
        }
      },
      error: () => {
        // The account exists; the operator can sign in by hand.
        this.submitting.set(false);
        this.router.navigateByUrl('/sign-in');
      },
    });
  }

  // --- Database -------------------------------------------------------------------------------

  chooseDatabase(choice: DatabaseChoice): void {
    this.dbChoice.set(choice);
    this.testResult.set(null);
    this.error.set(null);
    if (choice === 'POSTGRESQL') {
      this.dbPort.set(5432);
    } else if (choice === 'MYSQL') {
      this.dbPort.set(3306);
    }
  }

  testConnection(): void {
    if (this.testing() || this.switching()) return;
    const request = this.connectionRequest();
    this.testing.set(true);
    this.testResult.set(null);
    this.dbService.testConnection(request).subscribe({
      next: (res) => {
        this.testing.set(false);
        if (JSON.stringify(request) === JSON.stringify(this.connectionRequest())) {
          this.testResult.set(res);
        }
      },
      error: (err) => {
        this.testing.set(false);
        this.testResult.set({ success: false, message: err.error?.message || 'Could not test the connection.' });
      },
    });
  }

  /** Copies everything created so far into the new database, saves it to the config file, restarts. */
  switchDatabase(): void {
    if (this.switching() || this.testing() || !this.testResult()?.success) return;
    this.error.set(null);
    this.switching.set(true);
    this.dbService.migrate({ ...this.connectionRequest(), saveConfiguration: true }).subscribe({
      next: () => {
        this.dbService.restart().subscribe({
          next: () => this.waitForRestart(),
          // The connection can drop as the server goes down; that is the restart working.
          error: () => this.waitForRestart(),
        });
      },
      error: (err) => {
        this.switching.set(false);
        this.error.set(err.error?.message || 'The database could not be prepared. Check the server log.');
      },
    });
  }

  private waitForRestart(): void {
    this.restartCountdown.set(8);
    const timer = setInterval(() => {
      const next = (this.restartCountdown() ?? 1) - 1;
      this.restartCountdown.set(next);
      if (next <= 0) {
        clearInterval(timer);
        // Sessions live in the database, so the switch signs everyone out — including us.
        window.location.assign('/sign-in');
      }
    }, 1000);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  private connectionRequest() {
    return {
      databaseType: this.dbChoice(),
      host: this.dbHost().trim(),
      port: Number(this.dbPort()),
      databaseName: this.dbName().trim(),
      username: this.dbUsername().trim(),
      password: this.dbPassword(),
    };
  }

  // --- Finish ---------------------------------------------------------------------------------

  finish(): void {
    this.router.navigateByUrl('/dashboard');
  }

  goTo(step: Step): void {
    this.error.set(null);
    this.step.set(step);
  }

  private urlProblem(value: string, label: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    try {
      const url = new URL(trimmed);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return null;
      }
    } catch {
      // Falls through to the message below.
    }
    return `${label} must be a full http:// or https:// address.`;
  }
}
