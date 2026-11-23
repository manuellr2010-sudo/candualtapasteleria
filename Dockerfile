# Imagen de producción de la web de Candú (Next.js en modo "standalone").
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 DATA_DIR=/app/data
RUN useradd --system --uid 1001 candu && mkdir -p /app/data && chown candu /app/data
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/node_modules/@libsql ./node_modules/@libsql
USER candu
EXPOSE 3000
# La base de datos y los archivos subidos viven en /app/data (volumen persistente).
VOLUME ["/app/data"]
CMD ["node", "server.js"]
