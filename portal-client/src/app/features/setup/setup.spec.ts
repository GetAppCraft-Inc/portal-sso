import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Setup } from './setup';
import { SetupService } from '../../core/services/setup.service';
import { AuthService } from '../../core/services/auth.service';
import { BrandingService } from '../../core/services/branding.service';
import { DatabaseMigrationService, TestConnectionResponse } from '../../core/services/database-migration.service';

describe('First-run setup', () => {
  const status = {
    setupRequired: true, setupKeyIssued: true, isEmbeddedDatabase: true,
    licenseId: 'Apache-2.0', databaseProduct: 'H2', organization: {}, passwordPolicy: null,
  };
  let setup: { getLicenseText: ReturnType<typeof vi.fn>; getStatus: ReturnType<typeof vi.fn>; initialize: ReturnType<typeof vi.fn> };
  let database: { testConnection: ReturnType<typeof vi.fn>; migrate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    setup = { getLicenseText: vi.fn().mockReturnValue(of('Apache License Version 2.0')), getStatus: vi.fn().mockReturnValue(of(status)), initialize: vi.fn() };
    database = { testConnection: vi.fn(), migrate: vi.fn() };
    TestBed.configureTestingModule({
      imports: [Setup],
      providers: [
        provideRouter([]),
        { provide: SetupService, useValue: setup },
        { provide: DatabaseMigrationService, useValue: database },
        { provide: AuthService, useValue: {} },
        { provide: BrandingService, useValue: {} },
      ],
    });
  });

  it('offers a retry instead of reporting setup locked when the server is unreachable', () => {
    setup.getStatus.mockReturnValueOnce(throwError(() => new Error('offline')));
    const fixture = TestBed.createComponent(Setup);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Try again');
    expect(fixture.nativeElement.textContent).not.toContain('Setup is locked');
    fixture.componentInstance.loadStatus();
    fixture.detectChanges();
    expect(fixture.componentInstance.statusFailed()).toBe(false);
    expect(fixture.componentInstance.setupKeyIssued()).toBe(true);
  });

  it('ignores a successful test response after the connection settings changed', () => {
    const response = new Subject<TestConnectionResponse>();
    database.testConnection.mockReturnValue(response);
    const component = TestBed.createComponent(Setup).componentInstance;
    component.chooseDatabase('POSTGRESQL');
    component.testConnection();
    component.dbHost.set('different-host');
    response.next({ success: true, message: 'Connected' });
    expect(component.testing()).toBe(false);
    expect(component.testResult()).toBeNull();
    component.switchDatabase();
    expect(database.migrate).not.toHaveBeenCalled();
  });

  it('does not start duplicate database tests', () => {
    database.testConnection.mockReturnValue(new Subject<TestConnectionResponse>());
    const component = TestBed.createComponent(Setup).componentInstance;
    component.chooseDatabase('POSTGRESQL');
    component.testConnection();
    component.testConnection();
    expect(database.testConnection).toHaveBeenCalledTimes(1);
  });
  it('requires an explicit agreement and preserves it when navigating back', () => {
    const component = TestBed.createComponent(Setup).componentInstance;
    expect(component.licenseAccepted()).toBe(false);
    component.continueFromLicense();
    expect(component.step()).toBe('license');
    component.licenseAccepted.set(true);
    component.continueFromLicense();
    expect(component.step()).toBe('organization');
    component.goTo('license');
    expect(component.licenseAccepted()).toBe(true);
    component.licenseAccepted.set(false);
    component.createAdministrator();
    expect(setup.initialize).not.toHaveBeenCalled();
  });

  it('requires the license to load and allows retrying a failed download', () => {
    setup.getLicenseText.mockReturnValueOnce(throwError(() => new Error('offline')));
    const component = TestBed.createComponent(Setup).componentInstance;
    component.licenseAccepted.set(true);
    component.continueFromLicense();
    expect(component.step()).toBe('license');
    expect(component.licenseFailed()).toBe(true);
    component.loadLicense();
    component.continueFromLicense();
    expect(component.step()).toBe('organization');
  });

});
