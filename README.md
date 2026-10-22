# TestPilot

TestPilot genera, ejecuta y diagnostica pruebas Playwright a partir de instrucciones en lenguaje natural. La solución está separada en tres servicios: web, API y runner.

## Qué hace hoy
- **Genera** un script Playwright + TypeScript a partir de una instrucción, usando Claude con salida estructurada.
- **Valida** cada script con una política de seguridad que analiza su AST (sin `eval`, `require`, `process`, `page.evaluate`, reflexión, red fuera del navegador, etc.).
- **Refina** la prueba en una conversación: cada cambio pedido genera una versión nueva del script a partir de la versión seleccionada.
- **Ejecuta** el script en Chromium dentro del runner y muestra en vivo cada paso, su duración, el error del paso fallido y una captura final.
- **Diagnostica y repara** las pruebas que fallan. Con el error, los pasos y el árbol de accesibilidad de la página en el momento del fallo, la IA clasifica la causa (selector, sincronización, aserción, bug de la aplicación o entorno) y:
  - si el fallo es de la prueba, devuelve una versión corregida, que se puede volver a ejecutar;
  - si es del sitio, redacta un reporte de bug con severidad, pasos para reproducir, resultado esperado y actual, copiable en Markdown.

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

### Modo demo (sin clave de IA)
Con `AI_PROVIDER=demo` la API no necesita `ANTHROPIC_API_KEY`: los ejemplos de la web devuelven scripts predefinidos y la ejecución en el navegador sigue siendo real. La interfaz lo indica con la etiqueta "Modo demo". Para usar Claude, `AI_PROVIDER=anthropic` y definir `ANTHROPIC_API_KEY`.

Dos ejemplos fallan a propósito contra saucedemo.com para mostrar la reparación, con diagnósticos predefinidos:
- **Título del catálogo**: la prueba supone que «Products» es un encabezado, pero no lo es. La reparación corrige el selector y la versión nueva pasa.
- **Ordenar por precio (problem_user)**: el sitio ignora la ordenación con ese usuario. La reparación no toca la prueba y genera el reporte del bug.

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
| `POST` | `/api/tests/generate` | `{ instruction, baseUrl?, context? }` → prueba generada, pregunta de aclaración o rechazo. `context` lleva el script vigente y las instrucciones anteriores para refinar |
| `POST` | `/api/tests/repair` | `{ instructions, script, failure }` → diagnóstico con prueba corregida (`fixed`) o reporte de bug (`bug_report`). `failure` es la evidencia de la ejecución: estado, error, pasos y snapshot de la página |
| `POST` | `/api/tests/execute` | `{ script }` → stream NDJSON con eventos `step-begin`, `step-end` y un evento final `result` o `error` |
| `GET` | `/api/info` | Proveedor de IA activo (`anthropic` o `demo`) |
| `GET` | `/api/ping` | Estado del runner visto desde la API |
| `GET` | `/health` | Estado de la API |

Los `POST` tienen un límite por IP configurable con `RATE_LIMIT_PER_HOUR`.

## Variables de entorno
Todos los servicios leen el `.env` de la raíz, pero cada uno toma solo las variables que necesita. La web solo recibe las que empiezan por `VITE_`.

`SNAPSHOT_MAX_CHARS` limita el tamaño del árbol de accesibilidad que el runner captura al fallar una prueba (máximo y valor por defecto: 40 000 caracteres).

## Seguridad
- Nunca versionar archivos `.env` ni secretos reales.
- `ANTHROPIC_API_KEY` solo la recibe la API; `INTERNAL_API_KEY`, la API y el runner. Ninguna llega al navegador.
- La política de seguridad se aplica dos veces: en la API y de nuevo en el runner antes de ejecutar.
- El proceso que ejecuta cada prueba solo hereda las variables imprescindibles (`PATH`, directorios temporales y de navegadores), nunca los secretos del runner.
- Una sola ejecución a la vez y timeout por prueba (`RUN_TIMEOUT_MS`). Al agotarse el tiempo o desconectarse el cliente se mata el árbol de procesos completo, navegador incluido.
- El progreso llega al runner por un canal propio (descriptor 3) que el script no puede escribir, así que no puede falsear los pasos.
- Las instrucciones del usuario y el contenido de las páginas se tratan como datos, nunca como instrucciones para el modelo. Van delimitados por etiquetas y, si contienen una de esas etiquetas, se elimina para que no puedan cerrar su bloque.
- Una reparación nunca puede ocultar un fallo: la API descarta las que corrigen la prueba cuando la causa es un bug o el entorno, las que devuelven el mismo script y las que tienen menos aserciones `expect()` que el original.
- El snapshot de la página lo captura un hook que el runner añade al final del script ya validado. Si el script adjunta uno propio, se usa el del runner.

### Límites conocidos
- El navegador del runner puede visitar cualquier URL. Restringir los dominios permitidos es necesario antes de exponer el servicio públicamente.
- Sin Docker, el runner ejecuta las pruebas con los permisos del usuario local; el aislamiento de procesos depende del contenedor.
