import { BaseResource } from './base';
import type {
  MultiSourceDSARRequest,
  MultiSourceDSARResponse,
  MultiSourceDSARStatusResponse,
  PartialResultsResponse,
  DSARListResponse,
} from '../types/dsar';

export class DSARMultiSourceResource extends BaseResource {
  /**
   * Submit a multi-source DSAR request
   */
  async submitMultiSource(
    data: MultiSourceDSARRequest
  ): Promise<MultiSourceDSARResponse> {
    return this.transport.post('/v1/dsar/multi-source', data);
  }

  /**
   * Get status of a multi-source DSAR request
   */
  async getStatus(ticketId: string): Promise<MultiSourceDSARStatusResponse> {
    return this.transport.get(`/v1/dsar/multi-source/${ticketId}`);
  }

  /**
   * Get partial results from completed sources
   */
  async getPartialResults(ticketId: string): Promise<PartialResultsResponse> {
    return this.transport.get(`/v1/dsar/multi-source/${ticketId}/partial`);
  }

  /**
   * Cancel a DSAR request
   */
  async cancel(ticketId: string): Promise<{ success: boolean }> {
    return this.transport.delete(`/v1/dsar/multi-source/${ticketId}`);
  }

  /**
   * List all DSAR tickets with optional filtering
   */
  async list(params?: {
    page?: number;
    page_size?: number;
    status?: string;
    request_type?: string;
    urgent?: boolean;
  }): Promise<DSARListResponse> {
    return this.transport.get('/v1/dsar/multi-source', params);
  }
}
