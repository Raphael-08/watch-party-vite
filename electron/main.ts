import { app, BrowserWindow, shell, protocol, ipcMain, session } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from project root
dotenv.config();

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Configure auto-updater (Discord-style silent updates)
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease = false;

// Enable verbose logging to see what's happening
const log = require('electron-log');
autoUpdater.logger = log;
log.transports.file.level = 'debug';
log.transports.console.level = 'debug';

console.log('[AutoUpdater] =================================================');
console.log('[AutoUpdater] Initializing electron-updater');
console.log('[AutoUpdater] Current app version:', app.getVersion());
console.log('[AutoUpdater] Is packaged:', app.isPackaged);
console.log('[AutoUpdater] Platform:', process.platform);
console.log('[AutoUpdater] =================================================');

// Configure GitHub provider for public repository (no authentication needed)
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'Raphael-08',
  repo: 'watch-party-vite',
  private: false, // Public repository
});

console.log('[AutoUpdater] ✓ GitHub provider configured for public repository');
console.log('[AutoUpdater] ✓ Auto-updates enabled');

let splashWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;
let isCreatingWindow = false;

// Create splash window for update progress
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Create a simple HTML for splash screen
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
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          }
          .container {
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 12px;
            padding: 40px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          }
          .logo {
            font-size: 48px;
            margin-bottom: 20px;
          }
          .title {
            color: white;
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 10px;
          }
          .status {
            color: rgba(255,255,255,0.8);
            font-size: 14px;
            margin-bottom: 20px;
          }
          .progress-bar {
            width: 100%;
            height: 4px;
            background: rgba(255,255,255,0.2);
            border-radius: 2px;
            overflow: hidden;
            margin-bottom: 10px;
          }
          .progress-fill {
            height: 100%;
            background: white;
            border-radius: 2px;
            transition: width 0.3s ease;
            width: 0%;
          }
          .progress-text {
            color: rgba(255,255,255,0.6);
            font-size: 12px;
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          .checking {
            animation: pulse 1.5s ease-in-out infinite;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">🎬</div>
          <div class="title">Watch Party</div>
          <div class="status checking" id="status">Checking for updates...</div>
          <div class="progress-bar">
            <div class="progress-fill" id="progress"></div>
          </div>
          <div class="progress-text" id="progress-text">0%</div>
        </div>
      </body>
    </html>
  `;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHTML)}`);
}

// Update splash window status
function updateSplashStatus(status: string, progress?: number) {
  if (!splashWindow || splashWindow.isDestroyed()) return;

  splashWindow.webContents.executeJavaScript(`
    document.getElementById('status').textContent = '${status}';
    document.getElementById('status').classList.remove('checking');
    ${progress !== undefined ? `
      document.getElementById('progress').style.width = '${progress}%';
      document.getElementById('progress-text').textContent = '${Math.round(progress)}%';
    ` : ''}
  `);
}

// Auto-updater event handlers with detailed logging
autoUpdater.on('checking-for-update', () => {
  console.log('[AutoUpdater] =================================================');
  console.log('[AutoUpdater] 🔍 Checking for updates...');
  console.log('[AutoUpdater] Current version:', app.getVersion());
  console.log('[AutoUpdater] =================================================');
  if (splashWindow && !splashWindow.isDestroyed()) {
    updateSplashStatus('Checking for updates...');
  }
});

autoUpdater.on('update-available', (info) => {
  console.log('[AutoUpdater] =================================================');
  console.log('[AutoUpdater] ✅ UPDATE AVAILABLE!');
  console.log('[AutoUpdater] Current version:', app.getVersion());
  console.log('[AutoUpdater] New version:', info.version);
  console.log('[AutoUpdater] Release date:', info.releaseDate);
  console.log('[AutoUpdater] Download URL:', info.files?.[0]?.url);
  console.log('[AutoUpdater] Starting download...');
  console.log('[AutoUpdater] =================================================');
  if (splashWindow && !splashWindow.isDestroyed()) {
    updateSplashStatus(`Downloading v${info.version}...`, 0);
  }
});

autoUpdater.on('update-not-available', (info) => {
  console.log('[AutoUpdater] =================================================');
  console.log('[AutoUpdater] ℹ️  No updates available');
  console.log('[AutoUpdater] Current version:', app.getVersion());
  console.log('[AutoUpdater] Latest version:', info.version);
  console.log('[AutoUpdater] Launching app...');
  console.log('[AutoUpdater] =================================================');
  if (splashWindow && !splashWindow.isDestroyed()) {
    updateSplashStatus('Launching...', 100);
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
});

autoUpdater.on('download-progress', (progress) => {
  const percent = progress.percent;
  console.log(`[AutoUpdater] Download progress: ${percent.toFixed(1)}%`);
  if (splashWindow && !splashWindow.isDestroyed()) {
    updateSplashStatus(`Downloading update...`, percent);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('[AutoUpdater] Update downloaded:', info.version);
  console.log('[AutoUpdater] Update will be installed on quit');
  if (splashWindow && !splashWindow.isDestroyed()) {
    updateSplashStatus('Update ready! Restarting...', 100);
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }
      // Quit and install the update
      autoUpdater.quitAndInstall(false, true);
    }, 1000);
  }
});

autoUpdater.on('error', (err) => {
  console.error('[AutoUpdater] Update error:', err);
  if (splashWindow && !splashWindow.isDestroyed()) {
    updateSplashStatus('Launching...', 100);
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
});

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

  // In production, show splash and check for updates
  if (!isDev) {
    createSplashWindow();
    // Check for updates after splash window is ready
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        console.error('[AutoUpdater] Failed to check for updates:', err);
        // On error, close splash and launch app
        if (splashWindow && !splashWindow.isDestroyed()) {
          splashWindow.close();
          splashWindow = null;
        }
        createWindow();
      });
    }, 1000);
  } else {
    // In development - launch directly
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

  ipcMain.handle('is-fullscreen', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win?.isFullScreen() || false;
  });

  // Listen for fullscreen state changes and notify renderer
  if (mainWindow) {
    mainWindow.on('enter-full-screen', () => {
      mainWindow?.webContents.send('fullscreen-changed', true);
    });

    mainWindow.on('leave-full-screen', () => {
      mainWindow?.webContents.send('fullscreen-changed', false);
    });
  }

  // Handle open logs folder request
  ipcMain.on('open-logs', () => {
    const logPath = log.transports.file.getFile().path;
    const logDir = require('path').dirname(logPath);
    shell.openPath(logDir);
  });

  // Handle check for updates manually
  ipcMain.on('check-updates', () => {
    console.log('[AutoUpdater] Manual update check requested');
    autoUpdater.checkForUpdates();
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
