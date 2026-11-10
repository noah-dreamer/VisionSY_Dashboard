# Static assets only at runtime. No writable credential volume or management proxy.
FROM node:22-alpine AS assets
WORKDIR /build
COPY package*.json ./
RUN npm ci
COPY build.mjs ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node server.mjs ./
COPY --from=assets --chown=node:node /build/public ./public
USER node
ENV HOST=0.0.0.0 PORT=8090
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:8090/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
