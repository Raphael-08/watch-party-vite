#!/usr/bin/env node

/**
 * Release script that loads .env file and runs electron-builder publish
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load .env file
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();
      if (key && value) {
        process.env[key] = value;
      }
    }
  });
  console.log('✓ Loaded .env file');
} else {
  console.error('✗ .env file not found!');
  process.exit(1);
}

// Check if GH_TOKEN is set
if (!process.env.GH_TOKEN) {
  console.error('✗ GH_TOKEN not found in .env file!');
  console.error('Please add your GitHub Personal Access Token to .env:');
  console.error('GH_TOKEN=your_token_here');
  process.exit(1);
}

console.log('✓ GitHub token found');
console.log('Building and publishing to GitHub Releases...\n');

try {
  // Run the build and publish
  execSync('tsc -b && vite build && electron-builder --publish always', {
    stdio: 'inherit',
    env: process.env
  });

  console.log('\n✓ Release published successfully!');
} catch (error) {
  console.error('\n✗ Release failed:', error.message);
  process.exit(1);
}
