#!/usr/bin/env node
/* global process, console */

import { SignJWT } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

async function generateTestJWT() {
  const secret = new TextEncoder().encode(JWT_SECRET);
  
  // Test user data - mirrors what web flow would generate
  const walletAddress = '0x1234567890123456789012345678901234567890';
  const userId = `user_${walletAddress.slice(2, 8)}`; // Generate ID from wallet
  
  const testUser = {
    userId: userId,
    walletAddress: walletAddress,
    subscriptionStatus: 'active', // From Unlock Protocol purchase
    creditsRemaining: 1000, // Premium plan credits
    type: 'extension_token',
    // No email - will be collected in extension if needed
    // No display_name - will be collected in extension if needed
  };

  try {
    const jwt = await new SignJWT(testUser)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d') // 30 days for testing
      .setSubject(testUser.userId)
      .sign(secret);
    
    const scarlettToken = `scarlett_${jwt}`;
    
    console.log('🎤 Scarlett Test JWT Generated!');
    console.log('================================');
    console.log('');
    console.log('Token:', scarlettToken);
    console.log('');
    console.log('User Data:');
    console.log('- ID:', testUser.userId);
    console.log('- Wallet:', testUser.walletAddress);
    console.log('- Plan:', testUser.subscriptionStatus);
    console.log('- Credits:', testUser.creditsRemaining);
    console.log('- Email: (collected later in extension)');
    console.log('');
    console.log('📋 Copy this token and paste it in your Chrome extension!');
    console.log('');
    
    return scarlettToken;
  } catch (error) {
    console.error('❌ Error generating JWT:', error);
    process.exit(1);
  }
}

// Handle different ways this script might be called
if (process.argv[2] === '--json') {
  // Output as JSON for programmatic use
  generateTestJWT().then(token => {
    console.log(JSON.stringify({ token, success: true }));
  });
} else if (process.argv[2] === '--token-only') {
  // Output only the token
  generateTestJWT().then(token => {
    console.log(token);
  });
} else {
  // Default: pretty output
  generateTestJWT();
} 