FROM node:18-alpine

WORKDIR /app

# Copy server package configuration and install dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy the server source and static frontend
COPY server/ ./server/
COPY index.html ./

# Expose port and start
EXPOSE 5000
ENV PORT=5000
ENV NODE_ENV=production

CMD ["node", "server/server.js"]
