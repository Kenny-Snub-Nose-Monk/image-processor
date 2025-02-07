FROM node:18-slim

WORKDIR /app

# Install sharp dependencies and typescript
RUN apt-get update && apt-get install -y \
    apt-utils \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first for better caching
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies including typescript
RUN npm install

# Copy source code
COPY src ./src
COPY key.json ./key.json

# Build TypeScript code
RUN npm run build

# Verify the build output
RUN ls -la dist/

ENV PORT=8080
EXPOSE 8080

# Run npm start
CMD [ "npm", "start" ]