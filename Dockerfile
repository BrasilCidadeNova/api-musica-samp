FROM node:20-bookworm-slim

# Instala Python, ffmpeg, curl e certificados
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    curl \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Instala o yt-dlp atualizado
RUN curl -L https://github.com -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 3000
CMD ["npm", "start"]
