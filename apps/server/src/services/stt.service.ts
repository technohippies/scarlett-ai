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
  private readonly ELEVENLABS_TIMEOUT = 5000; // 5 seconds timeout for ElevenLabs
  private readonly DEEPGRAM_TIMEOUT = 10000; // 10 seconds timeout for Deepgram
  
  constructor(private env: Env) {}

  async transcribeAudio(
    audioData: Uint8Array,
    expectedText?: string
  ): Promise<TranscriptionResult> {
    const errors: Array<{ service: string; error: any }> = [];
    
    // Try Deepgram first since it's faster
    if (this.env.DEEPGRAM_API_KEY) {
      try {
        console.log('[STT] Trying Deepgram first (faster)');
        const result = await this.withTimeout(
          this.transcribeWithDeepgram(audioData, expectedText),
          this.DEEPGRAM_TIMEOUT,
          'Deepgram timeout'
        );
        console.log('[STT] Deepgram succeeded');
        return result;
      } catch (error) {
        console.error('[STT] Deepgram error:', error);
        errors.push({ service: 'Deepgram', error });
      }
    }
    
    // Fallback to ElevenLabs if Deepgram fails
    if (this.env.ELEVENLABS_API_KEY) {
      try {
        console.log('[STT] Falling back to ElevenLabs with timeout of', this.ELEVENLABS_TIMEOUT, 'ms');
        const result = await this.withTimeout(
          this.transcribeWithElevenLabs(audioData),
          this.ELEVENLABS_TIMEOUT,
          'ElevenLabs timeout'
        );
        console.log('[STT] ElevenLabs succeeded');
        return result;
      } catch (error) {
        console.error('[STT] ElevenLabs error:', error);
        errors.push({ service: 'ElevenLabs', error });
        
        // If it was a timeout, log that specifically
        if (error instanceof Error && error.message.includes('timeout')) {
          console.log('[STT] ElevenLabs timed out');
        }
      }
    }


    // If all services failed, throw a descriptive error
    const errorSummary = errors.map(e => `${e.service}: ${e.error.message || e.error}`).join('; ');
    throw new Error(`All STT services failed: ${errorSummary}`);
  }
  
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    });
    
    return Promise.race([promise, timeoutPromise]);
  }
  
  // Public method for direct Deepgram access when preferred
  async transcribeWithDeepgramDirect(
    audioData: Uint8Array,
    expectedText?: string
  ): Promise<TranscriptionResult> {
    return this.withTimeout(
      this.transcribeWithDeepgram(audioData, expectedText),
      this.DEEPGRAM_TIMEOUT,
      'Deepgram timeout'
    );
  }

  private async transcribeWithDeepgram(
    audioData: Uint8Array,
    expectedText?: string
  ): Promise<TranscriptionResult> {
    const params = new URLSearchParams({
      model: 'nova-2',
      smart_format: 'true',
      detect_language: 'false',
      language: 'en-US', // Explicitly set to US English
      punctuate: 'true',
      profanity_filter: 'false',
      alternatives: '1',
    });
    

    // Add keywords for better accuracy with intensifiers
    if (expectedText) {
      const keywords = this.extractKeywords(expectedText);
      if (keywords.length > 0) {
        // Add keywords with moderate intensifier for better recognition
        const keywordsWithIntensifier = keywords.map(k => `${k}:2`).join(',');
        params.append('keywords', keywordsWithIntensifier);
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
    
    // Log if transcript seems to be in a different language
    const transcript = alternative.transcript;
    if (transcript && /[äöüßÄÖÜ]/.test(transcript)) {
      console.warn('[STT] Deepgram returned what appears to be German text:', transcript);
      console.warn('[STT] Expected text was:', expectedText);
    }

    return {
      transcript: this.cleanTranscript(alternative.transcript),
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

    const result = await response.json() as { text?: string; confidence?: number; };
    return {
      transcript: this.cleanTranscript(result.text || ''),
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

    const result = await response.json() as { words?: Array<{ word: string; start: number; end: number; }> };
    return {
      words: (result.words || []).map(word => ({ ...word, confidence: 1.0 })),
    };
  }

  private extractKeywords(text: string): string[] {
    // Extract important words for Deepgram keyword priming
    const words = text
      .toLowerCase()
      .replace(/[^\w\s'-]/g, '') // Keep apostrophes and hyphens for slang
      .split(/\s+/)
      .filter((word) => word.length > 2); // Allow shorter words for slang

    // Remove common words but keep music/slang terms
    const commonWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can',
      'her', 'was', 'one', 'our', 'out', 'day', 'with', 'have', 'from',
      'that', 'this', 'what', 'when', 'where', 'who', 'why', 'how',
    ]);

    // Keep all words that aren't common, including slang
    const keywords = words.filter((word) => !commonWords.has(word));
    
    // Add common music slang patterns
    const slangPatterns = [];
    if (text.includes("'")) {
      // Add contracted forms like "hurtin'", "lovin'"
      const contractions = text.match(/\w+'/g);
      if (contractions) {
        slangPatterns.push(...contractions.map(c => c.toLowerCase()));
      }
    }

    // Return unique keywords, limited to 20 for better coverage
    return [...new Set([...keywords, ...slangPatterns])].slice(0, 20);
  }
  
  private cleanTranscript(transcript: string): string {
    // Remove common STT artifacts and background descriptions
    return transcript
      .replace(/\([^)]*\)/g, '') // Remove parenthetical descriptions like (music), (chanting)
      .replace(/\[[^\]]*\]/g, '') // Remove bracketed descriptions
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }
}