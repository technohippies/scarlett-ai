#!/bin/bash

# Test script for LLM endpoints
# Usage: ./test-llm.sh YOUR_VENICE_API_KEY

if [ -z "$1" ]; then
    echo "Usage: ./test-llm.sh YOUR_VENICE_API_KEY"
    exit 1
fi

API_KEY=$1

echo "🧪 Testing Venice AI Tutor Analysis"
echo "=================================="

# Test 1: Good Performance (B+ Grade)
echo -e "\n📊 Test 1: B+ Performance (77%)"
curl -s -X POST https://api.venice.ai/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "model": "venice-uncensored",
    "messages": [
      {
        "role": "system",
        "content": "You are Scarlett, a friendly English tutor helping someone improve through karaoke practice."
      },
      {
        "role": "user",
        "content": "**Performance Summary:**\n- Song: \"Stronger\" by Kanye West\n- Overall Score: 77% (Grade: B+)\n- Lines attempted: 4 out of 140\n- Lines needing work: 2\n\n**Main Issues:**\n- Expected: \"Work it, make it, do it, makes us\" → You said: \"Work could make it\" (44%)\n- Expected: \"Harder, better, faster, stronger\" → You said: \"It makes us harder, better, faster, stronger. Nat, Nat, Nat\" (82%)\n\nProvide a brief, encouraging response that will be spoken aloud (like a phone call). In exactly 2-3 sentences:\n1. Acknowledge their effort on the song\n2. Highlight ONE specific thing they did well (even if score is low)\n3. Suggest ONE main area to focus on for improvement\n\nKeep it conversational and warm, like a supportive friend.\n\nRespond in JSON format:\n{\n  \"message\": \"Your 2-3 sentence spoken feedback here\",\n  \"focusArea\": \"The main issue to work on\",\n  \"difficulty\": \"beginner|intermediate|advanced\"\n}"
      }
    ],
    "max_tokens": 300,
    "temperature": 0.7
  }' | jq -r '.choices[0].message.content' | jq .

# Test 2: Poor Performance (F Grade)
echo -e "\n📊 Test 2: F Performance (45%)"
curl -s -X POST https://api.venice.ai/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "model": "venice-uncensored",
    "messages": [
      {
        "role": "system",
        "content": "You are Scarlett, a friendly English tutor helping someone improve through karaoke practice."
      },
      {
        "role": "user",
        "content": "**Performance Summary:**\n- Song: \"Hello\" by Adele\n- Overall Score: 45% (Grade: F)\n- Lines attempted: 4 out of 15\n- Lines needing work: 3\n\n**Main Issues:**\n- Expected: \"Hello, it'\''s me\" → You said: \"Hello, it me\" (72%)\n- Expected: \"I was wondering if after all these years\" → You said: \"I was wonder if after years\" (31%)\n- Expected: \"You'\''d like to meet\" → You said: \"You like to meet\" (65%)\n\nProvide a brief, encouraging response that will be spoken aloud (like a phone call). In exactly 2-3 sentences:\n1. Acknowledge their effort on the song\n2. Highlight ONE specific thing they did well (even if score is low)\n3. Suggest ONE main area to focus on for improvement\n\nKeep it conversational and warm, like a supportive friend.\n\nRespond in JSON format:\n{\n  \"message\": \"Your 2-3 sentence spoken feedback here\",\n  \"focusArea\": \"The main issue to work on\",\n  \"difficulty\": \"beginner|intermediate|advanced\"\n}"
      }
    ],
    "max_tokens": 300,
    "temperature": 0.7
  }' | jq -r '.choices[0].message.content' | jq .

# Test 3: Excellent Performance (A Grade)
echo -e "\n📊 Test 3: A Performance (92%)"
curl -s -X POST https://api.venice.ai/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "model": "venice-uncensored",
    "messages": [
      {
        "role": "system",
        "content": "You are Scarlett, a friendly English tutor helping someone improve through karaoke practice."
      },
      {
        "role": "user",
        "content": "**Performance Summary:**\n- Song: \"Can'\''t Stop the Feeling\" by Justin Timberlake\n- Overall Score: 92% (Grade: A)\n- Lines attempted: 8 out of 20\n- Lines needing work: 1\n\n**Main Issues:**\n- Expected: \"I got this feeling inside my bones\" → You said: \"I got this feeling inside my bones\" (88%)\n\nProvide a brief, encouraging response that will be spoken aloud (like a phone call). In exactly 2-3 sentences:\n1. Acknowledge their effort on the song\n2. Highlight ONE specific thing they did well (even if score is low)\n3. Suggest ONE main area to focus on for improvement\n\nKeep it conversational and warm, like a supportive friend.\n\nRespond in JSON format:\n{\n  \"message\": \"Your 2-3 sentence spoken feedback here\",\n  \"focusArea\": \"The main issue to work on\",\n  \"difficulty\": \"beginner|intermediate|advanced\"\n}"
      }
    ],
    "max_tokens": 300,
    "temperature": 0.7
  }' | jq -r '.choices[0].message.content' | jq .

echo -e "\n✅ Tests complete!"