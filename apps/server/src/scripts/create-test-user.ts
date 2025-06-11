// Script to create a test user for development
// Run with: npx tsx src/scripts/create-test-user.ts

import { nanoid } from 'nanoid';

const TEST_USER_SQL = `
-- Create a test user for development
INSERT INTO users (id, email, created_at) 
VALUES ('test-user-1', 'test@example.com', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- You can also create some test practice cards for this user
-- This is optional - cards will be created automatically from karaoke sessions
`;

console.log('Run this SQL in your D1 database to create a test user:');
console.log(TEST_USER_SQL);