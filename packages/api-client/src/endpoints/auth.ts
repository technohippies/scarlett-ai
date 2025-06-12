import type { ApiClient } from '../client';
import type {
  UserCreditsResponse,
  PurchaseCreditsRequest,
  PurchaseCreditsResponse,
} from '@scarlett/core';

export class AuthEndpoint {
  constructor(private client: ApiClient) {}

  /**
   * Get a demo authentication token
   */
  async getDemoToken(): Promise<string> {
    return this.client.getDemoToken();
  }

  /**
   * Get current user credits
   */
  async getUserCredits(): Promise<UserCreditsResponse> {
    return this.client.getUserCredits();
  }

  /**
   * Purchase credits
   */
  async purchaseCredits(
    fid: number,
    credits: number,
    chain: 'Base' | 'Solana' = 'Base',
    transactionHash?: string
  ): Promise<PurchaseCreditsResponse> {
    return this.client.purchaseCredits({
      fid,
      credits,
      chain,
      transactionHash,
    });
  }
}