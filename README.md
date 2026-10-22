# TestPilot

TestPilot genera, ejecuta y diagnostica pruebas Playwright a partir de instrucciones en lenguaje natural. La solución está separada en tres servicios: web, API y runner.

## Qué hace hoy
- **Genera** un script Playwright + TypeScript a partir de una instrucción, usando Claude con salida estructurada.
- **Valida** cada script con una política de seguridad que analiza su AST (sin `eval`, `require`, `process`, `page.evaluate`, reflexión, red fuera del navegador, etc.).
- **Ejecuta** el script en Chromium dentro del runner y devuelve el estado, la duración de cada paso, el error del paso fallido y una captura final.

```
Navegador ──► Web (React) ──► API (Fastify + Claude) ──► Runner (Playwright)
```

## Requisitos
- Node.js 20+
- npm 10+
- Docker + Docker Compose (opcional para levantar la pila completa)

## Configuración
```bash
cp .env.example .env
```

Definir en `.env`:
- `ANTHROPIC_API_KEY`: clave de la API de Anthropic.
- `INTERNAL_API_KEY`: mínimo 32 caracteres. La API y el runner no arrancan sin ella:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

## Levantar sin Docker
```bash
npm install
npx --workspace apps/runner playwright install chromium
npm run dev
```

## Levantar con Docker
```bash
docker compose up --build
```

La imagen del runner ya incluye los navegadores. Los contenedores solo montan las carpetas `src`; tras cambiar dependencias o archivos de configuración, reconstruir con `docker compose up --build`.

## Servicios
- Web: http://localhost:5173
- API: http://localhost:3001
- Runner: http://localhost:3002 sin Docker; con Docker solo es accesible desde la API

## API
| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/tests/generate` | `{ instruction, baseUrl? }` → prueba generada, pregunta de aclaración o rechazo |
| `POST` | `/api/tests/execute` | `{ script }` → resultado de la ejecución |
| `GET` | `/api/ping` | Estado del runner visto desde la API |
| `GET` | `/health` | Estado de la API |

Ambos `POST` tienen un límite por IP configurable con `RATE_LIMIT_PER_HOUR`.

## Variables de entorno
Todos los servicios leen el `.env` de la raíz, pero cada uno toma solo las variables que necesita. La web solo recibe las que empiezan por `VITE_`.

## Seguridad
- Nunca versionar archivos `.env` ni secretos reales.
- `ANTHROPIC_API_KEY` solo la recibe la API; `INTERNAL_API_KEY`, la API y el runner. Ninguna llega al navegador.
- La política de seguridad se aplica dos veces: en la API y de nuevo en el runner antes de ejecutar.
- El proceso que ejecuta cada prueba solo hereda las variables imprescindibles (`PATH`, directorios temporales y de navegadores), nunca los secretos del runner.
- Una sola ejecución a la vez y timeout por prueba (`RUN_TIMEOUT_MS`).
- Las instrucciones del usuario y el contenido de las páginas se tratan como datos, nunca como instrucciones para el modelo.

### Límites conocidos
- El navegador del runner puede visitar cualquier URL. Restringir los dominios permitidos es necesario antes de exponer el servicio públicamente.
- Sin Docker, el runner ejecuta las pruebas con los permisos del usuario local; el aislamiento de procesos depende del contenedor.
