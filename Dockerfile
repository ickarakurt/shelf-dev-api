# Creating multi-stage build for production
FROM node:18-alpine as build

# Install necessary packages
RUN apk update && apk add --no-cache build-base gcc autoconf automake zlib-dev libpng-dev vips-dev git > /dev/null 2>&1

# Set the environment variable
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Create required directories
RUN mkdir -p /home/node/.npm && chown -R node:node /home/node/.npm

# Set working directory
WORKDIR /opt/

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm install -g node-gyp
RUN npm config set fetch-retry-maxtimeout 600000 -g
RUN npm install --only=production

# Set the PATH
ENV PATH /opt/node_modules/.bin:$PATH

# Set working directory for the app
WORKDIR /opt/app

# Copy application files
COPY . .

# Build the application
RUN npm run build

# Creating final production image
FROM node:18-alpine

# Install necessary packages
RUN apk add --no-cache vips-dev

# Set the environment variable
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Set working directory
WORKDIR /opt/

# Copy node modules and built application from the build stage
COPY --from=build /opt/node_modules ./node_modules
WORKDIR /opt/app
COPY --from=build /opt/app ./

# Set the PATH
ENV PATH /opt/node_modules/.bin:$PATH

# Ensure the node user owns the application files
RUN chown -R node:node /opt/app

# Switch to node user
USER node

# Expose the application port
EXPOSE 1337

# Start the application
CMD ["npm", "run", "start"]
