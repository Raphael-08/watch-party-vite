import { app, BrowserWindow, shell, protocol, ipcMain, session } from 'electron';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables from project root
dotenv.config();

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Import ASAR updater for Discord-style updates
const EAU = require('electron-asar-hot-updater');

// Update server configuration
const updateServerUrl = 'https://raw.githubusercontent.com/Raphael-08/watch-party-vite/master/updates/update.json';

console.log('[AutoUpdater] =================================================');
console.log('[AutoUpdater] Initializing ASAR hot updater (Discord-style)');
console.log('[AutoUpdater] Current app version:', app.getVersion());
console.log('[AutoUpdater] Is packaged:', app.isPackaged);
console.log('[AutoUpdater] Platform:', process.platform);
console.log('[AutoUpdater] Update server:', updateServerUrl);
console.log('[AutoUpdater] =================================================');

let splashWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;
let isCreatingWindow = false;

// Helper function to check if we should skip update check (just updated)
function shouldSkipUpdateCheck(): boolean {
  try {
    const userDataPath = app.getPath('userData');
    const updateFlagPath = path.join(userDataPath, '.just-updated');

    if (fs.existsSync(updateFlagPath)) {
      console.log('[AutoUpdater] =================================================');
      console.log('[AutoUpdater] ⏭️  Skipping update check (just updated)');
      console.log('[AutoUpdater] Flag file found:', updateFlagPath);
      console.log('[AutoUpdater] =================================================');

      // Delete the flag file for next launch
      fs.unlinkSync(updateFlagPath);
      return true;
    }
  } catch (err) {
    console.error('[AutoUpdater] Error checking update flag:', err);
  }
  return false;
}

// Helper function to create flag file after update install
function createUpdateFlag() {
  try {
    const userDataPath = app.getPath('userData');
    const updateFlagPath = path.join(userDataPath, '.just-updated');
    fs.writeFileSync(updateFlagPath, Date.now().toString());
    console.log('[AutoUpdater] Created update flag:', updateFlagPath);
  } catch (err) {
    console.error('[AutoUpdater] Error creating update flag:', err);
  }
}

// Create splash window for update progress (Discord-style)
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Discord-style minimal update window with purple/pink gradient
  const splashHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            width: 100vw;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: transparent;
            font-family: 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif;
            -webkit-app-region: drag;
            cursor: move;
          }
          .container {
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
            border-radius: 12px;
            padding: 32px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.6);
            position: relative;
          }
          .logo {
            width: 64px;
            height: 64px;
            background: rgba(255,255,255,0.2);
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 24px;
            font-size: 32px;
            backdrop-filter: blur(10px);
          }
          .title {
            color: #ffffff;
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 12px;
            text-align: center;
            text-shadow: 0 2px 4px rgba(0,0,0,0.2);
          }
          .status {
            color: rgba(255,255,255,0.9);
            font-size: 15px;
            margin-bottom: 24px;
            text-align: center;
            min-height: 22px;
          }
          .spinner {
            width: 40px;
            height: 40px;
            margin-bottom: 20px;
            display: none;
          }
          .spinner.active {
            display: block;
          }
          .spinner-circle {
            width: 100%;
            height: 100%;
            border: 3px solid rgba(255,255,255,0.3);
            border-top-color: #ffffff;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          .progress-container {
            width: 100%;
            display: none;
          }
          .progress-container.active {
            display: block;
          }
          .progress-bar {
            width: 100%;
            height: 6px;
            background: rgba(255,255,255,0.2);
            border-radius: 3px;
            overflow: hidden;
            margin-bottom: 8px;
          }
          .progress-fill {
            height: 100%;
            background: #ffffff;
            border-radius: 3px;
            transition: width 0.3s ease;
            width: 0%;
            box-shadow: 0 0 10px rgba(255,255,255,0.5);
          }
          .progress-text {
            color: rgba(255,255,255,0.8);
            font-size: 13px;
            text-align: center;
            font-weight: 500;
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
          .pulsing {
            animation: pulse 2s ease-in-out infinite;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">🎬</div>
          <div class="title">Watch Party</div>
          <div class="spinner active" id="spinner">
            <div class="spinner-circle"></div>
          </div>
          <div class="status pulsing" id="status">Checking for updates...</div>
          <div class="progress-container" id="progress-container">
            <div class="progress-bar">
              <div class="progress-fill" id="progress"></div>
            </div>
            <div class="progress-text" id="progress-text">0%</div>
          </div>
        </div>
      </body>
    </html>
  `;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHTML)}`);
}

// Update splash window status
function updateSplashStatus(status: string, progress?: number, showSpinner = true) {
  if (!splashWindow || splashWindow.isDestroyed()) return;

  splashWindow.webContents.executeJavaScript(`
    const statusEl = document.getElementById('status');
    const spinnerEl = document.getElementById('spinner');
    const progressContainer = document.getElementById('progress-container');
    const progressFill = document.getElementById('progress');
    const progressText = document.getElementById('progress-text');

    // Update status text
    statusEl.textContent = '${status}';

    // Toggle spinner and progress bar
    if (${showSpinner}) {
      spinnerEl.classList.add('active');
      progressContainer.classList.remove('active');
    } else {
      spinnerEl.classList.remove('active');
      progressContainer.classList.add('active');
    }

    // Update progress if provided
    ${progress !== undefined ? `
      progressFill.style.width = '${progress}%';
      progressText.textContent = '${Math.round(progress)}%';
    ` : ''}
  `);
}

// Function to check for ASAR updates using EAU
function checkForUpdates() {
  console.log('[AutoUpdater] =================================================');
  console.log('[AutoUpdater] 🔍 Checking for ASAR updates...');
  console.log('[AutoUpdater] Current version:', app.getVersion());
  console.log('[AutoUpdater] =================================================');

  if (splashWindow && !splashWindow.isDestroyed()) {
    updateSplashStatus('Checking for updates...', undefined, true);
  }

  // Initialize EAU
  EAU.init({
    api: updateServerUrl,
    server: false, // Client-side version comparison
    debug: true
  });

  // Check for updates
  EAU.check((error: Error | null, last: any, body: any) => {
    if (error) {
      console.error('[AutoUpdater] ❌ Update check error:', error);
      console.error('[AutoUpdater] Launching app anyway...');
      if (splashWindow && !splashWindow.isDestroyed()) {
        updateSplashStatus('Launching...', 100, true);
        setTimeout(() => {
          if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.close();
            splashWindow = null;
          }
          createWindow();
        }, 500);
      } else {
        createWindow();
      }
      return;
    }

    if (!last) {
      // No update available
      console.log('[AutoUpdater] ℹ️  No updates available');
      console.log('[AutoUpdater] Launching app...');
      if (splashWindow && !splashWindow.isDestroyed()) {
        updateSplashStatus('Launching...', 100, true);
        setTimeout(() => {
          if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.close();
            splashWindow = null;
          }
          createWindow();
        }, 500);
      } else {
        createWindow();
      }
      return;
    }

    // Update available
    console.log('[AutoUpdater] ✅ UPDATE AVAILABLE!');
    console.log('[AutoUpdater] New version:', body.version);
    console.log('[AutoUpdater] Starting ASAR download...');

    if (splashWindow && !splashWindow.isDestroyed()) {
      updateSplashStatus('Downloading update...', 0, false);
    }

    // Download the update
    EAU.progress((state: any) => {
      const percent = state.percent || 0;
      console.log(`[AutoUpdater] Download progress: ${percent.toFixed(1)}%`);
      if (splashWindow && !splashWindow.isDestroyed()) {
        updateSplashStatus('Downloading update...', percent, false);
      }
    });

    EAU.download((error: Error | null) => {
      if (error) {
        console.error('[AutoUpdater] ❌ Download error:', error);
        console.error('[AutoUpdater] Launching app anyway...');
        if (splashWindow && !splashWindow.isDestroyed()) {
          updateSplashStatus('Launching...', 100, true);
          setTimeout(() => {
            if (splashWindow && !splashWindow.isDestroyed()) {
              splashWindow.close();
              splashWindow = null;
            }
            createWindow();
          }, 500);
        } else {
          createWindow();
        }
        return;
      }

      // Update downloaded successfully
      console.log('[AutoUpdater] ✅ UPDATE DOWNLOADED!');
      console.log('[AutoUpdater] Installing ASAR and restarting...');

      if (splashWindow && !splashWindow.isDestroyed()) {
        updateSplashStatus('Installing update...', 100, true);
      }

      // Create flag to skip update check after restart
      createUpdateFlag();

      // Restart the app with new ASAR
      setTimeout(() => {
        console.log('[AutoUpdater] Restarting app with new ASAR...');
        app.relaunch();
        app.exit(0);
      }, 1500);
    });
  });
}

// Register custom protocol before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      allowServiceWorkers: true,
      bypassCSP: false,
    },
  },
]);

function createWindow() {
  // Prevent creating multiple windows
  if (isCreatingWindow || mainWindow) {
    console.log('[Main] Window already exists or is being created, skipping...');
    return;
  }

  isCreatingWindow = true;
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      partition: 'persist:watchparty', // Persist session and localStorage
    },
    frame: false, // Remove default title bar for custom one
    transparent: false,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    title: 'Watch Party',
  });

  // Grant permissions for media devices (camera/microphone)
  session.fromPartition('persist:watchparty').setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowedPermissions = ['media', 'mediaKeySystem', 'geolocation', 'notifications'];
    if (allowedPermissions.includes(permission)) {
      callback(true); // Grant permission
    } else {
      callback(false); // Deny permission
    }
  });

  // Also handle permission checks (different from requests)
  session.fromPartition('persist:watchparty').setPermissionCheckHandler((_webContents, permission, _requestingOrigin, _details) => {
    const allowedPermissions = ['media', 'mediaKeySystem', 'geolocation', 'notifications'];
    return allowedPermissions.includes(permission);
  });

  // Set proper user agent to help with CORS
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 WatchParty/1.0.0';
  mainWindow.webContents.setUserAgent(userAgent);

  // Load app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // In production, load from file:// - simpler and more stable
    const indexPath = path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(indexPath);
  }

  // Handle external links
  if (mainWindow) {
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        shell.openExternal(url);
        return { action: 'deny' };
      }
      return { action: 'allow' };
    });

    // Reset flag when window is closed
    mainWindow.on('closed', () => {
      mainWindow = null;
      isCreatingWindow = false;
    });
  }

  isCreatingWindow = false;
}

app.whenReady().then(() => {
  // Get or create the persistent session
  const ses = session.fromPartition('persist:watchparty');
  console.log('Session is persistent:', ses.isPersistent());
  console.log('Session storage path:', ses.getStoragePath());

  // In production, show splash and check for ASAR updates (Discord-style)
  if (!isDev) {
    // Check if we should skip update check (just updated)
    if (shouldSkipUpdateCheck()) {
      // Skip update check and launch directly
      createWindow();
    } else {
      createSplashWindow();
      // Check for ASAR updates after splash window is ready
      setTimeout(() => {
        checkForUpdates();
      }, 1000);
    }
  } else {
    // In development, launch directly
    createWindow();
  }

  // Handle window controls
  ipcMain.on('minimize-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.minimize();
  });

  ipcMain.on('maximize-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win?.isMaximized()) {
      win?.unmaximize();
    } else {
      win?.maximize();
    }
  });

  ipcMain.on('close-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.close();
  });

  ipcMain.on('toggle-fullscreen', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.setFullScreen(!win.isFullScreen());
    }
  });

  // Handle open logs folder request
  ipcMain.on('open-logs', () => {
    // Open user data folder (where logs would typically be stored)
    const userDataPath = app.getPath('userData');
    shell.openPath(userDataPath);
  });

  // Handle check for updates manually
  ipcMain.on('check-updates', () => {
    console.log('[AutoUpdater] Manual update check requested');
    checkForUpdates();
  });

  // Handle restart to install update (from splash window)
  ipcMain.on('restart-app', () => {
    console.log('[AutoUpdater] User clicked restart button');
    console.log('[AutoUpdater] Restarting app...');
    app.relaunch();
    app.exit(0);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Flush storage data before quitting
    const ses = session.fromPartition('persist:watchparty');
    ses.flushStorageData();
    app.quit();
  }
});

// Ensure storage is flushed before quit
app.on('before-quit', () => {
  const ses = session.fromPartition('persist:watchparty');
  ses.flushStorageData();
});
