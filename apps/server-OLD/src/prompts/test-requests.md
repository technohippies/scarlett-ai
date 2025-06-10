# Venice AI Test Requests

## Sample CURL Commands for Testing

### 1. Basic Karaoke Feedback Request

```bash
curl -X POST https://api.venice.ai/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_VENICE_API_KEY" \
  -d '{
    "model": "venice-uncensored",
    "messages": [
      {
        "role": "system",
        "content": "You are Scarlett, a friendly English coach who helps people learn through karaoke. Respond with encouraging, specific feedback in JSON format."
      },
      {
        "role": "user",
        "content": "I just sang \"Stronger\" by Kanye West. My overall score was 77% (B+ grade). I sang 4 out of 140 lines. Here are my results:\n\n- Expected: \"Work it, make it, do it, makes us\"\n- I sang: \"Work could make it\"\n- Score: 44%\n\n- Expected: \"Harder, better, faster, stronger\"\n- I sang: \"It makes us harder, better, faster, stronger. Nat, Nat, Nat, Nat, Nat, but don'\''t kill me.\"\n- Score: 82%\n\nPlease give me feedback in this JSON format:\n{\n  \"encouragement\": \"positive message\",\n  \"strengths\": [\"strength1\", \"strength2\"],\n  \"improvementAreas\": [\"area1\", \"area2\"],\n  \"exerciseCount\": 3,\n  \"difficulty\": \"intermediate\"\n}"
      }
    ],
    "max_tokens": 500,
    "temperature": 0.7
  }'
```

### 2. Exercise Generation Request

```bash
curl -X POST https://api.venice.ai/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_VENICE_API_KEY" \
  -d '{
    "model": "venice-uncensored",
    "messages": [
      {
        "role": "system",
        "content": "You are Scarlett, an English coach creating practice exercises. Generate helpful, engaging exercises in JSON format."
      },
      {
        "role": "user",
        "content": "I need help with pronunciation. I was supposed to say \"Work it, make it, do it, makes us\" but I said \"Work could make it\". My level is intermediate. Please create a say_it_back exercise to help me practice this specific phrase.\n\nRespond in JSON format:\n{\n  \"id\": \"exercise_1\",\n  \"type\": \"say_it_back\",\n  \"instruction\": \"clear instruction\",\n  \"targetText\": \"phrase to practice\",\n  \"hints\": [\"helpful hints\"],\n  \"difficulty\": \"intermediate\"\n}"
      }
    ],
    "max_tokens": 300,
    "temperature": 0.6
  }'
```

### 3. Streaming Request (for real-time TTS generation)

```bash
curl -X POST https://api.venice.ai/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_VENICE_API_KEY" \
  -d '{
    "model": "venice-uncensored",
    "messages": [
      {
        "role": "system",
        "content": "You are Scarlett, providing encouraging coaching. Speak naturally as if giving verbal feedback."
      },
      {
        "role": "user",
        "content": "I just got 82% on a karaoke song. Give me encouraging feedback and explain what to practice next."
      }
    ],
    "max_tokens": 200,
    "temperature": 0.8,
    "stream": true
  }' \
  --no-buffer
```

## Test Data Samples

### Sample Performance Data (Good Performance)

```json
{
  "overallScore": 87,
  "grade": "B+",
  "songTitle": "Can't Stop the Feeling",
  "artistName": "Justin Timberlake",
  "lineResults": [
    {
      "expected": "I got that sunshine in my pocket",
      "spoken": "I got that sunshine in my pocket",
      "score": 95
    },
    {
      "expected": "Got that good soul in my feet",
      "spoken": "Got that good soul in my feet",
      "score": 88
    }
  ],
  "totalLines": 20,
  "performedLines": 8
}
```

### Sample Performance Data (Needs Practice)

```json
{
  "overallScore": 45,
  "grade": "F",
  "songTitle": "Hello",
  "artistName": "Adele",
  "lineResults": [
    {
      "expected": "Hello, it's me",
      "spoken": "Hello, it me",
      "score": 72
    },
    {
      "expected": "I was wondering if after all these years",
      "spoken": "I was wonder if after years",
      "score": 31
    },
    {
      "expected": "You'd like to meet",
      "spoken": "You like to meet",
      "score": 65
    }
  ],
  "totalLines": 15,
  "performedLines": 6
}
```

## Expected Response Formats

### Feedback Response

```json
{
  "encouragement": "Great job! You really nailed the rhythm and got most of the words right!",
  "strengths": [
    "Excellent pronunciation of consonants",
    "Good timing with the music",
    "Clear articulation"
  ],
  "improvementAreas": [
    "Work on contractions like 'it's' vs 'it'",
    "Practice longer phrases without dropping words",
    "Focus on article usage ('the', 'a')"
  ],
  "exerciseCount": 3,
  "difficulty": "intermediate"
}
```

### Exercise Response

```json
{
  "id": "exercise_1",
  "type": "say_it_back",
  "instruction": "Let's practice contractions! Listen carefully and repeat, making sure to pronounce 'it's' clearly.",
  "targetText": "Hello, it's me, I was wondering",
  "hints": [
    "Remember: 'it's' = 'it is' - don't drop the 's' sound",
    "Take a small pause between 'me' and 'I'"
  ],
  "difficulty": "intermediate"
}
```
