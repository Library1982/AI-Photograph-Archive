FROM node:24-alpine
WORKDIR /app
COPY --chown=node:node . .
RUN mkdir -p /app/data && chown node:node /app/data
USER node
ENV PORT=3000 DATA_DIR=/app/data COOKIE_SECURE=true
EXPOSE 3000
CMD ["node", "server.mjs"]
