# Modelo de seguridad

TestPilot ejecuta código escrito por un modelo de lenguaje en un navegador real. Ese código se trata como **no confiable**: ninguna barrera depende de que el modelo se comporte bien, y cada una funciona aunque las demás fallen.

## Amenazas que se consideran

| Amenaza                            | Ejemplo                                 | Mitigación                                            |
| ---------------------------------- | --------------------------------------- | ----------------------------------------------------- |
| Ejecución de código en el servidor | `require('fs')`, `process.env`, `eval`  | Política AST en la API y en el runner                 |
| Exfiltración de secretos           | Leer `INTERNAL_API_KEY` desde la prueba | El proceso de la prueba no hereda secretos            |
| SSRF y acceso a la red interna     | `page.goto('http://169.254.169.254')`   | Dominios permitidos en el AST y en la red de Chromium |
| Lectura de archivos locales        | `page.goto('file:///etc/passwd')`       | `goto()` solo acepta URLs literales http(s)           |
| Prompt injection                   | Una página con "ignora tus reglas"      | Datos delimitados y etiquetas neutralizadas           |
| Reparaciones que ocultan bugs      | Quitar el `expect()` que falla          | La API descarta reparaciones con menos aserciones     |
| Abuso del servicio público         | Agotar el presupuesto de IA             | Límite por visitante y tope diario de tokens          |

## 1. Política de scripts (análisis del AST)

`packages/shared/src/script-policy.ts` analiza el árbol de sintaxis con el compilador de TypeScript. Buscar texto se podría evadir con espacios, comentarios o concatenaciones; el AST no.

- La única importación permitida es `import { test, expect } from '@playwright/test'`.
- Identificadores prohibidos: `eval`, `Function`, `require`, `process`, `globalThis`, `Buffer`, `Reflect`, `Proxy`, `Object`, `fetch`, `setTimeout`, el fixture `request` y el fixture `browser`, entre otros.
- Propiedades prohibidas: `evaluate`, `addInitScript`, `exposeFunction`, `route`, `screenshot`, `setInputFiles`, `storageState`, `waitForTimeout`, `constructor`, `prototype`, `__proto__`. También `test.use`, `test.extend`, `newContext`, `setContent` y `addScriptTag`, que permitirían saltarse el proxy o cargar contenido arbitrario.
- El acceso con corchetes solo admite literales: `page['constr' + 'uctor']` se rechaza.
- Se exige un `test()`, al menos un `test.step()` y al menos un `expect()`.

La política se aplica **dos veces**: en la API, antes de responder o ejecutar, y de nuevo en el runner, que no confía en nadie.

## 2. Dominios permitidos

`ALLOWED_DOMAINS` (por defecto `saucedemo.com`) se aplica en dos capas independientes:

- **Estática.** `page.goto()` solo acepta una URL absoluta http(s), escrita como literal y de un dominio permitido. Así se descartan `file://` y las URLs construidas en tiempo de ejecución. Las URL base de otros dominios se rechazan antes de llamar a la IA.
- **De red.** El runner lanza Chromium con todo el tráfico dirigido a un proxy inexistente, salvo el de los dominios permitidos (`--proxy-bypass-list`, con `<-loopback>` para anular la excepción de localhost). Fallan otros sitios, IPs, `localhost` y la IP de metadatos de la nube, incluso tras una redirección o un clic en un enlace.

## 3. Aislamiento del proceso

- El proceso de la prueba solo hereda `PATH`, los directorios temporales y el de los navegadores. Nunca recibe los secretos del runner.
- Una ejecución a la vez y timeout por prueba (`RUN_TIMEOUT_MS`). Al agotarse el tiempo o desconectarse el cliente, se mata el árbol de procesos completo, navegador incluido.
- El progreso llega al runner por un descriptor de archivo propio (fd 3) que el script no puede escribir, así que no puede falsear los pasos.
- El snapshot de la página lo captura un hook que el runner añade al final del script ya validado. Si el script adjunta uno propio, se usa el del runner.
- Sin Docker, el runner ejecuta las pruebas con los permisos del usuario local; el aislamiento de procesos depende del contenedor.

## 4. Secretos y red interna

- `ANTHROPIC_API_KEY` solo la recibe la API; `INTERNAL_API_KEY`, la API y el runner. Ninguna llega al navegador.
- El runner exige `x-internal-api-key` (comparada en tiempo constante). En Cloud Run, además, es un servicio privado: solo la cuenta de servicio de la API puede invocarlo, con un token de identidad de Google.
- Nunca se versionan archivos `.env` ni secretos reales.

## 5. IA: datos frente a instrucciones

- Las instrucciones del usuario, los scripts y el contenido de las páginas llegan al modelo delimitados por etiquetas y se tratan como datos, nunca como instrucciones.
- Si los datos contienen una de esas etiquetas, se elimina, repitiendo hasta que no quede ninguna (`</scr</script_actual>ipt_actual>` no se rearma).
- Una reparación nunca puede ocultar un fallo. La API descarta las que corrigen la prueba cuando la causa es un bug o el entorno, las que devuelven el mismo script y las que tienen menos aserciones `expect()` que el original.

## 6. Instancia pública

- Límite de peticiones por visitante en cada `POST` (`RATE_LIMIT_PER_HOUR`). Detrás de un proxy, `TRUST_PROXY` debe indicar cuántos hay: con `0` se ignora `X-Forwarded-For`, que de otro modo cualquiera podría falsear.
- Tope diario de tokens de IA (`AI_DAILY_TOKEN_BUDGET`). Al agotarse, los ejemplos se responden con los scripts de demo. El contador vive en memoria y es aproximado: el tope estricto es el límite de gasto de la consola de Anthropic.
- La web se sirve con CSP estricta, `nosniff`, `Referrer-Policy` y `Permissions-Policy` (`apps/web/vercel.json`).
