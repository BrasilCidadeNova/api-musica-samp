FROM node:18-bullseye-slim

# Instala Python, ffmpeg e curl
RUN apt-get update && apt-get install -y python3 curl ffmpeg && rm -rf /var/lib/apt/lists/*

# Instala o yt-dlp atualizado
RUN curl -L https://github.com -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 3000
CMD ["npm", "start"]
