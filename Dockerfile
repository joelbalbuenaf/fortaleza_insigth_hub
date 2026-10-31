# Imagen de producción: build con Node 22 y servidor nitro (preset node-server).
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/.output ./.output
EXPOSE 3000
# ANTHROPIC_API_KEY se pasa en tiempo de ejecución (docker run -e ...); sin ella, Fide usa el modo demo.
CMD ["node", ".output/server/index.mjs"]
