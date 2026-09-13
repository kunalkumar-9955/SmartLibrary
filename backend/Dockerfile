# Build Stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install all dependencies (including devDependencies for TypeScript compilation)
COPY package*.json ./
RUN npm ci

# Copy configuration and source files explicitly
COPY tsconfig.json ./
COPY src ./src

# Compile TypeScript to dist
RUN npm run build

# Production Runner Stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled JavaScript from builder stage
COPY --from=builder /app/dist ./dist

# Ensure uploads directory exists
RUN mkdir -p uploads

# Expose port and start server
EXPOSE 5000
CMD ["node", "dist/server.js"]
