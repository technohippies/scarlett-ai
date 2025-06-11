import { Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import { Button } from '../../common/Button';
import { Card } from '../../common/Card';
import { ProgressBar } from '../../common/ProgressBar';
import type { SessionResults } from '../../../types/karaoke';

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
      case 'S': return 'text-yellow-500';
      case 'A+':
      case 'A': return 'text-green-500';
      case 'B+':
      case 'B': return 'text-blue-500';
      case 'C+':
      case 'C': return 'text-orange-500';
      case 'D': return 'text-red-500';
      case 'F': return 'text-gray-500';
      default: return 'text-gray-500';
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
    <div class="p-6 max-w-2xl mx-auto">
      <Show when={props.isAnalyzing} fallback={
        <>
          <div class="text-center mb-8">
            <h2 class="text-3xl font-bold mb-2">Performance Complete!</h2>
            <Show when={props.isNewBestScore}>
              <div class="text-center text-yellow-500 font-semibold mb-4">🏆 New Personal Best!</div>
            </Show>
          </div>

          <Card class="mb-8">
            <div class="text-center mb-4">
              <h3 class="text-xl font-semibold">{props.song.title}</h3>
              <p class="text-gray-600 dark:text-gray-400">{props.song.artist}</p>
            </div>

            <div class="text-center">
              <div class={`text-6xl font-bold mb-4 ${gradeColor()}`}>
                {grade()}
              </div>
              <div class="text-4xl font-bold mb-2">
                {props.overallScore}%
              </div>
              <p class="text-gray-600 dark:text-gray-400">
                {getFeedback(props.overallScore)}
              </p>
            </div>
          </Card>

          <Show when={props.lineResults && props.lineResults.length > 0}>
            <div class="mb-8">
              <h3 class="text-xl font-semibold mb-4">Line by Line Performance</h3>
              <For each={props.lineResults}>
                {(line) => (
                  <div class="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p class="text-sm mb-2">{line.text}</p>
                    <div class="flex items-center justify-between">
                      <span class={`text-sm font-semibold ${
                        line.score >= 80 ? 'text-green-600 dark:text-green-400' :
                        line.score >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        Score: {line.score}%
                      </span>
                      <span class="text-xs text-gray-500">
                        Attempts: {line.attempts}
                      </span>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <div class="flex justify-center gap-4">
            <Button onClick={props.onTryAgain}>
              Try Again
            </Button>
          </div>
        </>
      }>
        <div class="text-center">
          <p class="text-lg mb-4">Analyzing your performance...</p>
          <div class="animate-spin h-8 w-8 mx-auto border-4 border-primary-500 border-t-transparent rounded-full"></div>
        </div>
      </Show>
    </div>
  );
};