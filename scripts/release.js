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

// Check for uncommitted changes
console.log('\nChecking for uncommitted changes...');
try {
  const status = execSync('git status --porcelain', { encoding: 'utf-8' });
  if (status.trim()) {
    console.log('✗ You have uncommitted changes!');
    console.log('\nPlease commit and push your changes before releasing:');
    console.log('  git add -A');
    console.log('  git commit -m "Your commit message"');
    console.log('  git push');
    console.log('\nUncommitted files:');
    console.log(status);
    process.exit(1);
  }
  console.log('✓ No uncommitted changes');
} catch (error) {
  console.error('✗ Failed to check git status:', error.message);
  process.exit(1);
}

// Check if local branch is up to date with remote
console.log('Checking if branch is up to date with remote...');
try {
  execSync('git fetch', { stdio: 'inherit' });
  const localHash = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  const remoteHash = execSync('git rev-parse @{u}', { encoding: 'utf-8' }).trim();

  if (localHash !== remoteHash) {
    console.log('✗ Local branch is not up to date with remote!');
    console.log('Please push your commits first: git push');
    process.exit(1);
  }
  console.log('✓ Branch is up to date with remote');
} catch (error) {
  console.error('✗ Failed to check branch status:', error.message);
  process.exit(1);
}

console.log('\nBuilding and publishing to GitHub Releases...\n');

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
