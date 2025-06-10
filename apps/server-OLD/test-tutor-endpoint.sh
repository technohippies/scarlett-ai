#!/bin/bash

# Test the deployed tutor analysis endpoint
# Usage: ./test-tutor-endpoint.sh

API_URL="https://scarlett-api.deletion-backup782.workers.dev"

echo "🧪 Testing Tutor Analysis Endpoint"
echo "=================================="
echo ""

# Test with the "Stronger" example data
curl -X POST "$API_URL/api/tutor/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "overallScore": 77,
    "grade": "B+",
    "songTitle": "Stronger",
    "artistName": "Kanye West",
    "lineResults": [
      {
        "expected": "Work it, make it, do it, makes us",
        "spoken": "Work could make it",
        "score": 44
      },
      {
        "expected": "Harder, better, faster, stronger",
        "spoken": "It makes us harder, better, faster, stronger. Nat, Nat, Nat",
        "score": 82
      },
      {
        "expected": "More than hour, our, never",
        "spoken": "More than hour never",
        "score": 65
      },
      {
        "expected": "Ever after work is over",
        "spoken": "Ever after work over",
        "score": 71
      }
    ]
  }' | jq .

echo ""
echo "✅ Test complete!"