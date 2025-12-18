# ASAR Hot Updates - Discord-Style

This folder contains the configuration for ASAR-only hot updates (true Discord-style updates).

## How It Works

Unlike traditional Electron auto-updates that run a full installer, ASAR updates work by:
1. Downloading only the new `app.asar` file
2. Replacing the old `app.asar` in the app's resources folder
3. Restarting the app

**Benefits:**
- ✅ No installer popup or "app cannot be closed" errors
- ✅ Much faster updates (only ~40MB vs ~99MB)
- ✅ Seamless, automatic restart
- ✅ True Discord-style experience

**Limitations:**
- ⚠️ Only updates your code (app.asar), NOT Electron framework or exe file
- ⚠️ If you update Electron version or native modules, you need a full NSIS installer release

## Publishing an Update

### Step 1: Build the App
```bash
pnpm build
```

This creates the ASAR file at: `dist-electron/app.asar`

### Step 2: Update version.json
Edit `updates/update.json` with the new version:
```json
{
  "name": "Watch Party",
  "version": "1.5.1",
  "asar": "https://github.com/Raphael-08/watch-party-vite/releases/download/v1.5.1/app.asar",
  "info": "Bug fixes and improvements"
}
```

### Step 3: Create GitHub Release
1. Go to GitHub > Releases > "Create new release"
2. Tag: `v1.5.1` (must match version in update.json)
3. Title: `v1.5.1`
4. Upload the `app.asar` file from `dist-electron/app.asar`
5. Publish release

### Step 4: Commit and Push
```bash
git add updates/update.json
git commit -m "chore: Update to v1.5.1"
git push
```

### Step 5: Test
1. Install the current version of the app
2. Launch it - it should detect the new version
3. Watch the splash screen show: "Downloading update..." → "Installing update..."
4. App automatically restarts with new version

## Update Server URL

The app checks for updates at:
```
https://raw.githubusercontent.com/Raphael-08/watch-party-vite/master/updates/update.json
```

Make sure this file is always up-to-date on the master branch.

## When to Use Full Installer vs ASAR Update

**Use ASAR Update (most updates):**
- Bug fixes
- UI changes
- New features (React code)
- Configuration changes
- Package.json dependency updates (if they don't need native rebuilds)

**Use Full Installer:**
- Electron version upgrade
- Native module updates (like better-sqlite3, sharp, etc.)
- Adding new files outside app.asar
- Major architecture changes

## Troubleshooting

**Update not detected:**
- Check that update.json is accessible at the raw GitHub URL
- Verify version in update.json is higher than current version
- Check browser console for errors (Ctrl+Shift+I)

**Download fails:**
- Verify the GitHub release exists
- Check that app.asar file is uploaded to the release
- Verify the URL in update.json is correct

**App doesn't restart:**
- Check app logs in: `%APPDATA%\watch-party-vite\logs`
- Look for "[AutoUpdater]" messages
