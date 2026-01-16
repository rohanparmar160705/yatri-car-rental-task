# Use Node 20 Alpine for a lightweight image
FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Expose the API port
EXPOSE 5000

# Set environment to production (optional, can be overridden)
ENV NODE_ENV=production

# Start the application
CMD ["node", "src/server.js"]
