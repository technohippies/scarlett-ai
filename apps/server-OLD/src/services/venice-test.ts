/**
 * Simple test runner for Venice AI prompts
 * Run with: bun run src/services/venice-test.ts
 */

import { buildTutorAnalysisPrompt } from '../prompts/tutor-analysis';
import type { TutorAnalysisRequest } from '../prompts/tutor-types';

// Test data matching the real "Stronger" example
const testPerformance: TutorAnalysisRequest = {
  overallScore: 77,
  grade: 'B+',
  songTitle: 'Stronger',
  artistName: 'Kanye West',
  totalLines: 140,
  attemptedLines: 4,
  incorrectLines: [
    {
      expected: 'Work it, make it, do it, makes us',
      spoken: 'Work could make it',
      score: 44,
    },
    {
      expected: 'Harder, better, faster, stronger',
      spoken: 'It makes us harder, better, faster, stronger. Nat, Nat, Nat',
      score: 82,
    },
    {
      expected: 'More than hour, our, never',
      spoken: 'More than hour never',
      score: 65,
    },
  ],
};

async function testVenicePrompt() {
  const apiKey = process.env.VENICE_API_KEY;

  if (!apiKey) {
    console.error('Please set VENICE_API_KEY environment variable');
    console.log(
      'Example: VENICE_API_KEY=your_key bun run src/services/venice-test.ts'
    );
    return;
  }

  console.log('🧪 Testing Venice AI Tutor Analysis Prompt\n');
  console.log('Performance Data:', JSON.stringify(testPerformance, null, 2));
  console.log('\n---\n');

  const prompt = buildTutorAnalysisPrompt(testPerformance);

  try {
    const response = await fetch(
      'https://api.venice.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'venice-uncensored',
          messages: [
            {
              role: 'system',
              content:
                'You are Scarlett, a friendly English coach who helps people learn through karaoke. Respond with encouraging, specific feedback in JSON format.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Venice API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    console.log('🤖 Venice AI Response:\n');
    console.log(aiResponse);

    // Try to parse as JSON
    try {
      const parsed = JSON.parse(aiResponse);
      console.log('\n✅ Valid JSON Response:', JSON.stringify(parsed, null, 2));

      // Validate response structure
      if (parsed.message && parsed.encouragement) {
        console.log('\n📝 TTS Message:', parsed.message);
        console.log('Word count:', parsed.message.split(' ').length);
      }
    } catch (e) {
      console.error('\n❌ Failed to parse JSON response');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the test
testVenicePrompt();
