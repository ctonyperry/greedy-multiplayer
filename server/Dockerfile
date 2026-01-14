FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built files
COPY dist/ ./dist/

# Expose port
EXPOSE 8080

# Start the server
CMD ["node", "dist/index.js"]
