# FreeAPI Hub — imagen de producción
# Construir:  docker build -t freeapi-hub .
# Ejecutar:   docker run --rm -p 3000:3000 -e NODE_ENV=production freeapi-hub
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

WORKDIR /app

# Se copian primero los manifiestos para aprovechar la caché de capas.
COPY package.json package-lock.json* ./
# --omit=dev: en producción no se instalan dependencias de desarrollo.
RUN npm ci --omit=dev || npm install --omit=dev

COPY server.js ./
COPY src ./src
COPY public ./public
COPY shared ./shared

# El proceso no necesita privilegios de root.
USER node

EXPOSE 3000

# Comprobación de salud real contra el endpoint /api/health.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
