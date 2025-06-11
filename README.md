# 🎵 Vinyl Music Player

A beautiful vintage-inspired music player built with Electron that connects to Spotify. Features a realistic vinyl record interface where you control playback by moving the tonearm onto the record.

## ✨ Features

- **Vintage Vinyl Interface**: Realistic turntable with spinning record and movable tonearm
- **Spotify Integration**: Search and play music from your Spotify account
- **Interactive Controls**: Drag the needle onto the record to play, off to pause
- **Album Art Display**: Shows album artwork on the vinyl record label
- **Playlist Support**: View your Spotify playlists
- **Beautiful UI**: Modern glassmorphism design with smooth animations

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- A Spotify account
- Spotify application (desktop or web player) open and active

### Spotify API Setup

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Note your **Client ID** and **Client Secret**
4. Add `vinyl-music-player://oauth/callback` to your app's redirect URIs

### Installation

1. **Clone or download this project**

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Spotify credentials:**
   Copy `config.template.js` to `config.js` and update with your credentials:
   ```javascript
   module.exports = {
     spotify: {
       clientId: 'your_actual_client_id',
       clientSecret: 'your_actual_client_secret',
       redirectUri: 'vinyl-music-player://oauth/callback'
     }
   };
   ```

4. **Run the application:**
   ```bash
   npm start
   ```

## 🎮 How to Use

1. **Connect to Spotify**: Click the "🎵 Connect" button and authorize the app
2. **View Current Track**: The app will automatically show what's currently playing on Spotify
3. **Control Playback** (Premium only): Click the needle to play/pause music
4. **Track Display**: Album art and track info update automatically
5. **Logout**: Click the "🚪 Logout" button to disconnect from Spotify
6. **System Tray**: The app runs in the system tray when minimized - click the tray icon to restore

## 🎨 Interface Elements

- **Turntable**: The main vinyl record player interface
- **Vinyl Record**: Shows album art and spins when playing
- **Tonearm**: Clickable needle that controls playback (rotates when playing/paused)
- **Track Info**: Displays current song details
- **Control Buttons**: Connect/Logout, Minimize, and Close buttons
- **System Tray**: Access the app when minimized

## 🔧 Development

### Run in Development Mode
```bash
npm run dev
```

### Build for Distribution
```bash
npm run build
```

## 📋 Requirements

- **Spotify Premium**: **REQUIRED** for playback control (play/pause/skip)
- **Free Spotify accounts**: Can only view current track information
- **Active Spotify Session**: The Spotify app must be open and active on your device
- **Internet Connection**: Required for Spotify API access

## 🛠️ Technologies Used

- **Electron**: Cross-platform desktop app framework
- **Node.js**: JavaScript runtime
- **Spotify Web API**: Music streaming service integration
- **HTML/CSS/JavaScript**: Frontend technologies
- **Express**: Local server for OAuth handling

## 🎵 Controls

- **Mouse**: Drag the tonearm to control playback
- **Spacebar**: Toggle play/pause (keyboard shortcut)
- **Search**: Type to search for music
- **Click**: Select tracks and playlists

## 🔒 Privacy & Security

- Your Spotify credentials are handled securely through OAuth
- No personal data is stored locally
- All music streaming is handled by Spotify's official API

## 📝 Notes

- Make sure Spotify is open and active on your device for playback to work
- The app requires an internet connection to function
- Album artwork is provided by Spotify's API
- Playback controls require Spotify Premium

## 🐛 Troubleshooting

**Music won't play:**
- Ensure Spotify is open and active on your device
- Check that you have Spotify Premium
- Verify your internet connection

**Connection issues:**
- Double-check your Spotify API credentials
- Ensure the redirect URI is set correctly in your Spotify app settings

**Search not working:**
- Make sure you're connected to Spotify
- Check your internet connection

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📄 License

This project is licensed under the MIT License.

---

**Enjoy your vintage music experience! 🎶**
