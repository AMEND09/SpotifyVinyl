const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {  spotifyLogin: () => ipcRenderer.invoke('spotify-login'),
  getCurrentTrack: () => ipcRenderer.invoke('get-current-track'),
  playTrack: (trackUri) => ipcRenderer.invoke('play-track', trackUri),
  pauseTrack: () => ipcRenderer.invoke('pause-track'),
  clearTokens: () => ipcRenderer.invoke('clear-tokens'),
  
  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  restoreWindow: () => ipcRenderer.invoke('restore-window'),
  
  // Media service controls
  startMediaService: () => ipcRenderer.invoke('start-media-service'),
  stopMediaService: () => ipcRenderer.invoke('stop-media-service'),
  updateMediaMetadata: (metadata) => ipcRenderer.invoke('update-media-metadata', metadata),
  sendMediaPlayPause: () => ipcRenderer.invoke('send-media-playpause'),
  
  // Event listeners
  onAuthSuccess: (callback) => ipcRenderer.on('auth-success', callback),
  onAuthError: (callback) => ipcRenderer.on('auth-error', callback),
  onMediaServicePlay: (callback) => ipcRenderer.on('media-service-play', callback),
  onMediaServicePause: (callback) => ipcRenderer.on('media-service-pause', callback),
  onMediaServicePlayPause: (callback) => ipcRenderer.on('media-service-playpause', callback)
});
