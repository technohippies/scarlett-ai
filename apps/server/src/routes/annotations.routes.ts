/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types';
import { createGeniusService } from '../services/genius.service';
import { createOpenRouterService } from '../services/openrouter.service';
import { stream } from 'hono/streaming';

const app = new Hono<{ Bindings: Env }>();

// Fuzzy string matching function
function fuzzyMatch(str1: string, str2: string): number {
  const clean = (s: string) => s.toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .trim();
  
  const s1 = clean(str1);
  const s2 = clean(str2);
  
  // Exact match
  if (s1 === s2) return 1;
  
  // Check if one string contains the other (substring matching)
  // This is crucial for matching Genius fragments within full lyric lines
  if (s1.includes(s2) || s2.includes(s1)) {
    const shorter = s1.length < s2.length ? s1 : s2;
    const longer = s1.length >= s2.length ? s1 : s2;
    
    // High score if the shorter string is a significant portion of the longer one
    const lengthRatio = shorter.length / longer.length;
    
    // Bonus if the match is at the start of the string
    const startsWithBonus = longer.startsWith(shorter) ? 0.1 : 0;
    
    // Base score: 0.7-0.9 depending on length ratio, plus start bonus
    return Math.min(0.7 + (lengthRatio * 0.2) + startsWithBonus, 0.95);
  }
  
  // For partial matches, try to find the best substring alignment
  // This helps when the fragment might have slight variations
  const words1 = s1.split(' ');
  const words2 = s2.split(' ');
  
  // Check for word-level matches
  let matchingWords = 0;
  let totalWords = Math.max(words1.length, words2.length);
  
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1 === word2 && word1.length > 2) { // Ignore very short words
        matchingWords++;
        break;
      }
    }
  }
  
  const wordMatchRatio = totalWords > 0 ? matchingWords / totalWords : 0;
  
  // If we have significant word matches, return a score based on that
  if (wordMatchRatio > 0.5) {
    return wordMatchRatio * 0.8; // Scale to max 0.8 to distinguish from exact/contains matches
  }
  
  // Fall back to Levenshtein distance for remaining cases
  const matrix: number[][] = [];
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  const distance = matrix[s2.length][s1.length];
  const maxLen = Math.max(s1.length, s2.length);
  return maxLen === 0 ? 1 : (maxLen - distance) / maxLen;
}

// Request schema
const annotationRequestSchema = z.object({
  songTitle: z.string(),
  artistName: z.string(),
  lyricLine: z.string(),
  lineIndex: z.number(),
  // Instead of allLyrics, we now accept context lines directly
  contextLines: z.object({
    previous: z.string().nullable().optional(),
    current: z.string(),
    next: z.string().nullable().optional()
  }).optional(),
  // Deprecated - for backward compatibility
  allLyrics: z.array(z.string().nullable()).optional(),
  targetLang: z.string(),
  explanationType: z.enum(['meaning', 'grammar']).optional().default('meaning'),
  geniusSongId: z.number().optional()
});

app.post('/explain', async (c) => {
  console.log('[Annotations] Explain request received');
  
  try {
    const body = await c.req.json();
    console.log('[Annotations] Request body:', JSON.stringify(body, null, 2));
    const result = annotationRequestSchema.safeParse(body);
    
    if (!result.success) {
      console.error('[Annotations] Validation failed:', result.error.errors);
      return c.json({ error: 'Invalid request', details: result.error.errors }, 400);
    }
    
    const { songTitle, artistName, lyricLine, lineIndex, allLyrics, contextLines, targetLang, explanationType, geniusSongId } = result.data;
    
    console.log('[Annotations] Request:', {
      song: `${songTitle} by ${artistName}`,
      line: lyricLine,
      lineIndex,
      targetLang,
      explanationType,
      geniusSongId,
      hasContextLines: !!contextLines,
      hasAllLyrics: !!allLyrics
    });
    
    const geniusService = createGeniusService(c.env);
    let annotations: any[] = [];
    let geniusData: any = null;
    
    // Try to find Genius annotations
    if (geniusSongId) {
      console.log(`[Annotations] Using provided Genius song ID: ${geniusSongId}`);
      try {
        // If we have a Genius song ID, use it directly
        geniusData = await geniusService.getSongById(geniusSongId, true);
        if (geniusData) {
          console.log(`[Annotations] Found song data: ${geniusData.title} by ${geniusData.primary_artist.name}`);
          const referents = await geniusService.getSongReferents(geniusSongId);
          console.log(`[Annotations] Found ${referents.length} referents for song`);
        
        // Log first 10 referents for debugging
        console.log('[Annotations] First 10 referents:');
        referents.slice(0, 10).forEach((r, i) => {
          console.log(`  ${i + 1}. "${r.fragment}" (${r.annotations?.length || 0} annotations)`);
        });
        
        // Find annotations that match our lyric line
        console.log(`[Annotations] Searching for matches for lyric: "${lyricLine}"`);
        
        for (const referent of referents) {
          const similarity = fuzzyMatch(referent.fragment, lyricLine);
          
          // More detailed logging for debugging
          if (referent.fragment.toLowerCase().includes('isotoner') || 
              referent.fragment.toLowerCase().includes('oj') ||
              lyricLine.toLowerCase().includes('isotoner') ||
              lyricLine.toLowerCase().includes('oj')) {
            console.log(`[Annotations] DEBUG - Potential OJ/Isotoner match:`);
            console.log(`  Fragment: "${referent.fragment}"`);
            console.log(`  Lyric: "${lyricLine}"`);
            console.log(`  Similarity: ${similarity}`);
          }
          
          if (similarity > 0.4) {  // Lowered threshold to 0.4 with improved matching algorithm
            console.log(`[Annotations] Match found: "${referent.fragment}" (similarity: ${similarity})`);
            console.log(`[Annotations] Annotation preview: ${referent.annotations?.[0]?.body?.plain?.substring(0, 100)}...`);
            annotations.push({
              fragment: referent.fragment,
              annotations: referent.annotations,
              similarity
            });
          } else if (similarity > 0.3) {
            // Log near-misses for debugging
            console.log(`[Annotations] Near miss: "${referent.fragment}" (similarity: ${similarity})`);
          }
        }
        
        if (annotations.length === 0) {
          console.log('[Annotations] No matching annotations found for this lyric line');
          // Log some sample fragments for debugging
          const sampleFragments = referents.slice(0, 5).map(r => r.fragment);
          console.log('[Annotations] Sample fragments:', sampleFragments);
        }
        } else {
          console.log('[Annotations] Failed to fetch song data from Genius');
        }
      } catch (error) {
        console.error('[Annotations] Error fetching Genius data:', error);
      }
    } else {
      console.log('[Annotations] No Genius song ID provided, searching by title/artist');
      // Search for the song on Genius
      const searchQuery = `${songTitle} ${artistName}`;
      const matchResult = await geniusService.findSongMatch(searchQuery, '');
      
      if (matchResult.found && matchResult.song) {
        console.log(`[Annotations] Found Genius match: ${matchResult.song.title} (confidence: ${matchResult.confidence})`);
        geniusData = await geniusService.getSongById(matchResult.song.id, true);
        
        if (geniusData) {
          const referents = await geniusService.getSongReferents(matchResult.song.id);
          console.log(`[Annotations] Found ${referents.length} referents`);
          
          // Find matching annotations
          for (const referent of referents) {
            const similarity = fuzzyMatch(referent.fragment, lyricLine);
            if (similarity > 0.4) {  // Lowered threshold to 0.4 with improved matching algorithm
              console.log(`[Annotations] Match found: "${referent.fragment}" (similarity: ${similarity})`);
              annotations.push({
                fragment: referent.fragment,
                annotations: referent.annotations,
                similarity
              });
            }
          }
        }
      }
    }
    
    // Sort by similarity
    annotations.sort((a, b) => b.similarity - a.similarity);
    
    // Prepare context - use contextLines if provided, otherwise fall back to allLyrics
    let context: { previous: string | null; current: string; next: string | null };
    
    if (contextLines) {
      // Use the provided context lines
      context = {
        previous: contextLines.previous || null,
        current: contextLines.current || lyricLine,
        next: contextLines.next || null
      };
    } else if (allLyrics) {
      // Fall back to allLyrics for backward compatibility
      context = {
        previous: lineIndex > 0 && allLyrics[lineIndex - 1] ? allLyrics[lineIndex - 1] : null,
        current: lyricLine,
        next: lineIndex < allLyrics.length - 1 && allLyrics[lineIndex + 1] ? allLyrics[lineIndex + 1] : null
      };
    } else {
      // No context available
      context = {
        previous: null,
        current: lyricLine,
        next: null
      };
    }
    
    // Use OpenRouter to generate explanation
    const openRouterService = createOpenRouterService(c.env);
    
    if (!openRouterService) {
      return c.json({ error: 'AI service not configured' }, 500);
    }
    
    // Build the prompt based on explanation type
    let prompt = '';
    
    if (explanationType === 'grammar') {
      prompt = `You are a language teacher analyzing song lyrics.

Song: "${songTitle}" by ${artistName}
Lyric line: "${lyricLine}"

${targetLang === 'zh' ? '用中文' : targetLang === 'es' ? 'En español' : 'In English'}, provide a VERY BRIEF grammar explanation (2-3 sentences):
- Identify the main grammatical structures
- Explain verb tenses or patterns used
- Note any informal/colloquial grammar

Be concise and educational.`;
    } else {
      // Meaning explanation
      prompt = `You are a music expert explaining song lyrics.

Song: "${songTitle}" by ${artistName}
Lyric line: "${lyricLine}"

Context:
${context.previous ? `Previous: "${context.previous}"` : ''}
Current: "${context.current}"
${context.next ? `Next: "${context.next}"` : ''}

`;

      if (annotations.length > 0) {
        // Include up to 2 most relevant Genius annotations
        const relevantAnnotations = annotations.slice(0, 2);
        prompt += '\nGenius annotations for this line:\n';
        
        console.log(`[Annotations] Including ${relevantAnnotations.length} Genius annotations in prompt`);
        
        for (const annotation of relevantAnnotations) {
          if (annotation.annotations?.[0]?.body?.plain) {
            const annotationText = annotation.annotations[0].body.plain;
            // Include full annotation text up to 500 characters
            const truncatedAnnotation = annotationText.length > 500 
              ? annotationText.substring(0, 500) + '...' 
              : annotationText;
            prompt += `- "${annotation.fragment}": ${truncatedAnnotation}\n`;
            
            console.log(`[Annotations] Added annotation for "${annotation.fragment}"`);
            console.log(`[Annotations] Annotation text (first 200 chars): ${annotationText.substring(0, 200)}...`);
          }
        }
        prompt += '\n';
      } else {
        console.log('[Annotations] No Genius annotations to include in prompt');
      }

      prompt += `
${targetLang === 'zh' ? '用中文' : targetLang === 'es' ? 'En español' : 'In English'}, explain what this line means in the context of the song (2-3 sentences).

Focus on:
- The emotional meaning and intent
- Any metaphors, wordplay, or cultural references
- How it relates to the song's story
${annotations.length > 0 ? '- Build upon the Genius annotations but add your own insights' : ''}

Do NOT translate the lyric. Assume the reader understands the original language. Be direct and concise.`;
    }

    console.log('[Annotations] Sending to AI for explanation');
    console.log('[Annotations] PROMPT:', prompt);
    
    // Stream the response
    return stream(c, async (stream) => {
      c.header('Content-Type', 'text/event-stream');
      c.header('Cache-Control', 'no-cache');
      c.header('Connection', 'keep-alive');
      
      try {
        // Send initial data
        await stream.writeln(`data: ${JSON.stringify({
          type: 'start',
          hasAnnotations: annotations.length > 0,
          geniusUrl: geniusData?.url
        })}\n`);
        
        // Stream the AI response with lower temperature for more focused responses
        let fullResponse = '';
        await openRouterService.streamChat([
          { role: 'user', content: prompt }
        ], (chunk: string) => {
          fullResponse += chunk;
          stream.writeln(`data: ${JSON.stringify({
            type: 'content',
            content: chunk
          })}\n`);
        }, 0.5); // Lower temperature for more focused, concise responses
        
        console.log('[Annotations] FULL RESPONSE:', fullResponse);
        
        // Send completion
        await stream.writeln(`data: ${JSON.stringify({
          type: 'done',
          annotationCount: annotations.length
        })}\n`);
        
      } catch (error) {
        console.error('[Annotations] Stream error:', error);
        await stream.writeln(`data: ${JSON.stringify({
          type: 'error',
          error: 'Failed to generate explanation'
        })}\n`);
      }
    });
    
  } catch (error) {
    console.error('[Annotations] Error:', error);
    return c.json({ 
      error: 'Failed to process annotation request',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;