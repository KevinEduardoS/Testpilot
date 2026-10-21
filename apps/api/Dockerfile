FROM node:20-alpine
WORKDIR /workspace
RUN chown node:node /workspace
USER node

COPY --chown=node:node package.json package-lock.json tsconfig.base.json ./
COPY --chown=node:node apps ./apps
COPY --chown=node:node packages ./packages
RUN npm ci

WORKDIR /workspace/apps/api
EXPOSE 3001
CMD ["npm", "run", "dev"]
