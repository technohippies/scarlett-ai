/**
 * Venice AI Integration Service
 * Handles all communication with Venice LLM API
 */

import type { Env } from '../auth';

export interface VeniceMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface VeniceResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const VENICE_API_URL = 'https://api.venice.ai/api/v1/chat/completions';

/**
 * Call Venice AI API with messages
 */
export async function callVeniceAI(
  prompt: string,
  context: string,
  env: Env,
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
  } = {}
): Promise<{ answer: string; usage?: VeniceResponse['usage'] }> {
  const {
    model = 'venice-uncensored',
    temperature = 0.7,
    maxTokens = 500,
    stream = false,
  } = options;

  if (!env.VENICE_API_KEY) {
    throw new Error('VENICE_API_KEY not configured');
  }

  const messages: VeniceMessage[] = [
    {
      role: 'system',
      content:
        'You are Scarlett, a friendly English tutor helping someone improve through karaoke practice. Respond with encouraging, specific feedback in JSON format.',
    },
    {
      role: 'user',
      content: prompt,
    },
  ];

  console.log(`[Venice] Calling API for: ${context}`);

  try {
    const response = await fetch(VENICE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.VENICE_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        stream,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `[Venice] API Error: ${response.status} ${response.statusText}`,
        errorBody
      );
      throw new Error(`Venice API error: ${response.status}`);
    }

    const data = (await response.json()) as VeniceResponse;

    if (!data.choices || data.choices.length === 0) {
      throw new Error('Venice API returned no choices');
    }

    const answer = data.choices[0].message.content;
    console.log(
      `[Venice] Response received (${data.usage?.total_tokens || 0} tokens)`
    );

    return {
      answer,
      usage: data.usage,
    };
  } catch (error) {
    console.error('[Venice] Request failed:', error);
    throw error;
  }
}

/**
 * Stream Venice AI response for real-time TTS
 */
export async function* streamVeniceAI(
  prompt: string,
  context: string,
  env: Env,
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  } = {}
): AsyncGenerator<string, void, unknown> {
  const {
    model = 'venice-uncensored',
    temperature = 0.8,
    maxTokens = 200,
  } = options;

  if (!env.VENICE_API_KEY) {
    throw new Error('VENICE_API_KEY not configured');
  }

  const messages: VeniceMessage[] = [
    {
      role: 'system',
      content:
        'You are Scarlett, providing encouraging coaching. Speak naturally as if giving verbal feedback.',
    },
    {
      role: 'user',
      content: prompt,
    },
  ];

  console.log(`[Venice] Starting stream for: ${context}`);

  const response = await fetch(VENICE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.VENICE_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Venice API error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') {
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
  }
}
