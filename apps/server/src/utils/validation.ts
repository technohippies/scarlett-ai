import { z } from 'zod';

// Common validation schemas
export const uuidSchema = z.string().uuid();
export const emailSchema = z.string().email();
export const walletAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

// Audio validation
export const audioFileSchema = z
  .instanceof(File)
  .refine((file) => file.size <= 10 * 1024 * 1024, {
    message: 'File size must be less than 10MB',
  })
  .refine(
    (file) => ['audio/wav', 'audio/webm', 'audio/mp3'].includes(file.type),
    {
      message: 'Invalid audio format',
    }
  );

// Pagination schemas
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// Session schemas
export const createSessionSchema = z.object({
  trackId: z.string().min(1),
  songData: z.object({
    title: z.string().min(1),
    artist: z.string().min(1),
    geniusId: z.string().optional(),
    duration: z.number().optional(),
  }),
});

export const gradeAudioSchema = z.object({
  sessionId: uuidSchema,
  lineIndex: z.number().min(0),
  audioData: z.string().min(1), // base64 encoded
  expectedText: z.string().min(1),
  attemptNumber: z.number().min(1),
});

// Song schemas
export const songQuerySchema = z.object({
  title: z.string().optional(),
  artist: z.string().optional(),
});

// Tutor schemas
export const tutorAnalysisSchema = z.object({
  overallScore: z.number().min(0).max(100),
  grade: z.string(),
  songTitle: z.string(),
  artistName: z.string(),
  lineResults: z.array(
    z.object({
      expectedText: z.string(),
      transcribedText: z.string(),
      score: z.number(),
      spoken: z.boolean(),
    })
  ),
});

export const tutorTtsSchema = z.object({
  text: z.string().min(1).max(1000),
  voice: z
    .enum([
      'Rachel',
      'Domi',
      'Bella',
      'Antoni',
      'Elli',
      'Josh',
      'Arnold',
      'Adam',
      'Sam',
    ])
    .default('Rachel'),
  model: z.string().default('eleven_turbo_v2.5'),
});

// Helper function to validate request body
export async function validateRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<T> {
  const body = await request.json();
  return schema.parse(body);
}

// Helper function to validate query params
export function validateQueryParams<T>(
  url: URL,
  schema: z.ZodSchema<T>
): T {
  const params = Object.fromEntries(url.searchParams);
  return schema.parse(params);
}