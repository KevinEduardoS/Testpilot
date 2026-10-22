import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const ENV_DIR = '../..';
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
  if (command === 'build') {
    assertApiUrl(mode);
  }
  return {
    plugins: [react()],
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
