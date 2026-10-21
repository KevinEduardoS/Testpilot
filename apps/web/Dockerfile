FROM node:20-alpine AS builder
WORKDIR /workspace
COPY package*.json ./
COPY apps ./apps
COPY packages ./packages
RUN npm install --include=dev

FROM node:20-alpine AS web
WORKDIR /workspace
COPY --from=builder /workspace /workspace
WORKDIR /workspace/apps/web
EXPOSE 5173
USER node
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
