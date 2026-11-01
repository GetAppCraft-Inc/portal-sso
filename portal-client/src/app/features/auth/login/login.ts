import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { BrandingService } from '../../../core/services/branding.service';
import { MagicLinkService } from '../../../core/services/magic-link.service';
import { PasswordResetService } from '../../../core/services/password-reset.service';
import { RegistrationService } from '../../../core/services/registration.service';
import { SetupService } from '../../../core/services/setup.service';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
})
export class Login {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly registrationService = inject(RegistrationService);
  private readonly setupService = inject(SetupService);
  private readonly magicLinkService = inject(MagicLinkService);
  private readonly passwordResetService = inject(PasswordResetService);
  readonly brandingService = inject(BrandingService);
  readonly themeService = inject(ThemeService);

  /** Drives the "Create one" link — self-registration is off unless the server says otherwise. */
  readonly registrationPolicy = this.registrationService.policy;

  /** Drives the passwordless option — off unless an administrator has enabled it. */
  readonly magicLinkPolicy = this.magicLinkService.policy;

  /** "Forgot password?" is offered only on a server that can send the reset email. */
  readonly passwordResetAvailable = this.passwordResetService.available;

  /** Magic link request state. Separate from `error`/`successMessage` so a failed password
   *  attempt and a sent link cannot overwrite each other's banner. */
  readonly magicLinkEmail = signal('');
  readonly magicLinkSending = signal(false);
  readonly magicLinkMessage = signal<string | null>(null);
  readonly magicLinkError = signal<string | null>(null);

  readonly email = signal('');
  readonly password = signal('');
  readonly rememberMe = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  constructor() {
    this.authService.loadCurrentUser().subscribe((user) => {
      if (user) {
        const params = new URLSearchParams(window.location.search);
        const returnUrl = params.get('return_url') || params.get('returnUrl') || params.get('redirect_uri');
        if (returnUrl) {
          window.location.href = returnUrl;
          return;
        }
        if (this.authService.isAdmin()) {
          this.router.navigateByUrl('/dashboard');
        } else {
          this.router.navigateByUrl('/apps');
        }
      }
    });

    // Loaded up front so the passwordless option is present on first paint rather than appearing
    // under the cursor a moment after the password form has rendered.
    this.magicLinkService.loadPolicy().subscribe({
      error: () => {
        // A server with the feature off still answers this, so a failure here means the request
        // itself did not land. Leaving the default (disabled) simply hides the option.
      },
    });

    // A fresh install has nobody to sign in as: send the operator to the setup wizard.
    this.setupService.getStatus().subscribe({
      next: (status) => {
        if (status.setupRequired) {
          this.router.navigateByUrl('/setup');
        }
      },
      error: () => {},
    });

    this.registrationService.loadPolicy().subscribe();
    this.passwordResetService.loadPolicy().subscribe({ error: () => {} });
  }

  submit(): void {
    this.error.set(null);
    this.successMessage.set(null);
    this.submitting.set(true);

    this.authService.login(this.email(), this.password(), this.rememberMe()).subscribe({
      next: (user) => {
        this.submitting.set(false);
        if (user.status === 'second-step') {
          window.location.assign(user.path);
        } else if (user.status === 'authenticated') {
          const params = new URLSearchParams(window.location.search);
          const returnUrl = params.get('return_url') || params.get('returnUrl') || params.get('redirect_uri');
          if (returnUrl) {
            window.location.href = returnUrl;
            return;
          }
          if (this.authService.isAdmin()) {
            this.router.navigateByUrl('/dashboard');
          } else {
            this.router.navigateByUrl('/apps');
          }
        } else {
          this.error.set('Invalid email or password.');
        }
      },
      error: () => {
        this.submitting.set(false);
        this.error.set('Invalid email or password.');
      },
    });
  }

  requestMagicLink(): void {
    const email = this.magicLinkEmail().trim();
    if (!email) {
      this.magicLinkError.set('Enter your email address first.');
      return;
    }

    this.magicLinkSending.set(true);
    this.magicLinkMessage.set(null);
    this.magicLinkError.set(null);

    this.magicLinkService.requestLink(email).subscribe({
      next: (res) => {
        this.magicLinkSending.set(false);
        // The server's own wording, which is deliberately the same whether or not the address has
        // an account. Composing a message here risked saying something more specific than the
        // server is willing to confirm.
        this.magicLinkMessage.set(res.message);
        this.magicLinkEmail.set('');
      },
      error: (err) => {
        this.magicLinkSending.set(false);
        this.magicLinkError.set(
          err.error?.message || 'Sign-in links are not available right now. Use your password instead.',
        );
      },
    });
  }
}
