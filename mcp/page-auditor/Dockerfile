FROM node:18-alpine
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3001
ENV PORT=3001
CMD ["npx", "tsx", "src/index.ts"]
