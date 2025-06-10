/**
 * Test tutor endpoint locally with dev server
 */

async function testLocalTutor() {
  const data = {
    overallScore: 77,
    grade: 'B+',
    songTitle: 'Stronger',
    artistName: 'Kanye West',
    lineResults: [
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
      {
        expected: 'Ever after work is over',
        spoken: 'Ever after work over',
        score: 71,
      },
    ],
  };

  try {
    console.log('Testing local tutor endpoint...');

    const response = await fetch('http://localhost:8787/api/tutor/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    console.log('Response:', JSON.stringify(result, null, 2));

    if (!result.success) {
      console.error('Error details:', result.details);
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
}

testLocalTutor();
