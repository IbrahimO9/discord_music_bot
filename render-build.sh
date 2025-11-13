#!/bin/bash
# Render build script

# Install dependencies
npm install

# Download yt-dlp for Linux
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp
chmod +x yt-dlp

echo "Build completed successfully!"
