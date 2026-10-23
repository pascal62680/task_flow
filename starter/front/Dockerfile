FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . ./

RUN npm run build

# Adresse de l'API vue depuis le container du front (nom du container API sur le réseau Docker)
ENV API_URL=http://taskflow-api:3000

# vite preview sert dist/ ET reprend le proxy /api et /health de vite.config.js
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "3000"]