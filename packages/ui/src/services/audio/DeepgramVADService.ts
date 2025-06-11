export interface DeepgramVADConfig {
  apiKey: string;
  utteranceEndMs?: number; // Default 1000ms
  endpointingMs?: number; // Default 300ms
  interimResults?: boolean; // Default true
}

export interface TranscriptResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

export class DeepgramVADService {
  private ws: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private config: DeepgramVADConfig;
  
  // Callbacks
  private onTranscript?: (result: TranscriptResult) => void;
  private onUtteranceEnd?: () => void;
  private onSpeechStarted?: (timestamp: number) => void;
  private onError?: (error: Error) => void;
  
  constructor(config: DeepgramVADConfig) {
    this.config = {
      utteranceEndMs: 1000,
      endpointingMs: 300,
      interimResults: true,
      ...config
    };
  }
  
  async startRecording(
    onTranscript: (result: TranscriptResult) => void,
    onUtteranceEnd: () => void,
    onError?: (error: Error) => void,
    onSpeechStarted?: (timestamp: number) => void
  ): Promise<void> {
    this.onTranscript = onTranscript;
    this.onUtteranceEnd = onUtteranceEnd;
    this.onError = onError;
    this.onSpeechStarted = onSpeechStarted;
    
    try {
      // Get user media
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // Connect to Deepgram WebSocket
      const params = new URLSearchParams({
        model: 'nova-2',
        language: 'en-US',
        smart_format: 'true',
        interim_results: String(this.config.interimResults),
        utterance_end_ms: String(this.config.utteranceEndMs),
        endpointing: String(this.config.endpointingMs),
        vad_events: 'true',
        encoding: 'opus',
        sample_rate: '48000'
      });
      
      const wsUrl = `wss://api.deepgram.com/v1/listen?${params}`;
      this.ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Token ${this.config.apiKey}`
        }
      } as any);
      
      this.ws.onopen = () => {
        console.log('[DeepgramVAD] WebSocket connected');
        this.startMediaRecorder();
      };
      
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleDeepgramMessage(data);
      };
      
      this.ws.onerror = (error) => {
        console.error('[DeepgramVAD] WebSocket error:', error);
        this.onError?.(new Error('WebSocket connection failed'));
      };
      
      this.ws.onclose = () => {
        console.log('[DeepgramVAD] WebSocket closed');
      };
      
    } catch (error) {
      console.error('[DeepgramVAD] Failed to start recording:', error);
      this.onError?.(error as Error);
      throw error;
    }
  }
  
  private startMediaRecorder() {
    if (!this.stream || !this.ws) return;
    
    // Use opus codec for better compression
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
      ? 'audio/webm;codecs=opus' 
      : 'audio/webm';
    
    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType,
      audioBitsPerSecond: 32000 // Low bitrate for speech
    });
    
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(event.data);
      }
    };
    
    // Send audio chunks every 100ms for low latency
    this.mediaRecorder.start(100);
  }
  
  private handleDeepgramMessage(data: any) {
    switch (data.type) {
      case 'Results':
        this.handleTranscript(data);
        break;
        
      case 'UtteranceEnd':
        console.log('[DeepgramVAD] Utterance ended at:', data.last_word_end);
        this.onUtteranceEnd?.();
        // Auto-stop recording when utterance ends
        this.stopRecording();
        break;
        
      case 'SpeechStarted':
        console.log('[DeepgramVAD] Speech started at:', data.timestamp);
        this.onSpeechStarted?.(data.timestamp);
        break;
        
      default:
        // Handle other message types if needed
        break;
    }
  }
  
  private handleTranscript(data: any) {
    const channel = data.channel;
    if (!channel?.alternatives?.[0]) return;
    
    const alternative = channel.alternatives[0];
    const result: TranscriptResult = {
      transcript: alternative.transcript,
      confidence: alternative.confidence,
      isFinal: data.is_final || false,
      words: alternative.words
    };
    
    if (result.transcript) {
      this.onTranscript?.(result);
    }
  }
  
  stopRecording() {
    console.log('[DeepgramVAD] Stopping recording');
    
    // Stop media recorder
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    
    // Close WebSocket
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    
    // Stop all tracks
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    
    // Clean up
    this.mediaRecorder = null;
    this.ws = null;
    this.stream = null;
  }
  
  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }
}