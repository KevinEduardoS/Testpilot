# La versión de la imagen debe coincidir con la de playwright en apps/runner/package.json.
FROM mcr.microsoft.com/playwright:v1.49.1-jammy
WORKDIR /workspace
RUN chown pwuser:pwuser /workspace
USER pwuser

COPY --chown=pwuser:pwuser package.json package-lock.json tsconfig.base.json ./
COPY --chown=pwuser:pwuser apps ./apps
COPY --chown=pwuser:pwuser packages ./packages
RUN npm ci

WORKDIR /workspace/apps/runner
EXPOSE 3002
CMD ["npm", "run", "dev"]
