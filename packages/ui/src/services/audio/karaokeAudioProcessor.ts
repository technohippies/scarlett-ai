import { createSignal, onCleanup } from 'solid-js';
import type { AudioProcessorOptions } from '../../types/karaoke';

export function createKaraokeAudioProcessor(options?: AudioProcessorOptions) {
  const [audioContext, setAudioContext] = createSignal<AudioContext | null>(null);
  const [mediaStream, setMediaStream] = createSignal<MediaStream | null>(null);
  const [audioWorkletNode, setAudioWorkletNode] = createSignal<AudioWorkletNode | null>(null);
  
  const [isReady, setIsReady] = createSignal(false);
  const [error, setError] = createSignal<Error | null>(null);
  const [isListening, setIsListening] = createSignal(false);
  
  const [currentRecordingLine, setCurrentRecordingLine] = createSignal<number | null>(null);
  const [recordedAudioBuffer, setRecordedAudioBuffer] = createSignal<Float32Array[]>([]);
  
  const [isSessionActive, setIsSessionActive] = createSignal(false);
  const [fullSessionBuffer, setFullSessionBuffer] = createSignal<Float32Array[]>([]);
  
  const sampleRate = options?.sampleRate || 16000;
  
  const initialize = async () => {
    if (audioContext()) return;
    setError(null);
    
    try {
      console.log('[KaraokeAudioProcessor] Initializing audio capture...');
      
      const ctx = new AudioContext({ sampleRate });
      setAudioContext(ctx);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      setMediaStream(stream);
      
      await ctx.audioWorklet.addModule(createAudioWorkletProcessor());
      
      const workletNode = new AudioWorkletNode(ctx, 'karaoke-audio-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: 1,
      });
      
      workletNode.port.onmessage = (event) => {
        if (event.data.type === 'audioData') {
          const audioData = new Float32Array(event.data.audioData);
          
          if (currentRecordingLine() !== null) {
            setRecordedAudioBuffer((prev) => [...prev, audioData]);
          }
          
          if (isSessionActive()) {
            setFullSessionBuffer((prev) => [...prev, audioData]);
          }
        }
      };
      
      setAudioWorkletNode(workletNode);
      
      const source = ctx.createMediaStreamSource(stream);
      const gainNode = ctx.createGain();
      gainNode.gain.value = 1.2;
      
      source.connect(gainNode);
      gainNode.connect(workletNode);
      
      setIsReady(true);
      console.log('[KaraokeAudioProcessor] Audio capture initialized successfully.');
    } catch (e) {
      console.error('[KaraokeAudioProcessor] Failed to initialize:', e);
      setError(e instanceof Error ? e : new Error('Unknown audio initialization error'));
      setIsReady(false);
    }
  };
  
  const createAudioWorkletProcessor = () => {
    const processorCode = `
      class KaraokeAudioProcessor extends AudioWorkletProcessor {
        constructor() {
          super();
          this.bufferSize = 1024;
          this.rmsHistory = [];
          this.maxHistoryLength = 10;
        }

        process(inputs, outputs, parameters) {
          const input = inputs[0];
          if (input && input[0]) {
            const inputData = input[0];
            
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) {
              sum += inputData[i] * inputData[i];
            }
            const rms = Math.sqrt(sum / inputData.length);
            
            this.rmsHistory.push(rms);
            if (this.rmsHistory.length > this.maxHistoryLength) {
              this.rmsHistory.shift();
            }
            
            const avgRms = this.rmsHistory.reduce((a, b) => a + b, 0) / this.rmsHistory.length;
            
            this.port.postMessage({
              type: 'audioData',
              audioData: inputData,
              rmsLevel: rms,
              avgRmsLevel: avgRms,
              isTooQuiet: avgRms < 0.01,
              isTooLoud: avgRms > 0.3
            });
          }
          return true;
        }
      }
      registerProcessor('karaoke-audio-processor', KaraokeAudioProcessor);
    `;
    
    const blob = new Blob([processorCode], { type: 'application/javascript' });
    return URL.createObjectURL(blob);
  };
  
  const startListening = () => {
    const ctx = audioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
    setIsListening(true);
    console.log('[KaraokeAudioProcessor] Started listening for audio.');
  };
  
  const pauseListening = () => {
    const ctx = audioContext();
    if (ctx && ctx.state === 'running') {
      ctx.suspend();
    }
    setIsListening(false);
    console.log('[KaraokeAudioProcessor] Paused listening for audio.');
  };
  
  const cleanup = () => {
    console.log('[KaraokeAudioProcessor] Cleaning up audio capture...');
    
    const stream = mediaStream();
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setMediaStream(null);
    }
    
    const ctx = audioContext();
    if (ctx && ctx.state !== 'closed') {
      ctx.close();
      setAudioContext(null);
    }
    
    setAudioWorkletNode(null);
    setIsReady(false);
    setIsListening(false);
    console.log('[KaraokeAudioProcessor] Audio capture cleaned up.');
  };
  
  onCleanup(cleanup);
  
  const startRecordingLine = (lineIndex: number) => {
    console.log(`[KaraokeAudioProcessor] Starting audio capture for line ${lineIndex}`);
    
    setCurrentRecordingLine(lineIndex);
    setRecordedAudioBuffer([]);
    
    if (isReady() && !isListening()) {
      startListening();
    }
  };
  
  const stopRecordingLineAndGetRawAudio = (): Float32Array[] => {
    const lineIndex = currentRecordingLine();
    if (lineIndex === null) {
      console.warn('[KaraokeAudioProcessor] No active recording line.');
      return [];
    }
    
    const audioBuffer = recordedAudioBuffer();
    console.log(`[KaraokeAudioProcessor] Stopping capture for line ${lineIndex}. Collected ${audioBuffer.length} chunks.`);
    
    setCurrentRecordingLine(null);
    
    const result = [...audioBuffer];
    setRecordedAudioBuffer([]);
    
    if (result.length === 0) {
      console.log(`[KaraokeAudioProcessor] No audio captured for line ${lineIndex}.`);
    }
    
    return result;
  };
  
  const convertAudioToWavBlob = (audioChunks: Float32Array[]): Blob | null => {
    if (audioChunks.length === 0) return null;
    
    const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const concatenated = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of audioChunks) {
      concatenated.set(chunk, offset);
      offset += chunk.length;
    }
    
    return audioBufferToWav(concatenated, sampleRate);
  };
  
  const audioBufferToWav = (buffer: Float32Array, sampleRate: number): Blob => {
    const length = buffer.length;
    const arrayBuffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(arrayBuffer);
    
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);
    
    const offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, buffer[i]));
      view.setInt16(offset + i * 2, sample * 0x7fff, true);
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };
  
  const startFullSession = () => {
    console.log('[KaraokeAudioProcessor] Starting full session recording');
    setFullSessionBuffer([]);
    setIsSessionActive(true);
  };
  
  const stopFullSessionAndGetWav = (): Blob | null => {
    console.log('[KaraokeAudioProcessor] Stopping full session recording');
    setIsSessionActive(false);
    
    const sessionChunks = fullSessionBuffer();
    const wavBlob = convertAudioToWavBlob(sessionChunks);
    
    console.log(
      `[KaraokeAudioProcessor] Full session: ${sessionChunks.length} chunks, ` +
        `${wavBlob ? (wavBlob.size / 1024).toFixed(1) + 'KB' : 'null'}`
    );
    
    setFullSessionBuffer([]);
    
    return wavBlob;
  };
  
  return {
    isReady,
    error,
    isListening,
    isSessionActive,
    
    initialize,
    startListening,
    pauseListening,
    cleanup,
    startRecordingLine,
    stopRecordingLineAndGetRawAudio,
    convertAudioToWavBlob,
    
    startFullSession,
    stopFullSessionAndGetWav,
  };
}