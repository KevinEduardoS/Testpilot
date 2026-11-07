/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Inyectada por Vite desde package.json (vite.config.ts).
declare const __APP_VERSION__: string;
