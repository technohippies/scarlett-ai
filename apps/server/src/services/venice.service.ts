import type { Env } from '../types';

interface VeniceMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface VeniceResponse {
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

export class VeniceService {
  private baseUrl = 'https://api.venice.ai/api/v1';
  private defaultModel = 'llama-3.3-70b';

  constructor(private apiKey: string) {}

  async chat(messages: VeniceMessage[], temperature = 0.7): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Venice API key not configured');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.defaultModel,
        messages,
        temperature,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Venice API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as VeniceResponse;
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response from Venice AI');
    }

    return content;
  }

  async streamChat(
    messages: VeniceMessage[],
    onChunk: (chunk: string) => void,
    temperature = 0.7
  ): Promise<void> {
    if (!this.apiKey) {
      throw new Error('Venice API key not configured');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        model: this.defaultModel,
        messages,
        temperature,
        max_tokens: 1000,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Venice API error: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
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
              const chunk = parsed.choices[0]?.delta?.content;
              if (chunk) {
                onChunk(chunk);
              }
            } catch (e) {
              console.error('Failed to parse SSE chunk:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // Helper method for single prompts
  async complete(prompt: string, systemPrompt?: string): Promise<string> {
    const messages: VeniceMessage[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    return this.chat(messages);
  }
}

// Factory function
export function createVeniceService(env: Env): VeniceService | null {
  if (!env.VENICE_API_KEY) {
    console.warn('[Venice] No API key configured');
    return null;
  }
  return new VeniceService(env.VENICE_API_KEY);
}