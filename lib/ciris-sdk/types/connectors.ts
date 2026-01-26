/**
 * Connector-related type definitions
 */

export type ConnectorType = 'sql' | 'rest' | 'hl7';
export type DatabaseType = 'postgres' | 'mysql' | 'sqlite' | 'mssql' | 'oracle';
export type AuthType = 'none' | 'basic' | 'bearer' | 'oauth2' | 'api_key';

export interface SQLConnectorConfig {
  connector_name: string;
  database_type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl_enabled?: boolean;
  privacy_schema?: string;
  max_connections?: number;
  timeout_seconds?: number;
}

export interface RESTConnectorConfig {
  connector_name: string;
  base_url: string;
  auth_type: AuthType;
  auth_credentials?: Record<string, string>;
  headers?: Record<string, string>;
  privacy_endpoints?: string;
  timeout_seconds?: number;
}

export interface ConnectorInfo {
  connector_id: string;
  connector_name: string;
  connector_type: ConnectorType;
  status: 'healthy' | 'unhealthy' | 'unknown';
  last_tested?: string;
  last_test_latency_ms?: number;
  created_at: string;
  updated_at: string;
}

export interface ConnectorRegistrationResponse {
  success: boolean;
  data: {
    connector_id: string;
    connector_name: string;
    connector_type: ConnectorType;
  };
}

export interface ConnectorListResponse {
  connectors: ConnectorInfo[];
  total: number;
}

export interface ConnectorTestResult {
  connector_id: string;
  success: boolean;
  latency_ms?: number;
  error_message?: string;
  tested_at: string;
}

export interface ConnectorUpdateRequest {
  connector_name?: string;
  config?: Partial<SQLConnectorConfig | RESTConnectorConfig>;
  privacy_schema?: string;
}
