#!/usr/bin/env node

const { execSync } = require('node:child_process');

// This script is used by Vercel to build the project and handle Prisma migrations
// It ensures that Prisma client is correctly generated and migrations are applied

// Function to run shell commands
const runCommand = (command) => {
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(`Failed to execute ${command}`, error);
    process.exit(1);
  }
};

// Determine if we're in production
const isProduction = process.env.VERCEL_ENV === 'production';

// Always generate the Prisma client
console.log('🔄 Generating Prisma client...');
runCommand('npx prisma generate');

// Only run migrations in production environments to avoid accidental schema changes
if (isProduction) {
  console.log('🔄 Running database migrations...');
  runCommand('npx prisma migrate deploy');
} else {
  console.log('⏭️ Skipping migrations in non-production environment');
}

console.log('✅ Prisma setup complete'); 