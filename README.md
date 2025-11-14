# Discord Music Bot 🎵

A powerful Discord music bot built with Discord.js v14 that streams music from YouTube with queue management and interactive controls.

## ✨ Features

- 🎵 Play music from YouTube (search by name or URL)
- 📝 Queue management with multiple songs
- ⏯️ Interactive controls (Pause, Resume, Skip, Stop)
- 🔘 Button-based interface for easy control
- 🚀 Fast playback with stream URL caching
- 🔄 Auto-reconnect when moved between voice channels
- 🎨 Beautiful embeds with song information
- 👥 Accessible to all server members

## 🛠️ Tech Stack

- **Discord.js** v14.16.0 - Discord API wrapper
- **@discordjs/voice** v0.17.0 - Voice connection handling
- **yt-dlp** - YouTube stream extraction
- **yt-search** v2.11.0 - YouTube search functionality
- **ffmpeg-static** v5.2.0 - Audio processing
- **sodium-native** v4.3.0 - Voice encryption

## 📋 Commands

| Command | Description |
|---------|-------------|
| `/play <song>` | Play a song or add to queue |
| `/queue` | Display current queue |
| `/skip` | Skip current song |
| `/stop` | Stop playback and disconnect |
| `/pause` | Pause current song |
| `/resume` | Resume paused song |

## 🎮 Interactive Buttons

Each song comes with interactive buttons:
- ⏸️ **Pause** - Pause playback
- ▶️ **Resume** - Resume playback
- ⏭️ **Skip** - Skip to next song
- ⏹️ **Stop** - Stop and disconnect

## 📁 Project Structure

```
discord-music-bot/
├── src/
│   ├── commands/
│   │   ├── play.js      # Main playback logic
│   │   ├── queue.js     # Queue display
│   │   ├── skip.js      # Skip command
│   │   ├── stop.js      # Stop command
│   │   ├── pause.js     # Pause command
│   │   └── resume.js    # Resume command
│   ├── queue.js         # Queue management class
│   └── utils/
│       └── youtube.js   # YouTube utilities
├── data/                # Data directory
├── index.js             # Bot entry point
├── package.json         # Dependencies
├── .env.example         # Environment template
├── .gitignore          # Git ignore rules
├── yt-dlp.exe          # YouTube downloader
├── DEPLOYMENT_GUIDE.md # Deployment instructions
└── README.md           # This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js v18 or higher
- Discord account
- Git (for deployment)

### Local Setup

1. **Clone the repository**
```bash
git clone https://github.com/YOUR_USERNAME/discord-music-bot.git
cd discord-music-bot
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
# Copy example file
cp .env.example .env

# Edit .env and add:
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_id_here
```

4. **Run the bot**
```bash
npm start
```

## 🔧 Discord Bot Setup

### 1. Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** and name it
3. Go to **Bot** tab → Click **Add Bot**
4. Copy the **Token** (keep it secret!)
5. Enable these options:
   - ✅ Presence Intent
   - ✅ Server Members Intent
   - ✅ Message Content Intent

### 2. Get Application ID

1. Go to **General Information** tab
2. Copy **Application ID** (this is your CLIENT_ID)

### 3. Invite Bot to Server

Use this URL (replace `YOUR_CLIENT_ID`):
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=3146752&scope=bot%20applications.commands
```

Permissions included:
- Connect to voice channels
- Speak in voice channels
- Send messages
- Embed links
- Use slash commands

## 📦 Deployment

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for detailed deployment instructions for:
- Render (Free hosting)
- Heroku
- Railway
- VPS/Cloud servers

## ⚙️ Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DISCORD_TOKEN` | Your bot token from Discord Developer Portal | ✅ Yes |
| `CLIENT_ID` | Your application ID | ✅ Yes |
| `PIPED_INSTANCE` | (Optional) Override the default Piped API instance for YouTube streams | ❌ |
| `KEEPALIVE_URL` | (Optional) URL to ping every ~14 minutes to keep Render awake | ❌ |

## 🐛 Troubleshooting

**Bot not playing music:**
- Ensure the configured Piped instance (or the default https://piped.video) is reachable
- Check that ffmpeg-static and sodium-native installed successfully
- Verify the bot has permission to join/speak in the channel

**Commands not showing:**
- Wait a few minutes for Discord to sync commands
- Check bot has `applications.commands` scope
- Verify CLIENT_ID is correct

**Voice encryption error:**
- Run: `npm install sodium-native`
- Restart the bot

**Bot goes offline / Unknown interaction:**
- Set `KEEPALIVE_URL` to your Render URL and redeploy (prevents the service from sleeping)
- Alternatively, ping the URL with UptimeRobot / cron-job.org every 10 minutes

## 📝 License

MIT License - Feel free to use this project!

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first.

## 🙏 Credits

- Built with [Discord.js](https://discord.js.org/)
- Powered by [yt-dlp](https://github.com/yt-dlp/yt-dlp)

---

Made with ❤️ for Discord music lovers