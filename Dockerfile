# Stage 1: Build Piper TTS
FROM debian:bullseye as build
ARG TARGETARCH
ARG TARGETVARIANT

ENV LANG C.UTF-8
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install --yes --no-install-recommends \
        build-essential cmake ca-certificates curl pkg-config git

WORKDIR /build

COPY ./ ./
RUN cmake -Bbuild -DCMAKE_INSTALL_PREFIX=install
RUN cmake --build build --config Release
RUN cmake --install build

ENTRYPOINT ["/piper"]

# Do a test run
RUN ./build/piper --help

# Build .tar.gz to keep symlinks
WORKDIR /dist
RUN mkdir -p piper && \
    cp -dR /build/install/* ./piper/ && \
    tar -czf "piper_${TARGETARCH}${TARGETVARIANT}.tar.gz" piper/

  # Stage 2: Set up Node.js and Piper TTS
FROM debian:bullseye

# Install Node.js
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs

# Install dependencies for your Node.js server
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install

# Copy the Piper TTS application
COPY --from=build /dist/piper_*.tar.gz ./
RUN tar -xzf piper_*.tar.gz && \
    rm piper_*.tar.gz

# Copy Node.js server code
COPY server.js ./

# Expose port for the Node.js server
EXPOSE 3000

# Set up entrypoint
ENTRYPOINT ["node", "server.js"]