FROM node:20-alpine

WORKDIR /app

# Optional proxy for `docker build` on UAT (pass --build-arg HTTP_PROXY=...)
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY
ENV HTTP_PROXY=${HTTP_PROXY} \
    HTTPS_PROXY=${HTTPS_PROXY} \
    NO_PROXY=${NO_PROXY}

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
  && test -f node_modules/dotenv/package.json \
  && test -f node_modules/express/package.json \
  && test -f node_modules/undici/package.json \
  && test -f node_modules/global-agent/package.json \
  && npm cache clean --force

COPY . .

RUN test -f src/cache/addressCache.js \
  && test -f src/db/geocodeCacheRepository.js \
  && mkdir -p /app/logs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health',(r)=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

CMD ["node", "src/server.js"]
