import { Transport, type TransportOptions } from './transport';
import { DSARMultiSourceResource } from './resources/dsar-multi-source';
import { ConnectorsResource } from './resources/connectors';

export interface CIRISClientOptions extends Partial<TransportOptions> {
  baseURL?: string;
  apiKey?: string;
}

/**
 * Main CIRIS API client
 */
export class CIRISClient {
  private transport: Transport;

  // Resource instances
  public readonly dsarMultiSource: DSARMultiSourceResource;
  public readonly connectors: ConnectorsResource;

  constructor(options: CIRISClientOptions = {}) {
    const baseURL =
      options.baseURL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:8000';
    const apiKey = options.apiKey || process.env.CIRIS_API_KEY;

    this.transport = new Transport({
      baseURL,
      apiKey,
      timeout: options.timeout || 30000,
      headers: options.headers,
    });

    // Initialize resources
    this.dsarMultiSource = new DSARMultiSourceResource(this.transport);
    this.connectors = new ConnectorsResource(this.transport);
  }
}

// Export singleton instance
let clientInstance: CIRISClient | null = null;

export function getCIRISClient(options?: CIRISClientOptions): CIRISClient {
  if (!clientInstance) {
    clientInstance = new CIRISClient(options);
  }
  return clientInstance;
}
