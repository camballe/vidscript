#### Dockerfile
# filepath: Dockerfile

# Use a lightweight Node image
FROM node:18-alpine

# Install Bun (optional, if you really want it)
RUN apk add --no-cache curl bash \
    && curl -fsSL https://bun.sh/install | bash

# Install system dependencies (e.g., FFmpeg)
RUN apk add --no-cache ffmpeg yt-dlp

# Create app directory
WORKDIR /app

# Copy package files and install
COPY package.json package-lock.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Set CLI entrypoint (change if you want a different entrypoint)
ENTRYPOINT ["npm", "start"]