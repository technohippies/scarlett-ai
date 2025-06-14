#!/usr/bin/env bun

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: bun scripts/apply-local-migration.ts <migration-file>');
  process.exit(1);
}

// Find the local SQLite database
const dbPath = path.join(__dirname, '../.wrangler/state/v3/d1');
const dbFiles = fs.readdirSync(dbPath, { recursive: true })
  .filter(file => file.toString().endsWith('.sqlite'))
  .map(file => path.join(dbPath, file.toString()));

if (dbFiles.length === 0) {
  console.error('No SQLite database found. Make sure the dev server has been run at least once.');
  process.exit(1);
}

const dbFile = dbFiles[0];
console.log('Using database:', dbFile);

// Read migration
const migration = fs.readFileSync(migrationFile, 'utf-8');
console.log('Applying migration:', migrationFile);

// Apply migration
const db = new Database(dbFile);
try {
  db.exec(migration);
  console.log('Migration applied successfully!');
} catch (error) {
  console.error('Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}