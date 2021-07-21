# syntax=docker/dockerfile:1

FROM node:lts-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY ["package.json", "package-lock.json*", "./"]
RUN npm install --production
COPY loader.js ./
CMD [ "node", "loader.js" ]