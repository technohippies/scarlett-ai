import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types';
import { createVeniceService } from '../services/venice.service';
import { validateBody } from '../middleware/validation.middleware';
import { streamSSE } from 'hono/streaming';

const app = new Hono<{ 
  Bindings: Env;
  Variables: {
    validatedBody?: Record<string, unknown>;
  };
}>();

// Validation schemas
const translateSchema = z.object({
  text: z.string().min(1).max(1000),
  sourceLang: z.string().optional(),
  targetLang: z.enum(['en', 'es']),
});

const annotateSchema = z.object({
  text: z.string().min(1).max(1000),
  language: z.string().optional(),
});

// POST /lyrics/translate
app.post('/translate', validateBody(translateSchema), async (c) => {
  const data = c.get('validatedBody') as z.infer<typeof translateSchema>;
  const veniceService = createVeniceService(c.env);
  
  if (!veniceService) {
    return c.json({ 
      success: false, 
      error: 'Translation service not available' 
    }, 503);
  }

  try {
    // Prepare the translation prompt
    const targetLangName = data.targetLang === 'es' ? 'Spanish' : 'English';
    const systemPrompt = `You are a professional translator specializing in song lyrics. 
Translate the given lyrics to ${targetLangName}, preserving the meaning, tone, and poetic nature.
Only respond with the translation, no explanations or additional text.`;

    const userPrompt = `Translate this song lyric to ${targetLangName}: "${data.text}"`;

    // Stream the response
    return streamSSE(c, async (stream) => {
      await stream.writeSSE({
        event: 'start',
        data: JSON.stringify({ translating: true }),
      });

      let fullTranslation = '';
      
      await veniceService.streamChat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        (chunk) => {
          fullTranslation += chunk;
          stream.writeSSE({
            event: 'translation',
            data: JSON.stringify({ text: chunk }),
          });
        },
        0.3 // Lower temperature for more accurate translations
      );

      await stream.writeSSE({
        event: 'complete',
        data: JSON.stringify({ 
          translation: fullTranslation,
          targetLang: data.targetLang 
        }),
      });
    });
  } catch (error) {
    console.error('[Lyrics] Translation error:', error);
    return c.json({
      success: false,
      error: 'Translation failed',
    }, 500);
  }
});

// POST /lyrics/annotate
app.post('/annotate', validateBody(annotateSchema), async (c) => {
  const data = c.get('validatedBody') as z.infer<typeof annotateSchema>;
  const veniceService = createVeniceService(c.env);
  
  if (!veniceService) {
    return c.json({ 
      success: false, 
      error: 'Annotation service not available' 
    }, 503);
  }

  try {
    const systemPrompt = `You are a language learning assistant helping ESL students understand song lyrics.
Analyze the given lyric and identify challenging words or phrases that might be difficult for language learners.
For each challenging word/phrase, provide:
1. The word or phrase
2. A simple definition or explanation
3. Pronunciation guide (if helpful)

Format your response as a JSON array of objects with these fields:
- word: the challenging word/phrase
- meaning: simple explanation
- pronunciation: IPA or simple phonetic guide (optional)

Only include 3-5 most important words/phrases. Focus on:
- Slang or colloquial expressions
- Contractions
- Idioms
- Words with multiple meanings
- Cultural references`;

    const userPrompt = `Analyze this song lyric for ESL learners: "${data.text}"`;

    const response = await veniceService.complete(userPrompt, systemPrompt);
    
    // Parse the response as JSON
    let annotations;
    try {
      // Extract JSON from the response (Venice might include extra text)
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        annotations = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('[Lyrics] Failed to parse annotations:', parseError);
      // Fallback to a simple format
      annotations = [{
        word: 'Error',
        meaning: 'Could not parse annotations',
      }];
    }

    return c.json({
      success: true,
      annotations,
    });
  } catch (error) {
    console.error('[Lyrics] Annotation error:', error);
    return c.json({
      success: false,
      error: 'Annotation failed',
    }, 500);
  }
});

export { app as lyricsRoutes };