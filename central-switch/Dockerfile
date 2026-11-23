FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY central-switch/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund
COPY central-switch/src ./src
USER node
EXPOSE 4000
CMD ["npm","run","start"]
