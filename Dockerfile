FROM node:22-slim

WORKDIR /app
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm --prefix backend ci

COPY . .
RUN npm --prefix backend run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "--prefix", "backend", "start"]
