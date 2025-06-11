class VinylPlayer {    constructor() {
        this.isAuthenticated = false;
        this.currentTrack = null;
        this.isPlaying = false;
        this.checkInterval = null;
        this.hasSpotifyPremium = null; // null = unknown, true = has premium, false = no premium
        this.mediaServiceStarted = false;
        
        this.initializeElements();
        this.bindEvents();
    }    initializeElements() {
        this.loginBtn = document.getElementById('login-btn');
        this.logoutBtn = document.getElementById('logout-btn');
        this.userInfo = document.getElementById('user-info');
        this.vinylRecord = document.getElementById('vinyl-record');
        this.albumArt = document.getElementById('album-art');
        this.tonearm = document.getElementById('tonearm');
        this.trackInfo = document.getElementById('track-info');
        this.closeBtn = document.getElementById('close-btn');
        this.minimizeBtn = document.getElementById('minimize-btn');
    }    bindEvents() {
        // Authentication
        this.loginBtn.addEventListener('click', () => this.handleLogin());
        this.logoutBtn.addEventListener('click', () => this.handleLogout());
        window.electronAPI.onAuthSuccess(() => this.handleAuthSuccess());
        window.electronAPI.onAuthError((event, error) => this.handleAuthError(error));// Close and minimize buttons
        this.closeBtn.addEventListener('click', () => {
            window.electronAPI.closeWindow();
        });
        
        this.minimizeBtn.addEventListener('click', () => {
            window.electronAPI.minimizeWindow();
        });

        // Tonearm click to toggle playback
        this.tonearm.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event bubbling
            this.togglePlayback();
        });// Media service events (for display purposes only)
        window.electronAPI.onMediaServicePlay(() => this.handleMediaServicePlay());
        window.electronAPI.onMediaServicePause(() => this.handleMediaServicePause());
        window.electronAPI.onMediaServicePlayPause(() => this.handleMediaServicePlayPause());        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.togglePlayback();
            }
            // Restore window with Ctrl+Shift+R
            if (e.ctrlKey && e.shiftKey && e.code === 'KeyR') {
                e.preventDefault();
                window.electronAPI.restoreWindow();
            }
        });
    }

    async handleLogin() {
        try {
            await window.electronAPI.spotifyLogin();
            this.loginBtn.textContent = 'Connecting...';
            this.loginBtn.disabled = true;
        } catch (error) {
            console.error('Login failed:', error);
            this.showNotification('Login failed. Please try again.', 'error');
        }
    }    async handleAuthSuccess() {
        this.isAuthenticated = true;
        this.loginBtn.classList.add('hidden');
        this.userInfo.classList.remove('hidden');
        
        this.showNotification('Connected!', 'success');
        this.startCheckingCurrentTrack();
        
        // Start media service for system-wide control
        await this.startMediaService();
    }

    handleAuthError(error) {
        console.error('Authentication error:', error);
        this.loginBtn.textContent = 'Connect to Spotify';
        this.loginBtn.disabled = false;
        this.showNotification(`Authentication failed: ${error}`, 'error');
    }

    startCheckingCurrentTrack() {
        // Check for current track every 2 seconds
        this.checkInterval = setInterval(async () => {
            await this.updateCurrentTrack();
        }, 2000);
          // Initial check
        this.updateCurrentTrack();
    }

    async startMediaService() {
        try {
            const result = await window.electronAPI.startMediaService();
            if (result.success) {
                this.mediaServiceStarted = true;
                console.log('Media service started successfully');
            } else {
                console.error('Failed to start media service:', result.error);
            }
        } catch (error) {
            console.error('Error starting media service:', error);
        }
    }

    handleMediaServicePlay() {
        console.log('Media service play event received');
        this.showNotification('🎵 System play command received', 'info');
    }

    handleMediaServicePause() {
        console.log('Media service pause event received');
        this.showNotification('⏸️ System pause command received', 'info');
    }

    handleMediaServicePlayPause() {
        console.log('Media service play/pause event received');
        this.showNotification('⏯️ System play/pause command received', 'info');
    }async updateCurrentTrack() {
        try {
            const trackData = await window.electronAPI.getCurrentTrack();
            if (trackData && trackData.item) {
                const newTrack = trackData.item;
                const wasPlaying = trackData.is_playing;
                
                // Update current track if different
                if (!this.currentTrack || this.currentTrack.id !== newTrack.id) {
                    this.currentTrack = newTrack;
                    this.updateTrackDisplay();
                }
                
                // Update playing state
                this.isPlaying = wasPlaying;
                this.updatePlayingState();
            }
        } catch (error) {
            console.error('Failed to get current track:', error);
        }
    }    updateTrackDisplay() {
        if (!this.currentTrack) {
            this.trackInfo.querySelector('.track-title').textContent = 'Click needle to play';
            this.trackInfo.querySelector('.track-artist').textContent = 'Connect to Spotify';
            this.albumArt.innerHTML = '<div class="default-art">🎵</div>';
            return;
        }

        const track = this.currentTrack;
        
        // Update track info
        this.trackInfo.querySelector('.track-title').textContent = track.name;
        this.trackInfo.querySelector('.track-artist').textContent = track.artists.map(a => a.name).join(', ');

        // Update album art
        this.albumArt.innerHTML = '';
        if (track.album.images && track.album.images.length > 0) {
            const img = document.createElement('img');
            img.src = track.album.images[0].url;
            img.alt = track.album.name;
            this.albumArt.appendChild(img);
        } else {
            this.albumArt.innerHTML = '<div class="default-art">🎵</div>';
        }
    }

    updatePlayingState() {
        if (this.isPlaying) {
            this.vinylRecord.classList.add('spinning');
            this.tonearm.classList.add('on-record');
        } else {
            this.vinylRecord.classList.remove('spinning');
            this.tonearm.classList.remove('on-record');
        }
    }    async togglePlayback() {
        if (!this.isAuthenticated) {
            this.showNotification('Connect to Spotify first', 'warning');
            return;
        }

        try {
            if (this.isPlaying) {
                const result = await window.electronAPI.pauseTrack();
                if (result.success) {
                    this.isPlaying = false;
                    this.updatePlayingState();                    this.showNotification('Paused', 'info');
                    this.hasSpotifyPremium = true;
                } else if (result.error === 'PREMIUM_REQUIRED') {
                    this.hasSpotifyPremium = false;
                    this.showNotification('Premium required', 'warning');
                } else {
                    this.showNotification(`Failed to pause: ${result.message}`, 'error');
                }
            } else {
                const result = await window.electronAPI.playTrack();
                if (result.success) {
                    this.isPlaying = true;
                    this.updatePlayingState();                    this.showNotification('Playing', 'success');
                    this.hasSpotifyPremium = true;
                } else if (result.error === 'PREMIUM_REQUIRED') {
                    this.hasSpotifyPremium = false;
                    this.showNotification('Premium required', 'warning');
                } else {
                    this.showNotification(`Failed to play: ${result.message}`, 'error');
                }
            }
        } catch (error) {
            console.error('Playback control failed:', error);
            this.showNotification('Playback control failed', 'error');
        }
    }    async handleLogout() {
        try {
            // Clear authentication state
            this.isAuthenticated = false;
            this.currentTrack = null;
            this.hasSpotifyPremium = null;
            
            // Stop checking for current track
            if (this.checkInterval) {
                clearInterval(this.checkInterval);
                this.checkInterval = null;
            }
            
            // Reset UI
            this.loginBtn.classList.remove('hidden');
            this.userInfo.classList.add('hidden');
            this.loginBtn.textContent = '🎵 Connect';
            this.loginBtn.disabled = false;
            
            // Reset vinyl player state
            this.vinylRecord.classList.remove('spinning');
            this.tonearm.classList.remove('on-record');
            this.isPlaying = false;
            
            // Reset track display
            this.trackInfo.querySelector('.track-title').textContent = 'Click needle to play';
            this.trackInfo.querySelector('.track-artist').textContent = 'Connect to Spotify';
            this.albumArt.innerHTML = '<div class="default-art">🎵</div>';
            
            // Clear tokens via IPC
            await window.electronAPI.clearTokens();
            
            this.showNotification('Logged out successfully', 'info');
        } catch (error) {
            console.error('Logout failed:', error);
            this.showNotification('Logout failed', 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '1rem 1.5rem',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '500',
            zIndex: '10000',
            maxWidth: '300px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease'
        });

        // Set background color based on type
        const colors = {
            success: '#1DB954',
            error: '#ff6b6b',
            warning: '#ff9500',
            info: '#4ecdc4'
        };
        notification.style.background = colors[type] || colors.info;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new VinylPlayer();
});
