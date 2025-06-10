// Simple test to verify imports work
import { doubleMetaphone } from 'double-metaphone';
import { findLyrics } from 'lrclib-api';

console.log('Testing double-metaphone:', doubleMetaphone('test'));
console.log('Testing lrclib-api:', typeof findLyrics);
console.log('✅ All imports working!');