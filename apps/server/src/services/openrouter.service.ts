import type { Env } from '../types';

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterResponse {
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

export class OpenRouterService {
  private baseUrl = 'https://openrouter.ai/api/v1';
  private defaultModel = 'google/gemini-2.5-flash-preview-05-20';

  constructor(private apiKey: string) {}

  async translate(text: string, targetLanguage: string, sourceLanguage?: string): Promise<string> {
    const systemPrompt = `You are a professional translator. Translate the following text ${
      sourceLanguage ? `from ${sourceLanguage} ` : ''
    }to ${targetLanguage}. Provide only the translation without any explanations or additional text.`;

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ];

    return this.chat(messages, 0.3);
  }

  async streamTranslate(
    text: string,
    targetLanguage: string,
    onChunk: (chunk: string) => void,
    sourceLanguage?: string
  ): Promise<void> {
    console.log('[OpenRouter] Starting translation', {
      text: text.substring(0, 50) + '...',
      targetLanguage,
      sourceLanguage,
      timestamp: new Date().toISOString()
    });

    const systemPrompt = `You are a professional translator. Translate the following text ${
      sourceLanguage ? `from ${sourceLanguage} ` : ''
    }to ${targetLanguage}. Provide only the translation without any explanations or additional text.`;

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ];

    return this.streamChat(messages, onChunk, 0.3);
  }

  async chat(messages: OpenRouterMessage[], temperature = 0.7): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'scarlett-ai.com',
        'X-Title': 'Scarlett AI',
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
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as OpenRouterResponse;
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response from OpenRouter');
    }

    return content;
  }

  async streamChat(
    messages: OpenRouterMessage[],
    onChunk: (chunk: string) => void,
    temperature = 0.7
  ): Promise<void> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    console.log('[OpenRouter] Making API call', {
      model: this.defaultModel,
      temperature,
      messagesCount: messages.length,
      timestamp: new Date().toISOString()
    });

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'scarlett-ai.com',
        'X-Title': 'Scarlett AI',
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
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
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
    const messages: OpenRouterMessage[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    return this.chat(messages);
  }
}

// Factory function
export function createOpenRouterService(env: Env): OpenRouterService | null {
  if (!env.OPENROUTER_API_KEY) {
    console.warn('[OpenRouter] No API key configured');
    return null;
  }
  return new OpenRouterService(env.OPENROUTER_API_KEY);
}