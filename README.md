# TestPilot

TestPilot es un monorepo para generar, ejecutar y diagnosticar pruebas Playwright con IA generativa. La solución está separada en tres servicios: web, API y runner.

## Fase 0
La base actual incluye:
- monorepo con workspaces de npm,
- TypeScript y linting compartidos,
- Docker Compose para entorno local,
- skeleton funcional de `web`, `api` y `runner`.

## Requisitos
- Node.js 20+
- npm 10+
- Docker + Docker Compose (opcional para levantar la pila completa)

## Configuración
```bash
cp .env.example .env
```

Definir `INTERNAL_API_KEY` en `.env` (mínimo 32 caracteres). La API y el runner no arrancan sin ella:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Levantar sin Docker
```bash
npm install
npm run dev
```

## Levantar con Docker
```bash
docker compose up --build
```

Los contenedores solo montan las carpetas `src`. Tras cambiar dependencias o archivos de configuración, reconstruir con `docker compose up --build`.

## Servicios
- Web: http://localhost:5173
- API: http://localhost:3001
- Runner: http://localhost:3002 sin Docker; con Docker solo es accesible desde la API

## Variables de entorno
Todos los servicios leen el `.env` de la raíz, pero cada uno toma solo las variables que necesita. La web solo recibe las que empiezan por `VITE_`.

## Seguridad no negociable
- Nunca versionar archivos `.env` ni secretos reales.
- `ANTHROPIC_API_KEY` y `INTERNAL_API_KEY` solo deben estar en entorno y no en front-end.
- Cualquier prompt o snapshot de páginas se trata como dato, nunca como instrucción ejecutable.
