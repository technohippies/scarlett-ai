import { ApiClient, type ApiClientConfig } from './client';
import {
  KaraokeEndpoint,
  PracticeEndpoint,
  STTEndpoint,
  AuthEndpoint,
} from './endpoints';

export { ApiClient, type ApiClientConfig };
export * from './endpoints';

/**
 * Create a configured API client with all endpoints
 */
export function createApiClient(config: ApiClientConfig) {
  const client = new ApiClient(config);

  return {
    client,
    karaoke: new KaraokeEndpoint(client),
    practice: new PracticeEndpoint(client),
    stt: new STTEndpoint(client),
    auth: new AuthEndpoint(client),
    
    // Direct access to base methods
    healthCheck: () => client.healthCheck(),
  };
}

export type ScarlettApiClient = ReturnType<typeof createApiClient>;