# Configuración

Todos los servicios leen el `.env` de la raíz, pero cada uno valida con Zod solo las variables que necesita y descarta el resto. La web solo recibe las que empiezan por `VITE_`.

```bash
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # INTERNAL_API_KEY
```

## Variables

| Variable                | Servicio    | Por defecto             | Descripción                                                                                                                                                           |
| ----------------------- | ----------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INTERNAL_API_KEY`      | API, runner | —                       | Obligatoria, mínimo 32 caracteres. La API y el runner no arrancan sin ella.                                                                                           |
| `AI_PROVIDER`           | API         | `anthropic`             | `anthropic` usa Claude; `demo` responde los ejemplos con scripts predefinidos.                                                                                        |
| `ANTHROPIC_API_KEY`     | API         | —                       | Obligatoria con `AI_PROVIDER=anthropic`.                                                                                                                              |
| `ANTHROPIC_MODEL`       | API         | `claude-opus-5-5`       | Modelo para generar y reparar.                                                                                                                                        |
| `AI_EFFORT`             | API         | `medium`                | `low`, `medium`, `high`, `xhigh` o `max`.                                                                                                                             |
| `AI_DAILY_TOKEN_BUDGET` | API         | `1000000`               | Tope diario aproximado de tokens (entrada, salida y caché).                                                                                                           |
| `ALLOWED_DOMAINS`       | API, runner | `saucedemo.com`         | Dominios que pueden visitar las pruebas, separados por comas, con sus subdominios. `*` permite cualquiera (solo desarrollo local). Debe coincidir en ambos servicios. |
| `RATE_LIMIT_PER_HOUR`   | API         | `10`                    | Peticiones por visitante, hora y ruta en los `POST`.                                                                                                                  |
| `TRUST_PROXY`           | API         | `0`                     | Proxies de confianza delante de la API: `1` detrás del balanceador de una plataforma.                                                                                 |
| `RUN_TIMEOUT_MS`        | API, runner | `60000`                 | Timeout de cada prueba (máximo 300 000).                                                                                                                              |
| `SNAPSHOT_MAX_CHARS`    | Runner      | `40000`                 | Tamaño máximo del árbol de accesibilidad capturado al fallar.                                                                                                         |
| `RUNNER_URL`            | API         | `http://localhost:3002` | Dirección del runner.                                                                                                                                                 |
| `RUNNER_AUTH`           | API         | `internal-key`          | `google-id-token` cuando el runner es un servicio privado de Cloud Run.                                                                                               |
| `WEB_ORIGIN`            | API         | `http://localhost:5173` | Único origen permitido por CORS.                                                                                                                                      |
| `VITE_API_URL`          | Web         | `http://localhost:3001` | URL de la API. El build de producción falla si falta o no usa https.                                                                                                  |

## Modo demo

Con `AI_PROVIDER=demo` la API no necesita `ANTHROPIC_API_KEY`: los ejemplos devuelven scripts predefinidos y la ejecución en Chromium sigue siendo real. La interfaz lo indica en el entorno activo.

Dos ejemplos fallan a propósito contra saucedemo.com para mostrar la reparación:

- **Título del catálogo.** La prueba supone que «Products» es un encabezado y no lo es. La reparación corrige el selector y la versión nueva pasa.
- **Ordenar por precio (problem_user).** El sitio ignora la ordenación con ese usuario. La reparación no toca la prueba y genera el reporte del bug.

## Docker

```bash
docker compose up --build
```

La imagen del runner incluye los navegadores. Los contenedores solo montan las carpetas `src`; tras cambiar dependencias o archivos de configuración hay que reconstruir. Con Docker, el runner solo es accesible desde la API.
