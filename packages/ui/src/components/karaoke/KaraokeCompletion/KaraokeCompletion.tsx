import { Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import { Button } from '../../common/Button';
import { Card } from '../../common/Card';
import { ProgressBar } from '../../common/ProgressBar';
import type { SessionResults } from '../../../types/karaoke';
import styles from './KaraokeCompletion.module.css';

export interface KaraokeCompletionProps {
  overallScore: number;
  song: {
    title: string;
    artist: string;
  };
  lineResults: SessionResults['lineResults'];
  isAnalyzing: boolean;
  isNewBestScore: boolean;
  onTryAgain?: () => void;
}

export const KaraokeCompletion: Component<KaraokeCompletionProps> = (props) => {
  const getGrade = (score: number): string => {
    if (score >= 95) return 'S';
    if (score >= 90) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 80) return 'B+';
    if (score >= 75) return 'B';
    if (score >= 70) return 'C+';
    if (score >= 65) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  };

  const getGradeColor = (grade: string): string => {
    switch (grade) {
      case 'S': return '#FFD700';
      case 'A+':
      case 'A': return '#4CAF50';
      case 'B+':
      case 'B': return '#2196F3';
      case 'C+':
      case 'C': return '#FF9800';
      case 'D': return '#F44336';
      case 'F': return '#9E9E9E';
      default: return '#9E9E9E';
    }
  };

  const getFeedback = (score: number): string => {
    if (score >= 95) return "Perfect! You're a karaoke legend! 🌟";
    if (score >= 85) return "Excellent performance! Keep it up! 🎤";
    if (score >= 75) return "Great job! You're getting there! 🎵";
    if (score >= 65) return "Good effort! Practice makes perfect! 🎶";
    if (score >= 55) return "Nice try! Keep practicing! 💪";
    return "Don't give up! Every legend starts somewhere! 🌱";
  };

  const grade = () => getGrade(props.overallScore);
  const gradeColor = () => getGradeColor(grade());

  return (
    <div class={styles.completion}>
      <Show when={props.isAnalyzing} fallback={
        <>
          <div class={styles.header}>
            <h2 class={styles.title}>Performance Complete!</h2>
            <Show when={props.isNewBestScore}>
              <div class={styles.newBestScore}>🏆 New Personal Best!</div>
            </Show>
          </div>

          <Card class={styles.scoreCard}>
            <div class={styles.songInfo}>
              <h3>{props.song.title}</h3>
              <p>{props.song.artist}</p>
            </div>

            <div class={styles.scoreDisplay}>
              <div 
                class={styles.grade} 
                style={{ color: gradeColor() }}
              >
                {grade()}
              </div>
              <div class={styles.score}>
                <span class={styles.scoreValue}>{Math.round(props.overallScore)}</span>
                <span class={styles.scoreLabel}>/ 100</span>
              </div>
            </div>

            <p class={styles.feedback}>{getFeedback(props.overallScore)}</p>
          </Card>

          <Show when={props.lineResults.length > 0}>
            <Card class={styles.detailsCard}>
              <h3 class={styles.detailsTitle}>Line Performance</h3>
              <div class={styles.lineResults}>
                <For each={props.lineResults}>
                  {(line) => (
                    <div class={styles.lineResult}>
                      <div class={styles.lineText}>{line.text}</div>
                      <div class={styles.lineScore}>
                        <ProgressBar 
                          value={line.score} 
                          max={100}
                          class={styles.lineProgress}
                        />
                        <span class={styles.lineScoreValue}>{line.score}%</span>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Card>
          </Show>

          <div class={styles.actions}>
            <Button 
              variant="primary" 
              size="large"
              onClick={props.onTryAgain}
            >
              Try Again
            </Button>
          </div>
        </>
      }>
        <div class={styles.analyzing}>
          <div class={styles.spinner} />
          <h2>Analyzing Performance...</h2>
          <p>Processing your vocals and calculating scores</p>
        </div>
      </Show>
    </div>
  );
};