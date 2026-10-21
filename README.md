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

## Levantar sin Docker
```bash
npm install
npm run dev
```

## Levantar con Docker
```bash
cp .env.example .env
docker compose up --build
```

## Servicios
- Web: http://localhost:5173
- API: http://localhost:3001
- Runner: http://localhost:3002

## Variables de entorno
Copiar `.env.example` a `.env` y ajustar los valores reales del entorno local.

## Seguridad no negociable
- Nunca versionar archivos `.env` ni secretos reales.
- `ANTHROPIC_API_KEY` y `INTERNAL_API_KEY` solo deben estar en entorno y no en front-end.
- Cualquier prompt o snapshot de páginas se trata como dato, nunca como instrucción ejecutable.
