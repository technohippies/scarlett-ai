import { createSignal, createMemo } from 'solid-js';
import type { KaraokeData, KaraokeSession, LineScore, WordTiming } from '@scarlett/core';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'no-karaoke';

export function createKaraokeStore() {
  const [karaokeData, setKaraokeData] = createSignal<KaraokeData | null>(null);
  const [currentSession, setCurrentSession] = createSignal<KaraokeSession | null>(null);
  const [connectionStatus, setConnectionStatus] = createSignal<ConnectionStatus>('disconnected');
  const [isKaraokeActive, setIsKaraokeActive] = createSignal(false);
  
  const [isRecording, setIsRecording] = createSignal(false);
  const [currentRecordingLine, setCurrentRecordingLine] = createSignal<number | undefined>();
  
  const [lineScores, setLineScores] = createSignal<Map<number, LineScore>>(new Map());
  const [totalScore, setTotalScore] = createSignal(0);
  const [currentMultiplier, setCurrentMultiplier] = createSignal(1);
  const [streakCount, setStreakCount] = createSignal(0);
  const [completedLines, setCompletedLines] = createSignal(0);
  
  const [currentWordFeedback, setCurrentWordFeedback] = createSignal<{
    wordTimings?: WordTiming[];
    wordScores?: Array<{ expected: string; transcribed: string; score: number }>;
  } | null>(null);
  
  const performanceScore = createMemo(() => {
    const completed = completedLines();
    const total = karaokeData()?.lyrics?.total_lines || 0;
    
    if (completed === 0 || total === 0) return 0;
    
    const avgScore = totalScore() / completed;
    const completionBonus = (completed / total) * 20;
    
    return Math.min(100, avgScore + completionBonus);
  });
  
  const performanceState = createMemo(() => {
    const score = performanceScore();
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'average';
    return 'needs-practice';
  });
  
  const updateLineScore = (lineIndex: number, score: LineScore) => {
    const previousScore = lineScores().get(lineIndex);
    const newLineScores = new Map(lineScores());
    newLineScores.set(lineIndex, score);
    setLineScores(newLineScores);
    
    const scoreWithMultiplier = Math.round(score.score * currentMultiplier());
    
    if (!previousScore) {
      setTotalScore((prev) => prev + scoreWithMultiplier);
      setCompletedLines((prev) => prev + 1);
      
      if (score.score >= 85) {
        setStreakCount((prev) => prev + 1);
        if (streakCount() >= 3) {
          setCurrentMultiplier(Math.min(currentMultiplier() + 0.5, 3));
        }
      } else {
        setStreakCount(0);
        setCurrentMultiplier(1);
      }
    } else {
      const previousScoreWithMultiplier = Math.round(previousScore.score);
      setTotalScore((prev) => prev - previousScoreWithMultiplier + scoreWithMultiplier);
    }
    
    if (score.wordTimings || score.wordScores) {
      setCurrentWordFeedback({
        wordTimings: score.wordTimings,
        wordScores: score.wordScores,
      });
      
      setTimeout(() => {
        setCurrentWordFeedback(null);
      }, 3000);
    }
  };
  
  const resetScoring = () => {
    setLineScores(new Map());
    setTotalScore(0);
    setCurrentMultiplier(1);
    setStreakCount(0);
    setCompletedLines(0);
    setCurrentWordFeedback(null);
  };
  
  return {
    karaokeData,
    setKaraokeData,
    currentSession,
    setCurrentSession,
    connectionStatus,
    setConnectionStatus,
    isKaraokeActive,
    setIsKaraokeActive,
    
    isRecording,
    setIsRecording,
    currentRecordingLine,
    setCurrentRecordingLine,
    
    lineScores,
    totalScore,
    currentMultiplier,
    streakCount,
    completedLines,
    performanceScore,
    performanceState,
    
    currentWordFeedback,
    
    updateLineScore,
    resetScoring,
  };
}