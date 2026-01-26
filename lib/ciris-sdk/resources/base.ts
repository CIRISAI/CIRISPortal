import { Transport } from '../transport';

/**
 * Base class for all API resources
 */
export abstract class BaseResource {
  constructor(protected transport: Transport) {}
}
