/**
 * Registry SDK Client
 *
 * HTTP client for communicating with the CIRIS Registry API
 */

import type {
  Organization,
  Partner,
  OrgUser,
  AuditEntry,
  CreateOrganizationRequest,
  CreatePartnerRequest,
  InviteUserRequest,
  AuditLogFilters,
  PaginatedResponse,
  ApiErrorResponse,
} from './types';

// ============================================================================
// Error Types
// ============================================================================

/**
 * Custom error class for Registry API errors
 */
export class RegistryApiError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly details?: Record<string, unknown>;

  constructor(response: ApiErrorResponse) {
    super(response.message);
    this.name = 'RegistryApiError';
    this.statusCode = response.statusCode;
    this.errorCode = response.error;
    this.details = response.details;
  }

  /**
   * Check if this is a specific HTTP error status
   */
  isStatus(status: number): boolean {
    return this.statusCode === status;
  }

  /**
   * Check if this is an authentication error
   */
  isAuthError(): boolean {
    return this.statusCode === 401;
  }

  /**
   * Check if this is a forbidden error
   */
  isForbidden(): boolean {
    return this.statusCode === 403;
  }

  /**
   * Check if this is a not found error
   */
  isNotFound(): boolean {
    return this.statusCode === 404;
  }
}

/**
 * Error for network/connection issues
 */
export class RegistryNetworkError extends Error {
  public readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'RegistryNetworkError';
    this.cause = cause;
  }
}

// ============================================================================
// Client Configuration
// ============================================================================

/**
 * Configuration options for the Registry client
 */
export interface RegistryClientConfig {
  /** Base URL for the Registry API */
  baseUrl?: string;
  /** Function to get the current auth token */
  getAuthToken?: () => string | null | Promise<string | null>;
  /** Request timeout in milliseconds */
  timeout?: number;
}

// ============================================================================
// Registry Client
// ============================================================================

/**
 * Client for interacting with the CIRIS Registry API
 */
export class RegistryClient {
  private readonly baseUrl: string;
  private readonly getAuthToken?: () => string | null | Promise<string | null>;
  private readonly timeout: number;

  constructor(config: RegistryClientConfig = {}) {
    this.baseUrl =
      config.baseUrl ||
      process.env.NEXT_PUBLIC_API_URL ||
      'https://api.registry.ciris.ai';
    this.getAuthToken = config.getAuthToken;
    this.timeout = config.timeout || 30000;
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Build headers for API requests
   */
  private async buildHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (this.getAuthToken) {
      const token = await this.getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  /**
   * Make an HTTP request to the Registry API
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = await this.buildHeaders();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        if (!response.ok) {
          throw new RegistryApiError({
            error: 'UNKNOWN_ERROR',
            message: `Request failed with status ${response.status}`,
            statusCode: response.status,
          });
        }
        return {} as T;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new RegistryApiError({
          error: data.error || 'UNKNOWN_ERROR',
          message:
            data.message || `Request failed with status ${response.status}`,
          statusCode: response.status,
          details: data.details,
        });
      }

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof RegistryApiError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new RegistryNetworkError('Request timed out');
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new RegistryNetworkError(
          'Unable to connect to Registry API. Please check your network connection.',
          error
        );
      }

      throw new RegistryNetworkError(
        `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Build query string from params object
   */
  private buildQueryString(
    params: Record<string, string | number | boolean | undefined | null>
  ): string {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    }

    const query = searchParams.toString();
    return query ? `?${query}` : '';
  }

  // ==========================================================================
  // Organization Methods
  // ==========================================================================

  /**
   * Get all organizations (admin only)
   */
  async getOrganizations(): Promise<Organization[]> {
    return this.request<Organization[]>('GET', '/organizations');
  }

  /**
   * Get a specific organization by ID
   */
  async getOrganization(id: string): Promise<Organization> {
    return this.request<Organization>('GET', `/organizations/${id}`);
  }

  /**
   * Create a new organization
   */
  async createOrganization(
    data: CreateOrganizationRequest
  ): Promise<Organization> {
    return this.request<Organization>('POST', '/organizations', data);
  }

  /**
   * Update an organization
   */
  async updateOrganization(
    id: string,
    data: Partial<CreateOrganizationRequest>
  ): Promise<Organization> {
    return this.request<Organization>('PATCH', `/organizations/${id}`, data);
  }

  /**
   * Delete an organization
   */
  async deleteOrganization(id: string): Promise<void> {
    await this.request<void>('DELETE', `/organizations/${id}`);
  }

  // ==========================================================================
  // Partner Methods
  // ==========================================================================

  /**
   * Get partners, optionally filtered by organization
   */
  async getPartners(orgId?: string): Promise<Partner[]> {
    const query = orgId ? this.buildQueryString({ orgId }) : '';
    return this.request<Partner[]>('GET', `/partners${query}`);
  }

  /**
   * Get a specific partner by ID
   */
  async getPartner(id: string): Promise<Partner> {
    return this.request<Partner>('GET', `/partners/${id}`);
  }

  /**
   * Create a new partner
   */
  async createPartner(data: CreatePartnerRequest): Promise<Partner> {
    return this.request<Partner>('POST', '/partners', data);
  }

  /**
   * Update a partner
   */
  async updatePartner(
    id: string,
    data: Partial<CreatePartnerRequest>
  ): Promise<Partner> {
    return this.request<Partner>('PATCH', `/partners/${id}`, data);
  }

  /**
   * Suspend a partner
   */
  async suspendPartner(id: string): Promise<Partner> {
    return this.request<Partner>('POST', `/partners/${id}/suspend`);
  }

  /**
   * Reactivate a suspended partner
   */
  async reactivatePartner(id: string): Promise<Partner> {
    return this.request<Partner>('POST', `/partners/${id}/reactivate`);
  }

  // ==========================================================================
  // User Methods
  // ==========================================================================

  /**
   * Get all users in an organization
   */
  async getOrgUsers(orgId: string): Promise<OrgUser[]> {
    return this.request<OrgUser[]>('GET', `/organizations/${orgId}/users`);
  }

  /**
   * Invite a user to an organization
   */
  async inviteUser(
    orgId: string,
    email: string,
    role: InviteUserRequest['role']
  ): Promise<OrgUser> {
    return this.request<OrgUser>('POST', `/organizations/${orgId}/users`, {
      email,
      role,
    });
  }

  /**
   * Update a user's role
   */
  async updateUserRole(
    orgId: string,
    userId: string,
    role: InviteUserRequest['role']
  ): Promise<OrgUser> {
    return this.request<OrgUser>(
      'PATCH',
      `/organizations/${orgId}/users/${userId}`,
      { role }
    );
  }

  /**
   * Remove a user from an organization
   */
  async removeUser(orgId: string, userId: string): Promise<void> {
    await this.request<void>(
      'DELETE',
      `/organizations/${orgId}/users/${userId}`
    );
  }

  // ==========================================================================
  // Audit Log Methods
  // ==========================================================================

  /**
   * Get audit log entries with optional filters
   */
  async getAuditLog(
    filters?: AuditLogFilters
  ): Promise<PaginatedResponse<AuditEntry>> {
    const query = filters
      ? this.buildQueryString(
          filters as Record<
            string,
            string | number | boolean | undefined | null
          >
        )
      : '';
    return this.request<PaginatedResponse<AuditEntry>>('GET', `/audit${query}`);
  }

  /**
   * Get a specific audit entry by ID
   */
  async getAuditEntry(id: string): Promise<AuditEntry> {
    return this.request<AuditEntry>('GET', `/audit/${id}`);
  }

  /**
   * Verify the integrity of an audit entry
   */
  async verifyAuditEntry(
    id: string
  ): Promise<{ valid: boolean; errors?: string[] }> {
    return this.request<{ valid: boolean; errors?: string[] }>(
      'POST',
      `/audit/${id}/verify`
    );
  }
}

// ============================================================================
// Default Client Instance
// ============================================================================

/**
 * Default client instance for convenience
 * In most cases, you should create your own instance with proper auth configuration
 */
let defaultClient: RegistryClient | null = null;

/**
 * Get or create a default Registry client instance
 */
export function getRegistryClient(
  config?: RegistryClientConfig
): RegistryClient {
  if (!defaultClient || config) {
    defaultClient = new RegistryClient(config);
  }
  return defaultClient;
}

/**
 * Reset the default client (useful for testing)
 */
export function resetRegistryClient(): void {
  defaultClient = null;
}
