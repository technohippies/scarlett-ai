import type { ApiClient } from '../client';

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  provider?: string;
}

export class STTEndpoint {
  constructor(private client: ApiClient) {}

  /**
   * Transcribe audio using speech-to-text
   */
  async transcribe(
    audioBase64: string,
    expectedText?: string,
    preferDeepgram = false
  ): Promise<TranscriptionResult> {
    const response = await this.client.transcribeAudio({
      audioBase64,
      expectedText,
      preferDeepgram,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to transcribe audio');
    }

    return response.data;
  }

  /**
   * Transcribe with retry logic
   */
  async transcribeWithRetry(
    audioBase64: string,
    expectedText?: string,
    maxRetries = 2
  ): Promise<TranscriptionResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Try ElevenLabs first
        const result = await this.transcribe(
          audioBase64,
          expectedText,
          false
        );
        return result;
      } catch (error) {
        lastError = error as Error;
        console.log(`[STT] Attempt ${attempt}/${maxRetries} failed:`, error);

        // If first attempt failed, try with Deepgram
        if (attempt === 1) {
          try {
            console.log('[STT] Retrying with Deepgram...');
            const result = await this.transcribe(
              audioBase64,
              expectedText,
              true
            );
            return result;
          } catch (deepgramError) {
            lastError = deepgramError as Error;
            console.error('[STT] Deepgram also failed:', deepgramError);
          }
        }
      }
    }

    throw lastError || new Error('STT failed after retries');
  }
}