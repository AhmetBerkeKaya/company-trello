# api/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Paketleri yükle
COPY package*.json ./
RUN npm install

# Kodları kopyala
COPY . .

# Portu aç
EXPOSE 5000

# Başlat
CMD ["node", "index.js"]