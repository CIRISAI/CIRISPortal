import { BaseResource } from './base';
import type {
  SQLConnectorConfig,
  RESTConnectorConfig,
  ConnectorRegistrationResponse,
  ConnectorListResponse,
  ConnectorInfo,
  ConnectorTestResult,
  ConnectorUpdateRequest,
} from '../types/connectors';

export class ConnectorsResource extends BaseResource {
  /**
   * Register a SQL database connector
   */
  async registerSQL(
    config: SQLConnectorConfig
  ): Promise<ConnectorRegistrationResponse> {
    return this.transport.post('/v1/connectors/sql', {
      connector_type: 'sql',
      config,
    });
  }

  /**
   * Register a REST API connector
   */
  async registerREST(
    config: RESTConnectorConfig
  ): Promise<ConnectorRegistrationResponse> {
    return this.transport.post('/v1/connectors/rest', {
      connector_type: 'rest',
      config,
    });
  }

  /**
   * List all connectors with optional filtering
   */
  async list(params?: {
    connector_type?: string;
    status?: string;
  }): Promise<ConnectorListResponse> {
    return this.transport.get('/v1/connectors', params);
  }

  /**
   * Get connector details
   */
  async get(connectorId: string): Promise<ConnectorInfo> {
    return this.transport.get(`/v1/connectors/${connectorId}`);
  }

  /**
   * Test connector connection
   */
  async test(connectorId: string): Promise<ConnectorTestResult> {
    return this.transport.post(`/v1/connectors/${connectorId}/test`);
  }

  /**
   * Update connector configuration
   */
  async update(
    connectorId: string,
    update: ConnectorUpdateRequest
  ): Promise<{ success: boolean }> {
    return this.transport.patch(`/v1/connectors/${connectorId}`, update);
  }

  /**
   * Delete a connector
   */
  async delete(connectorId: string): Promise<{ success: boolean }> {
    return this.transport.delete(`/v1/connectors/${connectorId}`);
  }
}
