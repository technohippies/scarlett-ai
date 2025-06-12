import type { ApiClient } from '../client';
import type { Exercise, PracticeCard } from '@scarlett/core';

export class PracticeEndpoint {
  constructor(private client: ApiClient) {}

  /**
   * Get practice exercises for a user
   */
  async getExercises(
    sessionId?: string,
    limit = 10
  ): Promise<{ exercises: Exercise[]; cards: PracticeCard[] }> {
    const response = await this.client.getPracticeExercises(sessionId, limit);

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch exercises');
    }

    return response.data;
  }

  /**
   * Submit a practice review
   */
  async submitReview(
    cardId: string,
    score: number,
    reviewTime: string = new Date().toISOString()
  ): Promise<void> {
    const response = await this.client.submitPracticeReview(
      cardId,
      score,
      reviewTime
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to submit review');
    }
  }
}