FROM node:18-bullseye

# Install build dependencies required by mediasoup native module
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    pkg-config \
    git \
    curl \
    ca-certificates \
    libssl-dev \
    libavcodec-dev \
    libavformat-dev \
    libavutil-dev \
    libvpx-dev \
    libx264-dev \
    libopus-dev \
    libsrtp2-dev \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy package files first for caching
COPY package.json package-lock.json* ./

# Install dependencies (mediasoup will compile native bindings)
RUN npm install --production

# Copy source
COPY . .

EXPOSE 4000
EXPOSE 10000-10100/udp

ENV NODE_ENV=production

CMD ["node", "server.js"]
