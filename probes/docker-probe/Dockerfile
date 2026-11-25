FROM node:20-alpine

WORKDIR /app

# Zero external npm dependencies required (uses native fetch and performance APIs)
COPY probe.mjs ./

# Run unprivileged for security
USER node

CMD ["node", "probe.mjs"]
