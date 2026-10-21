FROM mcr.microsoft.com/playwright:v1.49.1-jammy AS base
WORKDIR /workspace
COPY package*.json ./
COPY apps ./apps
COPY packages ./packages
COPY .npmrc* ./
RUN npm install --include=dev

FROM base AS runner
WORKDIR /workspace/apps/runner
EXPOSE 3002
USER pwuser
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3002"]
