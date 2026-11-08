import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const ENV_DIR = '../..';
const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as {
  version: string;
};
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

// VITE_API_URL queda fijada en el bundle al compilar. Sin esta comprobación, un build de
// producción sin la variable apuntaría en silencio a la API local.
const assertApiUrl = (mode: string) => {
  const { VITE_API_URL: apiUrl } = loadEnv(mode, ENV_DIR, 'VITE_');
  if (apiUrl === undefined || apiUrl === '') {
    throw new Error('Define VITE_API_URL con la URL pública de la API antes de compilar la web.');
  }
  const url = new URL(apiUrl);
  if (url.protocol !== 'https:' && !LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(`VITE_API_URL debe usar https fuera de localhost: ${apiUrl}`);
  }
};

export default defineConfig(({ command, mode }) => {
  // Con VITE_BACKEND=recorded la web reproduce una grabación y no necesita API.
  if (command === 'build' && loadEnv(mode, ENV_DIR, 'VITE_').VITE_BACKEND !== 'recorded') {
    assertApiUrl(mode);
  }
  return {
    plugins: [react()],
    // La versión que muestra la interfaz sale del package.json de la web.
    define: { __APP_VERSION__: JSON.stringify(version) },
    // Comparte el .env de la raíz; Vite solo expone al cliente las variables VITE_*.
    envDir: ENV_DIR,
    server: {
      host: '0.0.0.0',
      port: 5173,
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
    },
  };
});
