/**
 * Speech-to-Text Service
 *
 * Handles integrations with STT providers:
 * - Deepgram
 * - ElevenLabs
 */

export interface WordTiming {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

export interface TranscriptionResult {
  transcript: string;
  words: WordTiming[];
  confidence: number;
  provider: 'deepgram' | 'elevenlabs';
}

export interface ElevenLabsWord {
  text: string;
  type: 'word' | 'spacing' | 'punctuation';
  logprob?: number;
  start: number;
  end: number;
  speaker_id?: string;
}

export interface ElevenLabsResponse {
  language_code: string;
  language_probability: number;
  text: string;
  words: ElevenLabsWord[];
}

export interface ForcedAlignmentWord {
  text: string;
  start: number;
  end: number;
}

export interface ForcedAlignmentResponse {
  characters: ForcedAlignmentWord[];
  words: ForcedAlignmentWord[];
}

/**
 * Transcribe audio using Deepgram
 */
export async function transcribeWithDeepgram(
  audioBuffer: Uint8Array,
  expectedText: string,
  apiKey: string
): Promise<TranscriptionResult> {
  console.log(
    '[Deepgram] Transcribing audio:',
    audioBuffer.byteLength,
    'bytes'
  );

  // Extract keywords from expected text for better recognition
  const keywords = expectedText
    .split(' ')
    .filter((word) => word.length > 3)
    .filter((word, index, arr) => arr.indexOf(word) === index)
    .slice(0, 15);

  console.log('[Deepgram] Using keywords:', keywords);

  const params = new URLSearchParams({
    model: 'nova-2',
    smart_format: 'true',
    punctuate: 'false',
    diarize: 'false',
    language: 'en',
    detect_language: 'false',
    keywords: keywords.join(','),
  });

  const response = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'audio/wav',
    },
    body: audioBuffer,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Deepgram API error: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const result = (await response.json()) as any;

  // Extract transcript and word timings
  let transcript = '';
  const words: WordTiming[] = [];
  let totalConfidence = 0;
  let wordCount = 0;

  if (result.results?.channels?.[0]?.alternatives?.[0]) {
    const alternative = result.results.channels[0].alternatives[0];
    transcript = alternative.transcript || '';

    if (alternative.words) {
      for (const word of alternative.words) {
        words.push({
          word: word.word,
          start: word.start,
          end: word.end,
          confidence: word.confidence || 0,
        });
        totalConfidence += word.confidence || 0;
        wordCount++;
      }
    }
  }

  const averageConfidence = wordCount > 0 ? totalConfidence / wordCount : 0;

  return {
    transcript,
    words,
    confidence: averageConfidence,
    provider: 'deepgram',
  };
}

/**
 * Transcribe audio using ElevenLabs
 */
export async function transcribeWithElevenLabs(
  audioBlob: Blob,
  apiKey: string,
  options?: {
    languageCode?: string;
    tagAudioEvents?: boolean;
    diarize?: boolean;
  }
): Promise<TranscriptionResult> {
  console.log('[ElevenLabs] Transcribing audio:', audioBlob.size, 'bytes');

  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.wav');
  formData.append('model_id', 'scribe_v1');

  if (options?.languageCode) {
    formData.append('language_code', options.languageCode);
  }
  if (options?.tagAudioEvents !== undefined) {
    formData.append('tag_audio_events', String(options.tagAudioEvents));
  }
  if (options?.diarize !== undefined) {
    formData.append('diarize', String(options.diarize));
  }

  const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `ElevenLabs API error: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const result = (await response.json()) as ElevenLabsResponse;

  // Convert ElevenLabs format to our standard format
  const words: WordTiming[] = result.words
    .filter((w) => w.type === 'word')
    .map((w) => ({
      word: w.text,
      start: w.start,
      end: w.end,
      confidence: w.logprob ? Math.exp(w.logprob) : 0.5, // Convert log probability
    }));

  const averageConfidence = result.language_probability || 0.5;

  return {
    transcript: result.text,
    words,
    confidence: averageConfidence,
    provider: 'elevenlabs',
  };
}

/**
 * Get raw ElevenLabs response for session grading
 */
export async function transcribeWithElevenLabsRaw(
  audioBlob: Blob,
  apiKey: string,
  options?: {
    languageCode?: string;
    tagAudioEvents?: boolean;
    diarize?: boolean;
  }
): Promise<ElevenLabsResponse> {
  console.log(
    '[ElevenLabs] Transcribing audio (raw):',
    audioBlob.size,
    'bytes'
  );

  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.wav');
  formData.append('model_id', 'scribe_v1');

  if (options?.languageCode) {
    formData.append('language_code', options.languageCode);
  }
  if (options?.tagAudioEvents !== undefined) {
    formData.append('tag_audio_events', String(options.tagAudioEvents));
  }
  if (options?.diarize !== undefined) {
    formData.append('diarize', String(options.diarize));
  }

  const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `ElevenLabs API error: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const result = (await response.json()) as ElevenLabsResponse;
  return result;
}

/**
 * Perform forced alignment using ElevenLabs
 */
export async function performForcedAlignment(
  audioBlob: Blob,
  text: string,
  apiKey: string
): Promise<ForcedAlignmentResponse> {
  console.log(
    '[ElevenLabs] Performing forced alignment:',
    audioBlob.size,
    'bytes, text length:',
    text.length
  );

  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.wav');
  formData.append('text', text);

  const response = await fetch(
    'https://api.elevenlabs.io/v1/forced-alignment',
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `ElevenLabs Forced Alignment error: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const result = (await response.json()) as ForcedAlignmentResponse;

  console.log(
    `[ElevenLabs] Forced alignment complete: ${result.words.length} words aligned`
  );

  return result;
}

/**
 * Transcribe audio with fallback support
 */
export async function transcribeAudio(
  audioData: Uint8Array | Blob,
  options: {
    expectedText?: string;
    deepgramApiKey?: string;
    elevenlabsApiKey?: string;
    preferredProvider?: 'deepgram' | 'elevenlabs';
  }
): Promise<TranscriptionResult> {
  const {
    expectedText = '',
    deepgramApiKey,
    elevenlabsApiKey,
    preferredProvider = 'deepgram',
  } = options;

  // Convert Uint8Array to Blob if needed
  const audioBlob =
    audioData instanceof Blob
      ? audioData
      : new Blob([audioData], { type: 'audio/wav' });

  // Try preferred provider first
  if (preferredProvider === 'elevenlabs' && elevenlabsApiKey) {
    try {
      return await transcribeWithElevenLabs(audioBlob, elevenlabsApiKey, {
        languageCode: 'en',
        tagAudioEvents: false,
      });
    } catch (error) {
      console.error('[STT] ElevenLabs failed, trying fallback:', error);
      if (deepgramApiKey) {
        const audioBuffer = new Uint8Array(await audioBlob.arrayBuffer());
        return await transcribeWithDeepgram(
          audioBuffer,
          expectedText,
          deepgramApiKey
        );
      }
      throw error;
    }
  }

  // Try Deepgram first (default)
  if (deepgramApiKey) {
    try {
      const audioBuffer =
        audioData instanceof Uint8Array
          ? audioData
          : new Uint8Array(await audioBlob.arrayBuffer());
      return await transcribeWithDeepgram(
        audioBuffer,
        expectedText,
        deepgramApiKey
      );
    } catch (error) {
      console.error('[STT] Deepgram failed, trying fallback:', error);
      if (elevenlabsApiKey) {
        return await transcribeWithElevenLabs(audioBlob, elevenlabsApiKey, {
          languageCode: 'en',
          tagAudioEvents: false,
        });
      }
      throw error;
    }
  }

  // Try ElevenLabs if no Deepgram key
  if (elevenlabsApiKey) {
    return await transcribeWithElevenLabs(audioBlob, elevenlabsApiKey, {
      languageCode: 'en',
      tagAudioEvents: false,
    });
  }

  throw new Error('No STT API keys provided');
}
