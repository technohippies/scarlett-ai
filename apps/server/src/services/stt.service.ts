import type { Env } from '../types';

interface DeepgramResponse {
  results: {
    channels: Array<{
      alternatives: Array<{
        transcript: string;
        confidence: number;
        words: Array<{
          word: string;
          start: number;
          end: number;
          confidence: number;
        }>;
      }>;
    }>;
  };
}

interface TranscriptionResult {
  transcript: string;
  confidence: number;
  words: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

export class STTService {
  constructor(private env: Env) {}

  async transcribeAudio(
    audioData: Uint8Array,
    expectedText?: string
  ): Promise<TranscriptionResult> {
    // Try Deepgram first (better accuracy)
    if (this.env.DEEPGRAM_API_KEY) {
      try {
        return await this.transcribeWithDeepgram(audioData, expectedText);
      } catch (error) {
        console.error('[STT] Deepgram error, falling back:', error);
      }
    }

    // Fallback to ElevenLabs
    if (this.env.ELEVENLABS_API_KEY) {
      return await this.transcribeWithElevenLabs(audioData);
    }

    throw new Error('No STT service configured');
  }

  private async transcribeWithDeepgram(
    audioData: Uint8Array,
    expectedText?: string
  ): Promise<TranscriptionResult> {
    const params = new URLSearchParams({
      model: 'nova-2',
      smart_format: 'true',
      detect_language: 'false',
      language: 'en-US',
      punctuate: 'true',
      profanity_filter: 'false',
      alternatives: '1',
    });

    // Add keywords for better accuracy
    if (expectedText) {
      const keywords = this.extractKeywords(expectedText);
      if (keywords.length > 0) {
        params.append('keywords', keywords.join(','));
      }
    }

    const response = await fetch(
      `https://api.deepgram.com/v1/listen?${params.toString()}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${this.env.DEEPGRAM_API_KEY}`,
          'Content-Type': 'audio/wav',
        },
        body: audioData,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Deepgram API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as DeepgramResponse;
    const alternative = data.results.channels[0]?.alternatives[0];

    if (!alternative) {
      throw new Error('No transcription available');
    }

    return {
      transcript: alternative.transcript,
      confidence: alternative.confidence,
      words: alternative.words || [],
    };
  }

  private async transcribeWithElevenLabs(
    audioData: Uint8Array
  ): Promise<TranscriptionResult> {
    const formData = new FormData();
    const audioBlob = new Blob([audioData], { type: 'audio/wav' });
    formData.append('file', audioBlob, 'audio.wav');
    formData.append('model_id', 'scribe_v1');
    formData.append('language_code', 'en');

    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': this.env.ELEVENLABS_API_KEY!,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    return {
      transcript: result.text || '',
      confidence: result.confidence || 0,
      words: [], // ElevenLabs doesn't provide word-level timing
    };
  }

  async performForcedAlignment(
    audioBlob: Blob,
    lyricsText: string
  ): Promise<{
    words: Array<{
      word: string;
      start: number;
      end: number;
      confidence: number;
    }>;
  }> {
    if (!this.env.ELEVENLABS_API_KEY) {
      throw new Error('ElevenLabs API key required for forced alignment');
    }

    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.wav');
    formData.append('model_id', 'scribe_v1');
    formData.append('force_alignment', 'true');
    formData.append('transcript', lyricsText);

    const response = await fetch(
      'https://api.elevenlabs.io/v1/speech-to-text/forced-alignment',
      {
        method: 'POST',
        headers: {
          'xi-api-key': this.env.ELEVENLABS_API_KEY,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Forced alignment error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    return {
      words: result.words || [],
    };
  }

  private extractKeywords(text: string): string[] {
    // Extract important words for Deepgram keyword priming
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 3); // Only words longer than 3 chars

    // Remove common words
    const commonWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can',
      'her', 'was', 'one', 'our', 'out', 'day', 'with', 'have', 'from',
    ]);

    const keywords = words.filter((word) => !commonWords.has(word));

    // Return unique keywords, limited to 10
    return [...new Set(keywords)].slice(0, 10);
  }
}