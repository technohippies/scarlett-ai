export interface SilenceDetectorConfig {
  silenceThreshold?: number; // Default -50 dB
  silenceDuration?: number; // Default 1500ms
  minRecordingDuration?: number; // Default 500ms
}

export class SimpleSilenceDetector {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  
  private silenceStartTime: number | null = null;
  private recordingStartTime: number | null = null;
  private checkInterval: number | null = null;
  private isStopCalled: boolean = false;
  
  private config: Required<SilenceDetectorConfig>;
  
  constructor(config: SilenceDetectorConfig = {}) {
    this.config = {
      silenceThreshold: config.silenceThreshold ?? -40, // Adjusted for better detection
      silenceDuration: config.silenceDuration ?? 1500,
      minRecordingDuration: config.minRecordingDuration ?? 500
    };
  }
  
  async startRecording(
    onSilenceDetected: (audioBlob: Blob) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    try {
      // Reset stop flag
      this.isStopCalled = false;
      
      // Get user media
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // Setup audio context for analysis
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;
      
      this.microphone = this.audioContext.createMediaStreamSource(this.stream);
      this.microphone.connect(this.analyser);
      
      // Setup media recorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';
        
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
      this.audioChunks = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      
      this.mediaRecorder.onstop = () => {
        if (!this.isStopCalled) {
          this.isStopCalled = true;
          const audioBlob = new Blob(this.audioChunks, { type: mimeType });
          onSilenceDetected(audioBlob);
        }
      };
      
      // Start recording
      this.mediaRecorder.start();
      this.recordingStartTime = Date.now();
      
      // Start monitoring audio levels
      this.startSilenceDetection(onSilenceDetected);
      
      console.log('[SilenceDetector] Recording started');
    } catch (error) {
      console.error('[SilenceDetector] Failed to start recording:', error);
      onError?.(error as Error);
      throw error;
    }
  }
  
  private startSilenceDetection(onSilenceDetected: (audioBlob: Blob) => void) {
    const bufferLength = this.analyser!.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    
    this.checkInterval = window.setInterval(() => {
      if (!this.analyser || !this.mediaRecorder || this.isStopCalled) return;
      
      // Use time domain data for better speech detection
      this.analyser.getByteTimeDomainData(dataArray);
      
      // Calculate RMS (Root Mean Square) for better volume detection
      let sumSquares = 0;
      for (let i = 0; i < bufferLength; i++) {
        const normalized = (dataArray[i] - 128) / 128; // Normalize to -1 to 1
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / bufferLength);
      const decibels = 20 * Math.log10(rms);
      
      const isSilent = decibels < this.config.silenceThreshold || rms < 0.01;
      const now = Date.now();
      
      if (isSilent) {
        if (!this.silenceStartTime) {
          this.silenceStartTime = now;
          console.log('[SilenceDetector] Silence detected, waiting for duration...');
        } else if (now - this.silenceStartTime >= this.config.silenceDuration) {
          // Check if we've recorded for minimum duration
          if (now - this.recordingStartTime! >= this.config.minRecordingDuration) {
            console.log('[SilenceDetector] Silence duration reached, stopping recording');
            this.stopRecording();
          }
        }
      } else {
        // Reset silence timer if sound detected
        if (this.silenceStartTime) {
          console.log('[SilenceDetector] Sound detected, resetting silence timer');
          this.silenceStartTime = null;
        }
      }
    }, 100); // Check every 100ms
  }
  
  stopRecording() {
    console.log('[SilenceDetector] Stopping recording');
    
    // Clear interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    // Stop media recorder
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    
    // Stop all tracks
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    
    // Clean up audio context
    if (this.audioContext) {
      this.audioContext.close();
    }
    
    // Clean up
    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.stream = null;
    this.mediaRecorder = null;
    this.silenceStartTime = null;
    this.recordingStartTime = null;
  }
  
  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }
}