import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';
import { SnackbarService } from '../../../../core/services/snackbar.service';
import { Badge } from '../../../../shared/components/badge/badge';
import { PortalRole } from '../../models/role.model';
import { RoleService } from '../../services/role.service';

const INPUT_BASE =
  'block w-full rounded-lg border px-3.5 py-2.5 text-sm text-ink-900 shadow-sm transition-colors placeholder:text-ink-400 focus:outline-none focus:ring-2';
const INPUT_VALID = 'border-ink-300 focus:border-brand-500 focus:ring-brand-500/25';
const INPUT_INVALID = 'border-red-400 focus:border-red-400 focus:ring-red-400/25';

/** The server's rule. A name without the prefix would be an authority hasRole() never matches. */
const ROLE_NAME = /^ROLE_[A-Z0-9_]+$/;

/** "support team" → "ROLE_SUPPORT_TEAM"; "ROLE_x" → "ROLE_X". */
export function normalizeRoleName(value: string): string {
  const upper = (value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return upper.startsWith('ROLE_') ? upper : `ROLE_${upper}`;
}

@Component({
  selector: 'app-role-list',
  standalone: true,
  imports: [Badge, ReactiveFormsModule],
  templateUrl: './role-list.html',
})
export class RoleList {
  private readonly roleService = inject(RoleService);
  private readonly snackbarService = inject(SnackbarService);
  private readonly fb = inject(FormBuilder);

  readonly roles = signal<PortalRole[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);

  readonly showCreateModal = signal(false);
  readonly submitting = signal(false);
  readonly createError = signal<string | null>(null);

  /** The role queued for deletion, held until the operator confirms. */
  readonly pendingDelete = signal<PortalRole | null>(null);

  readonly createForm = this.fb.nonNullable.group({
    // Mirrors the server's rule exactly. A name without the ROLE_ prefix becomes an authority that
    // hasRole() will never match, so the role would be assignable and silently do nothing.
    // Validated after normalizing, so "support" or "Support Team" are accepted as ROLE_SUPPORT /
    // ROLE_SUPPORT_TEAM instead of being refused with no request sent.
    name: ['ROLE_', [Validators.required, (c: AbstractControl) => (ROLE_NAME.test(normalizeRoleName(c.value)) ? null : { pattern: true })]],
    description: [''],
  });

  /** What will actually be created, shown under the field. */
  readonly normalizedName = toSignal(this.createForm.controls.name.valueChanges.pipe(map(normalizeRoleName)), {
    initialValue: 'ROLE_',
  });

  constructor() {
    this.load();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.pendingDelete()) {
      this.pendingDelete.set(null);
    } else if (this.showCreateModal()) {
      this.closeCreateModal();
    }
  }

  load(): void {
    this.loading.set(true);
    this.roleService.list().subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load roles.');
        this.loading.set(false);
      },
    });
  }

  openCreateModal(): void {
    this.createForm.reset({ name: 'ROLE_', description: '' });
    this.createError.set(null);
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
    this.createError.set(null);
  }

  nameInputClasses(): string {
    const control = this.createForm.controls.name;
    return `${INPUT_BASE} ${control.touched && control.invalid ? INPUT_INVALID : INPUT_VALID} font-mono`;
  }

  submitCreate(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const value = this.createForm.getRawValue();
    this.submitting.set(true);
    this.createError.set(null);

    this.roleService
      .create({ name: normalizeRoleName(value.name), description: value.description.trim() || undefined })
      .subscribe({
        next: (role) => {
          this.submitting.set(false);
          this.showCreateModal.set(false);
          this.roles.update((list) => [...list, role].sort((a, b) => a.name.localeCompare(b.name)));
          this.snackbarService.success('Role Created', `${role.name} can now be assigned to users.`);
        },
        error: (err: HttpErrorResponse) => {
          this.submitting.set(false);
          const message = err.error?.message ?? 'Could not create that role.';
          this.createError.set(message);
          this.snackbarService.error('Create Failed', message, err.error?.code);
        },
      });
  }

  saveDescription(role: PortalRole, description: string): void {
    if ((role.description ?? '') === description.trim()) {
      return;
    }
    this.busyId.set(role.id);
    this.roleService.updateDescription(role.id, description.trim()).subscribe({
      next: (updated) => {
        this.roles.update((list) => list.map((r) => (r.id === updated.id ? updated : r)));
        this.busyId.set(null);
        this.snackbarService.info('Role Updated', `Description saved for ${updated.name}.`);
      },
      error: (err: HttpErrorResponse) => {
        this.busyId.set(null);
        this.snackbarService.error(
          'Update Failed',
          err.error?.message ?? 'Could not update that role.',
          err.error?.code
        );
      },
    });
  }

  confirmDelete(): void {
    const role = this.pendingDelete();
    if (!role) {
      return;
    }
    this.busyId.set(role.id);
    this.roleService.delete(role.id).subscribe({
      next: () => {
        this.roles.update((list) => list.filter((r) => r.id !== role.id));
        this.pendingDelete.set(null);
        this.busyId.set(null);
        this.snackbarService.success('Role Deleted', `${role.name} was removed from ${role.userCount} user(s).`);
      },
      error: (err: HttpErrorResponse) => {
        this.pendingDelete.set(null);
        this.busyId.set(null);
        this.snackbarService.error(
          'Delete Failed',
          err.error?.message ?? 'Could not delete that role.',
          err.error?.code
        );
      },
    });
  }
}
