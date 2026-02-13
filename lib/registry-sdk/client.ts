/**
 * Registry SDK Client
 *
 * HTTP client for communicating with the CIRIS Registry API v1.1.0
 * Includes comprehensive logging for integration testing
 */

import type {
  // Core types
  Organization,
  OrgUser,
  PartnerKeyRecord,
  AuditEntry,
  PartnerRecord,
  KeyEscrow,
  WebhookConfig,
  ComplianceReport,
  HealthCheckResponse,
  MetricsResponse,
  PartnerActivityResponse,
  ExpiringLicense,
  EmergencyStatusResponse,
  // Request types
  CreateOrganizationRequest,
  UpdateOrganizationRequest,
  CreateOrgUserRequest,
  UpdateOrgUserRequest,
  GenerateKeyPairRequest,
  GenerateKeyPairResponse,
  RotateKeyRequest,
  RevokeKeyRequest,
  RequestKeyEscrowRequest,
  RequestKeyRecoveryRequest,
  AuditLogFilters,
  ExportAuditLogRequest,
  GenerateComplianceReportRequest,
  RegisterWebhookRequest,
  ListKeysRequest,
  ListOrgUsersRequest,
  ListOrganizationsRequest,
  ListExpiringLicensesRequest,
  // Response types
  PaginatedResponse,
  AdminResponse,
  RotateKeyResponse,
  KeyEscrowResponse,
  KeyRecoveryResponse,
  ExportAuditLogResponse,
  ListWebhooksResponse,
  ListExpiringLicensesResponse,
  // Context types
  RequestContext,
  ResponseContext,
  ErrorDetail,
} from './types';

import {
  RegistryErrorCode,
  Retryable,
  OrgRole,
  KeyRotationMode,
} from './types';

// ============================================================================
// Logger Interface
// ============================================================================

/**
 * Log levels for SDK operations
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Log entry structure for integration testing
 */
export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  operation: string;
  requestId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  error?: string;
  errorCode?: RegistryErrorCode;
  metadata?: Record<string, unknown>;
}

/**
 * Logger interface - can be replaced with custom implementation
 */
export interface Logger {
  debug(entry: LogEntry): void;
  info(entry: LogEntry): void;
  warn(entry: LogEntry): void;
  error(entry: LogEntry): void;
}

/**
 * Default console logger for development
 */
export const consoleLogger: Logger = {
  debug: (entry) =>
    console.debug(
      `[REGISTRY-SDK][DEBUG] ${entry.operation}`,
      formatLogEntry(entry)
    ),
  info: (entry) =>
    console.info(
      `[REGISTRY-SDK][INFO] ${entry.operation}`,
      formatLogEntry(entry)
    ),
  warn: (entry) =>
    console.warn(
      `[REGISTRY-SDK][WARN] ${entry.operation}`,
      formatLogEntry(entry)
    ),
  error: (entry) =>
    console.error(
      `[REGISTRY-SDK][ERROR] ${entry.operation}`,
      formatLogEntry(entry)
    ),
};

/**
 * No-op logger for production or when logging is disabled
 */
export const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

/**
 * Format log entry for console output
 */
function formatLogEntry(entry: LogEntry): Record<string, unknown> {
  const { timestamp, level, operation, ...rest } = entry;
  return {
    ts: new Date(timestamp).toISOString(),
    ...rest,
  };
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Custom error class for Registry API errors
 */
export class RegistryApiError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: RegistryErrorCode;
  public readonly retryStatus: Retryable;
  public readonly retryAfterSeconds?: number;
  public readonly details?: ErrorDetail;
  public readonly requestId?: string;

  constructor(
    message: string,
    statusCode: number,
    errorCode: RegistryErrorCode = RegistryErrorCode.UNSPECIFIED,
    details?: ErrorDetail,
    requestId?: string
  ) {
    super(message);
    this.name = 'RegistryApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.retryStatus = details?.retryStatus ?? Retryable.NO;
    this.retryAfterSeconds = details?.retryAfterSeconds;
    this.details = details;
    this.requestId = requestId;
  }

  isStatus(status: number): boolean {
    return this.statusCode === status;
  }

  isRetryable(): boolean {
    return (
      this.retryStatus === Retryable.IMMEDIATE ||
      this.retryStatus === Retryable.BACKOFF ||
      this.retryStatus === Retryable.AFTER
    );
  }

  isAuthError(): boolean {
    return this.statusCode === 401;
  }

  isForbidden(): boolean {
    return this.statusCode === 403;
  }

  isNotFound(): boolean {
    return this.statusCode === 404;
  }

  isRateLimited(): boolean {
    return this.statusCode === 429;
  }
}

/**
 * Error for network/connection issues
 */
export class RegistryNetworkError extends Error {
  public readonly cause?: Error;
  public readonly requestId?: string;

  constructor(message: string, cause?: Error, requestId?: string) {
    super(message);
    this.name = 'RegistryNetworkError';
    this.cause = cause;
    this.requestId = requestId;
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
  /** Logger instance (defaults to console in dev, noop in prod) */
  logger?: Logger;
  /** Client version string for request context */
  clientVersion?: string;
  /** Enable debug logging */
  debug?: boolean;
}

// ============================================================================
// Registry Client
// ============================================================================

/**
 * Client for interacting with the CIRIS Registry API v1.1.0
 */
export class RegistryClient {
  private readonly baseUrl: string;
  private readonly getAuthToken?: () => string | null | Promise<string | null>;
  private readonly timeout: number;
  private readonly logger: Logger;
  private readonly clientVersion: string;
  private readonly debug: boolean;

  constructor(config: RegistryClientConfig = {}) {
    this.baseUrl =
      config.baseUrl ||
      process.env.NEXT_PUBLIC_REGISTRY_API_URL ||
      '/api/registry';
    this.getAuthToken = config.getAuthToken;
    this.timeout = config.timeout || 30000;
    this.clientVersion = config.clientVersion || 'portal-v0.1.0';
    this.debug = config.debug ?? process.env.NODE_ENV === 'development';
    this.logger = config.logger || (this.debug ? consoleLogger : noopLogger);
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Build request context for tracing
   */
  private buildRequestContext(): RequestContext {
    return {
      requestId: this.generateRequestId(),
      clientVersion: this.clientVersion,
      userAgent:
        typeof navigator !== 'undefined' ? navigator.userAgent : 'node',
      requestTimestamp: Date.now(),
    };
  }

  /**
   * Build headers for API requests
   */
  private async buildHeaders(requestId: string): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Request-ID': requestId,
      'X-Client-Version': this.clientVersion,
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
   * Make an HTTP request to the Registry API with logging
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    operation?: string
  ): Promise<T> {
    const context = this.buildRequestContext();
    const url = `${this.baseUrl}${path}`;
    const startTime = Date.now();
    const opName = operation || `${method} ${path}`;

    this.logger.debug({
      timestamp: startTime,
      level: 'debug',
      operation: opName,
      requestId: context.requestId,
      method,
      path,
      metadata: body ? { body: JSON.stringify(body).substring(0, 500) } : {},
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers = await this.buildHeaders(context.requestId);
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const durationMs = Date.now() - startTime;

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        if (!response.ok) {
          const errorMsg = `Request failed with status ${response.status}`;
          this.logger.error({
            timestamp: Date.now(),
            level: 'error',
            operation: opName,
            requestId: context.requestId,
            method,
            path,
            statusCode: response.status,
            durationMs,
            error: errorMsg,
          });
          throw new RegistryApiError(
            errorMsg,
            response.status,
            RegistryErrorCode.UNSPECIFIED,
            undefined,
            context.requestId
          );
        }
        this.logger.info({
          timestamp: Date.now(),
          level: 'info',
          operation: opName,
          requestId: context.requestId,
          method,
          path,
          statusCode: response.status,
          durationMs,
        });
        return {} as T;
      }

      const data = await response.json();

      if (!response.ok) {
        const errorDetail: ErrorDetail | undefined = data.error;
        const errorCode =
          errorDetail?.code ?? this.httpStatusToErrorCode(response.status);
        const errorMsg =
          errorDetail?.message ||
          data.message ||
          `Request failed with status ${response.status}`;

        this.logger.error({
          timestamp: Date.now(),
          level: 'error',
          operation: opName,
          requestId: context.requestId,
          method,
          path,
          statusCode: response.status,
          durationMs,
          error: errorMsg,
          errorCode,
          metadata: { details: errorDetail },
        });

        throw new RegistryApiError(
          errorMsg,
          response.status,
          errorCode,
          errorDetail,
          context.requestId
        );
      }

      // Extract response context for logging
      const responseContext: ResponseContext | undefined = data.context;
      this.logger.info({
        timestamp: Date.now(),
        level: 'info',
        operation: opName,
        requestId: context.requestId,
        method,
        path,
        statusCode: response.status,
        durationMs,
        metadata: responseContext
          ? {
              serverProcessingMs: responseContext.processingTimeMs,
              serverVersion: responseContext.serverVersion,
            }
          : {},
      });

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);
      const durationMs = Date.now() - startTime;

      if (error instanceof RegistryApiError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        const errorMsg = `Request timed out after ${this.timeout}ms`;
        this.logger.error({
          timestamp: Date.now(),
          level: 'error',
          operation: opName,
          requestId: context.requestId,
          method,
          path,
          durationMs,
          error: errorMsg,
        });
        throw new RegistryNetworkError(errorMsg, error, context.requestId);
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        const errorMsg =
          'Unable to connect to Registry API. Please check your network connection.';
        this.logger.error({
          timestamp: Date.now(),
          level: 'error',
          operation: opName,
          requestId: context.requestId,
          method,
          path,
          durationMs,
          error: errorMsg,
          metadata: { cause: error.message },
        });
        throw new RegistryNetworkError(errorMsg, error, context.requestId);
      }

      const errorMsg = `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error({
        timestamp: Date.now(),
        level: 'error',
        operation: opName,
        requestId: context.requestId,
        method,
        path,
        durationMs,
        error: errorMsg,
      });
      throw new RegistryNetworkError(
        errorMsg,
        error instanceof Error ? error : undefined,
        context.requestId
      );
    }
  }

  /**
   * Map HTTP status to error code
   */
  private httpStatusToErrorCode(status: number): RegistryErrorCode {
    const mapping: Record<number, RegistryErrorCode> = {
      400: RegistryErrorCode.INVALID_ARGUMENT,
      401: RegistryErrorCode.UNAUTHORIZED,
      403: RegistryErrorCode.FORBIDDEN,
      404: RegistryErrorCode.NOT_FOUND,
      409: RegistryErrorCode.CONFLICT,
      429: RegistryErrorCode.RATE_LIMITED,
      500: RegistryErrorCode.INTERNAL,
      503: RegistryErrorCode.SERVICE_UNAVAILABLE,
    };
    return mapping[status] ?? RegistryErrorCode.UNSPECIFIED;
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
  // Health & Monitoring
  // ==========================================================================

  /**
   * Check registry health status
   */
  async healthCheck(includeDiagnostics = false): Promise<HealthCheckResponse> {
    const query = this.buildQueryString({
      include_diagnostics: includeDiagnostics,
    });
    return this.request<HealthCheckResponse>(
      'GET',
      `/health${query}`,
      undefined,
      'healthCheck'
    );
  }

  /**
   * Get registry metrics
   */
  async getMetrics(timeRangeMinutes = 60): Promise<MetricsResponse> {
    const query = this.buildQueryString({
      time_range_minutes: timeRangeMinutes,
    });
    return this.request<MetricsResponse>(
      'GET',
      `/metrics${query}`,
      undefined,
      'getMetrics'
    );
  }

  /**
   * Get emergency status
   */
  async getEmergencyStatus(): Promise<EmergencyStatusResponse> {
    return this.request<EmergencyStatusResponse>(
      'GET',
      '/emergency/status',
      undefined,
      'getEmergencyStatus'
    );
  }

  // ==========================================================================
  // Organization Methods
  // ==========================================================================

  /**
   * Get all organizations (admin only)
   */
  async getOrganizations(
    params?: ListOrganizationsRequest
  ): Promise<PaginatedResponse<Organization>> {
    const query = params
      ? this.buildQueryString({
          page_size: params.pageSize,
          page_token: params.pageToken,
          include_inactive: params.includeInactive,
        })
      : '';
    return this.request<PaginatedResponse<Organization>>(
      'GET',
      `/portal/organizations${query}`,
      undefined,
      'getOrganizations'
    );
  }

  /**
   * Get a specific organization by ID
   */
  async getOrganization(orgId: string): Promise<Organization> {
    const response = await this.request<{
      organization: Organization;
      found: boolean;
    }>('GET', `/portal/organizations/${orgId}`, undefined, 'getOrganization');
    if (!response.found) {
      throw new RegistryApiError(
        `Organization ${orgId} not found`,
        404,
        RegistryErrorCode.ORG_NOT_FOUND
      );
    }
    return response.organization;
  }

  /**
   * Create a new organization
   */
  async createOrganization(
    data: CreateOrganizationRequest
  ): Promise<AdminResponse> {
    return this.request<AdminResponse>(
      'POST',
      '/portal/organizations',
      data,
      'createOrganization'
    );
  }

  /**
   * Update an organization
   */
  async updateOrganization(
    data: UpdateOrganizationRequest
  ): Promise<AdminResponse> {
    return this.request<AdminResponse>(
      'PUT',
      `/portal/organizations/${data.organization.orgId}`,
      data,
      'updateOrganization'
    );
  }

  // ==========================================================================
  // User Methods
  // ==========================================================================

  /**
   * Get all users in an organization
   */
  async getOrgUsers(
    params: ListOrgUsersRequest
  ): Promise<PaginatedResponse<OrgUser>> {
    const query = this.buildQueryString({
      page_size: params.pageSize,
      page_token: params.pageToken,
      include_inactive: params.includeInactive,
    });
    return this.request<PaginatedResponse<OrgUser>>(
      'GET',
      `/portal/organizations/${params.orgId}/users${query}`,
      undefined,
      'getOrgUsers'
    );
  }

  /**
   * Get a specific user by ID
   */
  async getOrgUser(userId: string): Promise<OrgUser> {
    const response = await this.request<{ user: OrgUser; found: boolean }>(
      'GET',
      `/portal/users/${userId}`,
      undefined,
      'getOrgUser'
    );
    if (!response.found) {
      throw new RegistryApiError(
        `User ${userId} not found`,
        404,
        RegistryErrorCode.USER_NOT_FOUND
      );
    }
    return response.user;
  }

  /**
   * Get user by email
   */
  async getOrgUserByEmail(email: string): Promise<OrgUser | null> {
    try {
      const response = await this.request<{ user: OrgUser; found: boolean }>(
        'GET',
        `/portal/users/by-email/${encodeURIComponent(email)}`,
        undefined,
        'getOrgUserByEmail'
      );
      return response.found ? response.user : null;
    } catch (error) {
      if (error instanceof RegistryApiError && error.isNotFound()) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create a new user in an organization
   */
  async createOrgUser(data: CreateOrgUserRequest): Promise<AdminResponse> {
    return this.request<AdminResponse>(
      'POST',
      `/portal/organizations/${data.user.orgId}/users`,
      data,
      'createOrgUser'
    );
  }

  /**
   * Update a user
   */
  async updateOrgUser(data: UpdateOrgUserRequest): Promise<AdminResponse> {
    return this.request<AdminResponse>(
      'PUT',
      `/portal/users/${data.user.userId}`,
      data,
      'updateOrgUser'
    );
  }

  /**
   * Update a user's role
   */
  async updateUserRole(
    orgId: string,
    userId: string,
    role: OrgRole
  ): Promise<AdminResponse> {
    return this.request<AdminResponse>(
      'PATCH',
      `/portal/organizations/${orgId}/users/${userId}/role`,
      { role },
      'updateUserRole'
    );
  }

  /**
   * Deactivate a user
   */
  async deactivateUser(userId: string): Promise<AdminResponse> {
    return this.request<AdminResponse>(
      'POST',
      `/portal/users/${userId}/deactivate`,
      undefined,
      'deactivateUser'
    );
  }

  // ==========================================================================
  // Key Management Methods
  // ==========================================================================

  /**
   * List keys for an organization
   */
  async listKeys(
    params: ListKeysRequest
  ): Promise<PaginatedResponse<PartnerKeyRecord>> {
    const query = this.buildQueryString({
      org_id: params.orgId,
      page_size: params.pageSize,
      page_token: params.pageToken,
      include_revoked: params.includeRevoked,
    });
    return this.request<PaginatedResponse<PartnerKeyRecord>>(
      'GET',
      `/keys${query}`,
      undefined,
      'listKeys'
    );
  }

  /**
   * Get a specific key
   */
  async getKey(orgId: string, keyId: string): Promise<PartnerKeyRecord> {
    const response = await this.request<{
      key: PartnerKeyRecord;
      found: boolean;
    }>(
      'GET',
      `/portal/organizations/${orgId}/keys/${keyId}`,
      undefined,
      'getKey'
    );
    if (!response.found) {
      throw new RegistryApiError(
        `Key ${keyId} not found`,
        404,
        RegistryErrorCode.KEY_NOT_FOUND
      );
    }
    return response.key;
  }

  /**
   * Generate a new key pair
   */
  async generateKeyPair(
    data: GenerateKeyPairRequest
  ): Promise<GenerateKeyPairResponse> {
    const response = await this.request<{
      keyRecord: PartnerKeyRecord;
      ed25519PrivateKey?: string;
    }>(
      'POST',
      '/keys',
      {
        action: 'generate',
        org_id: data.orgId,
        requester_user_id: data.requesterUserId,
        activate_immediately: data.activateImmediately,
      },
      'generateKeyPair'
    );
    return {
      keyRecord: response.keyRecord,
      ed25519PrivateKey: response.ed25519PrivateKey,
    };
  }

  /**
   * Activate a pending key
   */
  async activateKey(
    orgId: string,
    keyId: string,
    requesterUserId: string
  ): Promise<AdminResponse> {
    return this.request<AdminResponse>(
      'POST',
      '/keys',
      {
        action: 'activate',
        org_id: orgId,
        key_id: keyId,
        requester_user_id: requesterUserId,
      },
      'activateKey'
    );
  }

  /**
   * Rotate a key
   */
  async rotateKey(data: RotateKeyRequest): Promise<RotateKeyResponse> {
    return this.request<RotateKeyResponse>(
      'POST',
      '/keys',
      {
        action: 'rotate',
        org_id: data.orgId,
        requester_user_id: data.requesterUserId,
        reason: data.reason,
        mode: data.mode ?? KeyRotationMode.STAGED,
        grace_period_hours: data.gracePeriodHours ?? 24,
      },
      'rotateKey'
    );
  }

  /**
   * Revoke a key
   */
  async revokeKey(data: RevokeKeyRequest): Promise<AdminResponse> {
    return this.request<AdminResponse>(
      'POST',
      '/keys',
      {
        action: 'revoke',
        org_id: data.orgId,
        key_id: data.keyId,
        reason: data.reason,
        requester_user_id: data.requesterUserId,
      },
      'revokeKey'
    );
  }

  // ==========================================================================
  // Key Escrow Methods
  // ==========================================================================

  /**
   * Request key escrow
   */
  async requestKeyEscrow(
    data: RequestKeyEscrowRequest
  ): Promise<KeyEscrowResponse> {
    return this.request<KeyEscrowResponse>(
      'POST',
      `/portal/organizations/${data.orgId}/keys/${data.keyId}/escrow`,
      {
        escrow_type: data.escrowType,
        requester_user_id: data.requesterUserId,
      },
      'requestKeyEscrow'
    );
  }

  /**
   * List key escrows for an organization
   */
  async listKeyEscrows(orgId: string): Promise<{ escrows: KeyEscrow[] }> {
    return this.request<{ escrows: KeyEscrow[] }>(
      'GET',
      `/portal/organizations/${orgId}/escrows`,
      undefined,
      'listKeyEscrows'
    );
  }

  /**
   * Request key recovery
   */
  async requestKeyRecovery(
    data: RequestKeyRecoveryRequest
  ): Promise<KeyRecoveryResponse> {
    return this.request<KeyRecoveryResponse>(
      'POST',
      `/portal/organizations/${data.orgId}/keys/${data.keyId}/recovery`,
      {
        escrow_id: data.escrowId,
        reason: data.reason,
        requester_user_id: data.requesterUserId,
      },
      'requestKeyRecovery'
    );
  }

  // ==========================================================================
  // Partner Methods
  // ==========================================================================

  /**
   * Lookup a partner by ID
   */
  async lookupPartner(partnerId: string): Promise<PartnerRecord | null> {
    try {
      const response = await this.request<{
        partner: PartnerRecord;
        found: boolean;
      }>('GET', `/registry/partners/${partnerId}`, undefined, 'lookupPartner');
      return response.found ? response.partner : null;
    } catch (error) {
      if (error instanceof RegistryApiError && error.isNotFound()) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get partner activity
   */
  async getPartnerActivity(
    partnerId: string
  ): Promise<PartnerActivityResponse> {
    return this.request<PartnerActivityResponse>(
      'GET',
      `/admin/partners/${partnerId}/activity`,
      undefined,
      'getPartnerActivity'
    );
  }

  /**
   * List expiring licenses
   */
  async listExpiringLicenses(
    params?: ListExpiringLicensesRequest
  ): Promise<ListExpiringLicensesResponse> {
    const query = params
      ? this.buildQueryString({
          expiring_within_days: params.expiringWithinDays ?? 90,
          include_expired: params.includeExpired,
        })
      : '';
    return this.request<ListExpiringLicensesResponse>(
      'GET',
      `/admin/licenses/expiring${query}`,
      undefined,
      'listExpiringLicenses'
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
      ? this.buildQueryString({
          org_id: filters.orgId,
          start_time: filters.startTime,
          end_time: filters.endTime,
          actor_user_id: filters.actorUserId,
          target_type: filters.targetType,
          target_id: filters.targetId,
          page_size: filters.pageSize,
          page_token: filters.pageToken,
        })
      : '';
    return this.request<PaginatedResponse<AuditEntry>>(
      'GET',
      `/audit${query}`,
      undefined,
      'getAuditLog'
    );
  }

  /**
   * Export audit log
   */
  async exportAuditLog(
    data: ExportAuditLogRequest
  ): Promise<ExportAuditLogResponse> {
    return this.request<ExportAuditLogResponse>(
      'POST',
      '/audit',
      {
        org_id: data.orgId,
        filters: {
          startTime: data.startTime,
          endTime: data.endTime,
          actionTypes: data.actionTypes,
          actorUserIds: data.actorUserIds,
          targetTypes: data.targetTypes,
        },
        format: data.format,
        includeSignatures: data.includeSignatures,
      },
      'exportAuditLog'
    );
  }

  // ==========================================================================
  // Compliance Methods
  // ==========================================================================

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    data: GenerateComplianceReportRequest
  ): Promise<ComplianceReport> {
    return this.request<ComplianceReport>(
      'POST',
      '/portal/compliance/report',
      data,
      'generateComplianceReport'
    );
  }

  // ==========================================================================
  // Webhook Methods
  // ==========================================================================

  /**
   * List webhooks
   */
  async listWebhooks(): Promise<ListWebhooksResponse> {
    return this.request<ListWebhooksResponse>(
      'GET',
      '/admin/webhooks',
      undefined,
      'listWebhooks'
    );
  }

  /**
   * Register a webhook
   */
  async registerWebhook(data: RegisterWebhookRequest): Promise<AdminResponse> {
    return this.request<AdminResponse>(
      'POST',
      '/admin/webhooks',
      data,
      'registerWebhook'
    );
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId: string): Promise<AdminResponse> {
    return this.request<AdminResponse>(
      'DELETE',
      `/admin/webhooks/${webhookId}`,
      undefined,
      'deleteWebhook'
    );
  }
}

// ============================================================================
// Default Client Instance
// ============================================================================

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
