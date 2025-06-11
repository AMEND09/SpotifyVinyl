const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const SpotifyWebApi = require('spotify-web-api-node');
const MediaService = require('electron-media-service');

let mainWindow;
let spotifyApi;
let mediaService;
let tray;

// Spotify API credentials (you'll need to register your app at https://developer.spotify.com/)
// You can either set these directly here or create a config.js file
let config;
try {
  config = require('./config.js');
} catch (error) {
  // Fallback to direct configuration if config.js doesn't exist
  config = {    spotify: {
      clientId: 'your_spotify_client_id',
      clientSecret: 'your_spotify_client_secret',
      redirectUri: 'vinyl-music-player://oauth/callback'
    }
  };
}

const clientId = config.spotify.clientId;
const clientSecret = config.spotify.clientSecret;
const redirectUri = config.spotify.redirectUri;

// Token cache file path
const tokenCachePath = path.join(app.getPath('userData'), 'spotify-tokens.json');

// Token cache functions
function saveTokens(accessToken, refreshToken, expiresIn) {
  const tokens = {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + (expiresIn * 1000) - 60000 // Subtract 1 minute for safety
  };
  
  try {
    fs.writeFileSync(tokenCachePath, JSON.stringify(tokens, null, 2));
    console.log('Tokens saved to cache');
  } catch (error) {
    console.error('Error saving tokens:', error);
  }
}

function loadTokens() {
  try {
    if (fs.existsSync(tokenCachePath)) {
      const tokens = JSON.parse(fs.readFileSync(tokenCachePath, 'utf8'));
      
      // Check if tokens are still valid
      if (tokens.expiresAt > Date.now()) {
        console.log('Valid tokens found in cache');
        return tokens;
      } else {
        console.log('Cached tokens expired, will try refresh token');
        return tokens; // Return even if expired, we might be able to refresh
      }
    }
  } catch (error) {
    console.error('Error loading tokens:', error);
  }
  return null;
}

function clearTokens() {
  try {
    if (fs.existsSync(tokenCachePath)) {
      fs.unlinkSync(tokenCachePath);
      console.log('Token cache cleared');
    }
  } catch (error) {
    console.error('Error clearing tokens:', error);
  }
}

function createWindow() {
  // Choose the best icon format
  const pngIconPath = path.join(__dirname, 'assets', 'icon.png');
  const icoIconPath = path.join(__dirname, 'assets', 'icon.ico');
  const iconPath = fs.existsSync(pngIconPath) ? pngIconPath : icoIconPath;
    mainWindow = new BrowserWindow({
    width: 320,
    height: 380,
    minWidth: 280,
    minHeight: 320,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: iconPath,
    frame: false,
    backgroundColor: '#1a1a1a',
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    show: true,
    maximizable: false,
    focusable: true,
    closable: true,
    minimizable: true
  });

  mainWindow.loadFile('index.html');

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Prevent window from hiding when losing focus
  mainWindow.on('blur', () => {
    // Keep the window visible even when it loses focus
    if (!mainWindow.isMinimized()) {
      mainWindow.setAlwaysOnTop(true);
    }
  });

  mainWindow.on('minimize', () => {
    // When minimized, hide from taskbar but keep tray icon
    mainWindow.setSkipTaskbar(true);
  });

  mainWindow.on('restore', () => {
    // When restored, show in taskbar again
    mainWindow.setSkipTaskbar(false);
    mainWindow.setAlwaysOnTop(true);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create system tray
  createTray();
}

function setupSpotifyAuth() {
  spotifyApi = new SpotifyWebApi({
    clientId: clientId,
    clientSecret: clientSecret,
    redirectUri: redirectUri
  });

  // Initialize media service
  mediaService = new MediaService();

  // Try to load cached tokens
  const cachedTokens = loadTokens();
  if (cachedTokens) {
    spotifyApi.setAccessToken(cachedTokens.accessToken);
    if (cachedTokens.refreshToken) {
      spotifyApi.setRefreshToken(cachedTokens.refreshToken);
    }
    
    // If tokens are expired, try to refresh them
    if (cachedTokens.expiresAt <= Date.now() && cachedTokens.refreshToken) {
      console.log('Tokens expired, attempting refresh...');
      spotifyApi.refreshAccessToken()
        .then(data => {
          console.log('Tokens refreshed successfully');
          spotifyApi.setAccessToken(data.body['access_token']);
          saveTokens(data.body['access_token'], cachedTokens.refreshToken, data.body['expires_in']);
          
          // Notify renderer that auth is ready
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('auth-success');
          }
        })
        .catch(err => {
          console.error('Error refreshing tokens:', err);
          clearTokens(); // Clear invalid tokens
        });
    } else if (cachedTokens.expiresAt > Date.now()) {
      // Tokens are still valid, notify renderer
      setTimeout(() => {
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('auth-success');
        }
      }, 1000); // Delay to ensure renderer is ready
    }
  }

  // Set app as default protocol handler for development
  if (process.env.NODE_ENV !== 'production') {
    // In development, we need to set the protocol handler with the electron executable
    if (!app.isDefaultProtocolClient('vinyl-music-player', process.execPath, [path.resolve(process.argv[1])])) {
      app.setAsDefaultProtocolClient('vinyl-music-player', process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    // In production, use the normal protocol registration
    if (!app.isDefaultProtocolClient('vinyl-music-player')) {
      app.setAsDefaultProtocolClient('vinyl-music-player');
    }
  }

  // Handle protocol URLs (macOS)
  app.on('open-url', (event, url) => {
    event.preventDefault();
    console.log('Protocol URL received via open-url:', url);
    handleProtocolUrl(url);
  });

  // Handle command line arguments (Windows/Linux)
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    console.log('Second instance detected, command line:', commandLine);
    
    // Someone tried to run a second instance, focus our window and handle the protocol
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }

    // Handle protocol URL from command line
    const url = commandLine.find(arg => arg.startsWith('vinyl-music-player://'));
    if (url) {
      console.log('Protocol URL found in command line:', url);
      handleProtocolUrl(url);
    }
  });
}

function handleProtocolUrl(url) {
  console.log('Handling protocol URL:', url);
  
  try {
    // Parse the URL to extract the authorization code
    const urlObj = new URL(url);
    const code = urlObj.searchParams.get('code');
    const error = urlObj.searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('auth-error', error);
      }
      return;
    }

    if (code) {
      console.log('Found authorization code, exchanging for tokens...');      // Exchange authorization code for access token
      spotifyApi.authorizationCodeGrant(code)
        .then(data => {
          console.log('Token exchange successful');
          spotifyApi.setAccessToken(data.body['access_token']);
          spotifyApi.setRefreshToken(data.body['refresh_token']);
          
          // Save tokens to cache
          saveTokens(data.body['access_token'], data.body['refresh_token'], data.body['expires_in']);
          
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('auth-success');
          }
        })
        .catch(err => {
          console.error('Error getting tokens:', err);
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('auth-error', err.message);
          }
        });
    } else {
      console.warn('No authorization code found in URL');
    }
  } catch (err) {
    console.error('Error parsing protocol URL:', err);
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('auth-error', 'Invalid callback URL');
    }
  }
}

app.whenReady().then(() => {
  // Ensure single instance
  const gotTheLock = app.requestSingleInstanceLock();
  
  if (!gotTheLock) {
    app.quit();
    return;
  }
  createWindow();
  setupSpotifyAuth();

  // Register global shortcut to restore window
  const shortcutRegistered = globalShortcut.register('CommandOrControl+Shift+V', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized() || !mainWindow.isVisible()) {
        mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
        mainWindow.setAlwaysOnTop(true);
      }
    }
  });

  if (!shortcutRegistered) {
    console.log('Failed to register global shortcut');
  } else {
    console.log('Global shortcut registered: Ctrl+Shift+V to restore window');
  }

  // Handle protocol URL on startup (if app was opened via protocol)
  if (process.platform === 'win32') {
    // On Windows, check process.argv for protocol URLs
    console.log('Process argv:', process.argv);
    const protocolUrl = process.argv.find(arg => arg.startsWith('vinyl-music-player://'));
    if (protocolUrl) {
      console.log('Found protocol URL on startup:', protocolUrl);
      // Delay handling to ensure the app is fully initialized
      setTimeout(() => {
        handleProtocolUrl(protocolUrl);
      }, 1000);
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Don't quit the app when window is closed, keep running in system tray
  // The app will only quit when explicitly closed from tray menu
});

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
});

function createTray() {
  try {
    // Try to load your PNG icon first
    const pngIconPath = path.join(__dirname, 'assets', 'icon.png');
    const icoIconPath = path.join(__dirname, 'assets', 'icon.ico');
    
    let trayIcon;
    
    // Check for PNG first (recommended format)
    if (fs.existsSync(pngIconPath)) {
      console.log('Loading PNG icon from:', pngIconPath);
      trayIcon = nativeImage.createFromPath(pngIconPath);
      
      // Resize to appropriate tray size
      if (!trayIcon.isEmpty()) {
        trayIcon = trayIcon.resize({ width: 16, height: 16 });
        console.log('Successfully loaded PNG icon');
      }
    }
    
    // Fallback to ICO if PNG failed or doesn't exist
    if (!trayIcon || trayIcon.isEmpty()) {
      if (fs.existsSync(icoIconPath)) {
        console.log('Fallback to ICO icon from:', icoIconPath);
        trayIcon = nativeImage.createFromPath(icoIconPath);
        if (!trayIcon.isEmpty()) {
          trayIcon = trayIcon.resize({ width: 16, height: 16 });
          console.log('Successfully loaded ICO icon');
        }
      }
    }
    
    // Final fallback: create a simple programmatic icon
    if (!trayIcon || trayIcon.isEmpty()) {
      console.log('Using fallback programmatic icon');
      trayIcon = nativeImage.createFromBuffer(Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x10,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x91, 0x68, 0x36, 0x00, 0x00, 0x00,
        0x0C, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0xF8, 0x0F, 0x00, 0x00,
        0x01, 0x00, 0x01, 0x00, 0x18, 0xDD, 0x8D, 0xB4, 0x00, 0x00, 0x00, 0x00,
        0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]));
    }

    tray = new Tray(trayIcon);
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '🎵 Show Vinyl Player',
        click: () => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) {
              mainWindow.restore();
            }
            mainWindow.show();
            mainWindow.focus();
            mainWindow.setAlwaysOnTop(true);
          }
        }
      },
      {
        label: '➖ Minimize to Tray',
        click: () => {
          if (mainWindow) {
            mainWindow.minimize();
          }
        }
      },
      { type: 'separator' },
      {
        label: '❌ Quit',
        click: () => {
          if (mainWindow) {
            mainWindow.destroy();
          }
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);
    tray.setToolTip('🎵 Vinyl Music Player');

    // Single click to restore (more intuitive on Windows)
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized() || !mainWindow.isVisible()) {
          mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
          mainWindow.setAlwaysOnTop(true);
        } else {
          mainWindow.minimize();
        }
      }
    });

    console.log('Tray created successfully');
  } catch (error) {
    console.error('Failed to create tray:', error);
    console.log('App will continue without system tray');
    
    // Add a fallback - use Alt+Tab to restore minimized window
    console.log('Use Ctrl+Shift+R to restore window when minimized');
  }
}

// IPC handlers
// Window controls
ipcMain.handle('minimize-window', async () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle('close-window', async () => {
  if (mainWindow) {
    // Minimize to tray instead of actually closing
    mainWindow.minimize();
  }
});

ipcMain.handle('restore-window', async () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  }
});

ipcMain.handle('spotify-login', async () => {
  const scopes = ['user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing', 'streaming'];
  const authorizeURL = spotifyApi.createAuthorizeURL(scopes);
  shell.openExternal(authorizeURL);
});

ipcMain.handle('get-current-track', async () => {
  try {
    const data = await spotifyApi.getMyCurrentPlayingTrack();
    return data.body;
  } catch (err) {
    console.error('Error getting current track:', err);
    return null;
  }
});

ipcMain.handle('play-track', async (event, trackUri) => {
  try {
    if (trackUri) {
      await spotifyApi.play({ uris: [trackUri] });
    } else {
      // Resume current playback
      await spotifyApi.play();
    }
    return { success: true };
  } catch (err) {
    console.error('Error playing track:', err);
    
    if (err.body && err.body.error && err.body.error.reason === 'PREMIUM_REQUIRED') {
      return { success: false, error: 'PREMIUM_REQUIRED', message: 'Spotify Premium is required to control playback' };
    }
    
    return { success: false, error: 'PLAYBACK_ERROR', message: err.message || 'Failed to play track' };
  }
});

ipcMain.handle('pause-track', async () => {
  try {
    await spotifyApi.pause();
    return { success: true };
  } catch (err) {
    console.error('Error pausing track:', err);
    
    if (err.body && err.body.error && err.body.error.reason === 'PREMIUM_REQUIRED') {
      return { success: false, error: 'PREMIUM_REQUIRED', message: 'Spotify Premium is required to control playback' };
    }
    
    return { success: false, error: 'PLAYBACK_ERROR', message: err.message || 'Failed to pause track' };
  }
});

// Media service control handlers
ipcMain.handle('start-media-service', async () => {
  try {
    if (!mediaService.isStarted()) {
      mediaService.startService();
      
      // Set up media service event handlers to communicate with renderer
      mediaService.on('play', () => {
        console.log('Media service received play command');
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('media-service-play');
        }
      });
      
      mediaService.on('pause', () => {
        console.log('Media service received pause command');
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('media-service-pause');
        }
      });
      
      mediaService.on('playPause', () => {
        console.log('Media service received playPause command');
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('media-service-playpause');
        }
      });
    }
    return { success: true };
  } catch (err) {
    console.error('Error starting media service:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('stop-media-service', async () => {
  try {
    if (mediaService.isStarted()) {
      mediaService.stopService();
    }
    return { success: true };
  } catch (err) {
    console.error('Error stopping media service:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update-media-metadata', async (event, metadata) => {
  try {
    if (mediaService.isStarted()) {
      mediaService.setMetaData(metadata);
    }
    return { success: true };
  } catch (err) {
    console.error('Error updating media metadata:', err);
    return { success: false, error: err.message };  }
});

ipcMain.handle('get-playback-state', async () => {
  try {
    const data = await spotifyApi.getMyCurrentPlaybackState();
    if (data.body && data.body.is_playing) {
      return {
        success: true,
        is_playing: data.body.is_playing,
        progress_ms: data.body.progress_ms,
        item: data.body.item,
        duration_ms: data.body.item ? data.body.item.duration_ms : 0
      };
    } else {
      return {
        success: true,
        is_playing: false,
        progress_ms: 0,
        item: null,
        duration_ms: 0
      };
    }
  } catch (err) {
    console.error('Error getting playback state:', err);
    return { success: false, error: err.message || 'Failed to get playback state' };
  }
});

ipcMain.handle('clear-tokens', async () => {
  try {
    clearTokens();
    // Reset Spotify API tokens
    if (spotifyApi) {
      spotifyApi.resetAccessToken();
      spotifyApi.resetRefreshToken();
    }
    return { success: true };
  } catch (error) {
    console.error('Error clearing tokens:', error);
    return { success: false, error: error.message };
  }
});
