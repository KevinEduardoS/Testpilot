# Despliegue público

```
Visitante ──► Vercel: web estática
                 │ HTTPS
                 ▼
             Cloud Run: API (pública) ──token de identidad──► Cloud Run: runner (privado)
```

- **Web:** Vercel, plan gratuito.
- **API y runner:** Google Cloud Run, que no cobra mientras el uso quede dentro de su cuota gratuita mensual. Los servicios se apagan sin tráfico, así que la primera visita tras un rato tarda unos segundos más.
- **Runner:** sin acceso público. Solo lo puede invocar la cuenta de servicio de la API, que se autentica con un token de identidad de Google además de la clave interna.

Las cuotas gratuitas cambian: revísalas en [cloud.google.com/run/pricing](https://cloud.google.com/run/pricing) y [vercel.com/pricing](https://vercel.com/pricing) antes de empezar.

## 0. Requisitos

- El repositorio en GitHub. Si aún no está, crea un repositorio vacío (público si quieres que los reclutadores vean el código) en GitHub y súbelo:
  ```bash
  git remote add origin https://github.com/<usuario>/testpilot.git
  git push -u origin main
  ```
- Una cuenta de Google Cloud con facturación activada. Google pide una tarjeta aunque el uso sea gratuito.
- Una cuenta de Vercel enlazada a GitHub.

Todos los comandos de Google Cloud se ejecutan en [Cloud Shell](https://shell.cloud.google.com): ya trae `gcloud` y no hace falta instalar nada.

## 1. Alerta de presupuesto (primero)

En la consola de Google Cloud: **Facturación → Presupuestos y alertas → Crear presupuesto**, por ejemplo de 1 USD con avisos al 50 %, 90 % y 100 %. Así te enteras si algo empieza a generar costo.

Las imágenes ocupan unos 2 GB en Artifact Registry, más que su cuota gratuita de almacenamiento. Eso supone unos céntimos al mes; el paso 2 configura una limpieza automática para conservar solo las últimas versiones.

## 2. Preparación única del proyecto

En Cloud Shell, con tu ID de proyecto:

```bash
PROJECT_ID=<tu-proyecto>
REGION=us-east1
gcloud config set project "$PROJECT_ID"

gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com

# Repositorio de imágenes, conservando solo las 3 versiones más recientes.
gcloud artifacts repositories create testpilot --repository-format=docker --location="$REGION"
cat > /tmp/cleanup.json <<'EOF'
[
  { "name": "conservar-recientes", "action": { "type": "Keep" }, "mostRecentVersions": { "keepCount": 3 } },
  { "name": "borrar-resto", "action": { "type": "Delete" }, "condition": { "tagState": "any" } }
]
EOF
gcloud artifacts repositories set-cleanup-policies testpilot --location="$REGION" \
  --policy=/tmp/cleanup.json --no-dry-run

# Una cuenta de servicio por servicio, sin permisos de más.
gcloud iam service-accounts create testpilot-api --display-name="TestPilot API"
gcloud iam service-accounts create testpilot-runner --display-name="TestPilot runner"
API_SA="testpilot-api@$PROJECT_ID.iam.gserviceaccount.com"
RUNNER_SA="testpilot-runner@$PROJECT_ID.iam.gserviceaccount.com"

# Clave interna compartida por la API y el runner.
openssl rand -hex 32 | tr -d '\n' | \
  gcloud secrets create testpilot-internal-api-key --data-file=-
for SA in "$API_SA" "$RUNNER_SA"; do
  gcloud secrets add-iam-policy-binding testpilot-internal-api-key \
    --member="serviceAccount:$SA" --role=roles/secretmanager.secretAccessor
done

# Permisos de la cuenta que ejecuta Cloud Build para publicar imágenes y desplegar.
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
BUILD_SA="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
for ROLE in roles/run.admin roles/artifactregistry.writer roles/logging.logWriter; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$BUILD_SA" --role="$ROLE"
done
for SA in "$API_SA" "$RUNNER_SA"; do
  gcloud iam service-accounts add-iam-policy-binding "$SA" \
    --member="serviceAccount:$BUILD_SA" --role=roles/iam.serviceAccountUser
done
```

Si Cloud Build usa otra cuenta en tu proyecto (por ejemplo `<número>@cloudbuild.gserviceaccount.com` en proyectos antiguos), dale esos mismos permisos a esa.

## 3. Desplegar la API y el runner

Elige ya el nombre del proyecto de Vercel, porque su URL será el único origen al que la API permitirá llamar (por ejemplo, `testpilot-kevin` → `https://testpilot-kevin.vercel.app`).

```bash
git clone https://github.com/<usuario>/testpilot.git && cd testpilot
gcloud builds submit --config=cloudbuild.yaml --region="$REGION" \
  --substitutions=_WEB_ORIGIN=https://testpilot-kevin.vercel.app
```

La primera vez tarda unos minutos, sobre todo la imagen del runner. Al final se imprime la URL de la API (`https://testpilot-api-….run.app`). Compruébala:

```bash
curl https://testpilot-api-….run.app/health
curl https://testpilot-api-….run.app/api/ping   # {"ok":true,...}: la API llega al runner
```

Por defecto se despliega en **modo demo**: no usa la IA, así que no hay gasto en Anthropic.

## 4. Publicar la web en Vercel

1. **Add New → Project** e importa el repositorio.
2. **Root Directory:** `apps/web`. Vercel lee `apps/web/vercel.json`, que instala desde la raíz del monorepo y añade las cabeceras de seguridad.
3. **Environment Variables:** `VITE_API_URL` = la URL de la API del paso 3, sin barra final.
4. **Deploy.**

El build falla a propósito si `VITE_API_URL` falta o no usa https.

Si la URL final de Vercel no coincide con `_WEB_ORIGIN`, actualiza solo esa variable, sin reconstruir nada:

```bash
gcloud run services update testpilot-api --region="$REGION" \
  --update-env-vars=WEB_ORIGIN=https://<url-real>.vercel.app
```

## 5. Activar Claude (cuando tengas la clave)

1. En la consola de Anthropic, fija un **límite de gasto mensual**. Es el tope estricto: el presupuesto diario de la API (`AI_DAILY_TOKEN_BUDGET`) vive en memoria y se reinicia cuando Cloud Run apaga el servicio.
2. Guarda la clave como secreto y dale acceso solo a la API:
   ```bash
   printf '%s' '<tu-clave>' | gcloud secrets create testpilot-anthropic-api-key --data-file=-
   gcloud secrets add-iam-policy-binding testpilot-anthropic-api-key \
     --member="serviceAccount:testpilot-api@$PROJECT_ID.iam.gserviceaccount.com" \
     --role=roles/secretmanager.secretAccessor
   ```
   Para no dejar la clave en el historial de la terminal, puedes crearla desde la consola: **Security → Secret Manager**.
3. Vuelve a desplegar con la IA activada:
   ```bash
   gcloud builds submit --config=cloudbuild.yaml --region="$REGION" \
     --substitutions=_WEB_ORIGIN=https://testpilot-kevin.vercel.app,_AI_PROVIDER=anthropic
   ```

## Configuración del despliegue

`cloudbuild.yaml` fija estos valores; se cambian con `--substitutions`:

| Sustitución              | Por defecto                    | Uso                                               |
| ------------------------ | ------------------------------ | ------------------------------------------------- |
| `_REGION`                | `us-east1`                     | Región de Cloud Run y del repositorio de imágenes |
| `_WEB_ORIGIN`            | `https://testpilot.vercel.app` | Origen permitido por CORS                         |
| `_AI_PROVIDER`           | `demo`                         | `anthropic` para usar Claude                      |
| `_ALLOWED_DOMAINS`       | `saucedemo.com`                | Dominios que pueden visitar las pruebas           |
| `_AI_DAILY_TOKEN_BUDGET` | `1000000`                      | Tope diario aproximado de tokens de IA            |
| `_RATE_LIMIT_PER_HOUR`   | `10`                           | Peticiones por visitante, hora y ruta             |

Decisiones fijas:

- **API:** una sola instancia (los límites por visitante y el presupuesto viven en memoria), 512 MiB y `TRUST_PROXY=1` para que el límite cuente la IP del visitante y no la del balanceador de Google.
- **Runner:** una sola instancia de 2 GiB con el entorno de segunda generación de Cloud Run, que Chromium necesita. Ejecuta una prueba a la vez; si llega otra mientras tanto, la web avisa de que el runner está ocupado.
- Los secretos llegan desde Secret Manager; ninguno se guarda en la imagen ni en el repositorio.
