import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PasswordPolicy } from './account.service';

export interface SetupStatusResponse {
  setupRequired: boolean;
  licenseId: string;
  /** False while setup is required means the wizard cannot be used: auto-generation is off. */
  setupKeyIssued: boolean;
  /** Where the operator finds the key; present only while setup is required. */
  setupKeyFile?: string;
  /** The policy with the administrator's higher length floor already applied. */
  passwordPolicy: PasswordPolicy;
  databaseType: string;
  isEmbeddedDatabase: boolean;
  databaseProduct: string;
  /** The configuration file the server reads; present only while setup is required. */
  configFile?: string;
  /** Pre-fills the wizard: set when the operator put app.organization.* in the config file. */
  organization: SetupOrganization;
}

export interface SetupOrganization {
  name: string | null;
  logoUrl: string | null;
  supportUrl: string | null;
}

export interface SetupInitializeRequest {
  licenseAccepted: boolean;
  licenseId: string;
  setupKey: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  organizationName?: string;
  logoUrl?: string;
  supportUrl?: string;
}

export interface SetupInitializeResponse {
  success: boolean;
  message: string;
  email?: string;
}

@Injectable({ providedIn: 'root' })
export class SetupService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/public/setup';

  getStatus(): Observable<SetupStatusResponse> {
    return this.http.get<SetupStatusResponse>(`${this.baseUrl}/status`);
  }

  getLicenseText(): Observable<string> {
    return this.http.get('legal/LICENSE.txt', { responseType: 'text' });
  }

  initialize(request: SetupInitializeRequest): Observable<SetupInitializeResponse> {
    return this.http.post<SetupInitializeResponse>(`${this.baseUrl}/initialize`, request);
  }
}
