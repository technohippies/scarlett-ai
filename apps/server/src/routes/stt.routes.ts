import { Hono } from 'hono';
import type { Env } from '../types';
import { STTService } from '../services/stt.service';
import { ValidationError } from '../types';

const app = new Hono<{ Bindings: Env }>();

// POST /api/speech-to-text - General STT endpoint
app.post('/', async (c) => {
  const formData = await c.req.formData();
  const audioFile = formData.get('audio');

  if (!audioFile || typeof audioFile === 'string') {
    throw new ValidationError('No audio file provided');
  }

  const file = audioFile as File;
  
  // Validate file size
  if (file.size > 10 * 1024 * 1024) {
    throw new ValidationError('File size must be less than 10MB');
  }

  const sttService = new STTService(c.env);
  
  try {
    const audioBuffer = new Uint8Array(await file.arrayBuffer());
    const result = await sttService.transcribeAudio(audioBuffer);

    return c.json({
      success: true,
      text: result.transcript,
      confidence: result.confidence,
      provider: c.env.DEEPGRAM_API_KEY ? 'deepgram' : 'elevenlabs',
    });
  } catch (error) {
    console.error('[STT] Transcription error:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to transcribe audio',
        text: null,
      },
      500
    );
  }
});

export default app;