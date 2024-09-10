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

# Do a test run
RUN ./build/piper --help


  # Stage 2: Set up Node.js and Piper TTS
FROM debian:bullseye as final

# Install runtime dependencies including Node.js and onnxruntime via pip
RUN apt-get update && \
    apt-get install --yes --no-install-recommends \
        ca-certificates curl python3 python3-pip && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    python3 -m pip install onnxruntime && \
    apt-get install -y ffmpeg && \
    apt-get clean

# Install dependencies for your Node.js server
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install

# Copy Piper build files from build stage directly
COPY --from=build /build/install/ ./piper/

# Copy voice models to the appropriate folder
COPY voices/ ./voices/

# Copy Node.js server code
COPY server.js ./

# Expose port for the Node.js server
EXPOSE 3005

# Command to start the Node.js server
CMD ["node", "server.js"]