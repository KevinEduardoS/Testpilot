import {
  MAX_ERROR_LENGTH,
  MAX_INSTRUCTION_LENGTH,
  MAX_PAGE_SNAPSHOT_LENGTH,
  MAX_PREVIOUS_INSTRUCTIONS,
  MAX_SCRIPT_LENGTH,
  MAX_STEPS,
} from '@testpilot/shared';
import { ArrowDown, ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { CodeBlock } from '../CodeBlock';

const Section = ({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) => (
  <section
    id={id}
    className="scroll-mt-16 border-t border-neutral-800 py-8 first:border-t-0 first:pt-0"
  >
    <h2 className="text-sm font-semibold text-neutral-100">{title}</h2>
    <p className="mt-1 max-w-2xl text-sm text-neutral-500">{description}</p>
    <div className="mt-4">{children}</div>
  </section>
);

const Node = ({ name, stack, detail }: { name: string; stack: string; detail: string }) => (
  <div className="flex-1 rounded-md border border-neutral-800 bg-neutral-950 p-3">
    <p className="text-sm font-medium text-neutral-100">{name}</p>
    <p className="font-mono text-2xs text-neutral-500">{stack}</p>
    <p className="mt-2 text-xs leading-relaxed text-neutral-400">{detail}</p>
  </div>
);

const Link = ({ protocol }: { protocol: string }) => (
  <div className="flex shrink-0 flex-col items-center justify-center gap-1 py-1 lg:w-36 lg:py-0">
    <ArrowRight className="hidden h-4 w-4 text-neutral-600 lg:block" />
    <ArrowDown className="h-4 w-4 text-neutral-600 lg:hidden" />
    <span className="whitespace-pre-line text-center font-mono text-2xs leading-4 text-neutral-500">
      {protocol}
    </span>
  </div>
);

const Table = ({ head, rows }: { head: string[]; rows: ReactNode[][] }) => (
  <div className="overflow-x-auto rounded-md border border-neutral-800">
    <table className="w-full min-w-[560px] text-left text-sm">
      <thead className="border-b border-neutral-800 bg-neutral-900/50">
        <tr>
          {head.map((cell) => (
            <th
              key={cell}
              scope="col"
              className="px-3 py-2 font-mono text-2xs font-normal uppercase tracking-wider text-neutral-500"
            >
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-neutral-800/70">
        {rows.map((row, index) => (
          <tr key={index}>
            {row.map((cell, column) => (
              <td key={column} className="px-3 py-2 align-top text-neutral-300">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Mono = ({ children }: { children: ReactNode }) => (
  <code className="font-mono text-xs text-neutral-200">{children}</code>
);

const ENDPOINTS: [string, string, string][] = [
  [
    'POST',
    '/api/tests/generate',
    'Instrucción y contexto → prueba, pregunta de aclaración o rechazo',
  ],
  ['POST', '/api/tests/execute', 'Script → stream NDJSON: step-begin, step-end y result o error'],
  ['POST', '/api/tests/repair', 'Script y evidencia del fallo → prueba corregida o reporte de bug'],
  ['GET', '/api/info', 'Proveedor de IA activo y dominios permitidos'],
  ['GET', '/api/ping', 'Estado del runner visto desde la API'],
  ['GET', '/health', 'Estado de la API'],
];

const SECURITY: [string, string, string][] = [
  [
    'Análisis del AST',
    'API y runner',
    'Rechaza eval, require, process, reflexión, page.evaluate y acceso dinámico a propiedades.',
  ],
  [
    'Dominios permitidos',
    'Política + Chromium',
    'goto() solo acepta URLs literales permitidas; el resto del tráfico va a un proxy inexistente.',
  ],
  [
    'Aislamiento del proceso',
    'Runner',
    'Entorno mínimo sin secretos, timeout por prueba y cierre del árbol de procesos completo.',
  ],
  [
    'Runner privado',
    'Red interna',
    'Solo la API lo invoca, con clave interna y token de identidad en la nube.',
  ],
  [
    'Reparaciones honestas',
    'API',
    'Descarta correcciones con menos aserciones o que ocultan un bug real.',
  ],
  [
    'Datos delimitados',
    'API',
    'Instrucciones y contenido de páginas van etiquetados como datos; se eliminan etiquetas inyectadas.',
  ],
];

const LIMITS: [string, string, string][] = [
  ['Instrucción', `${MAX_INSTRUCTION_LENGTH.toLocaleString('es-CO')} car.`, 'Contrato compartido'],
  ['Script', `${MAX_SCRIPT_LENGTH.toLocaleString('es-CO')} car.`, 'Contrato compartido'],
  ['Historial de contexto', `${MAX_PREVIOUS_INSTRUCTIONS} instrucciones`, 'Contrato compartido'],
  [
    'Snapshot de la página',
    `${MAX_PAGE_SNAPSHOT_LENGTH.toLocaleString('es-CO')} car.`,
    'Contrato compartido',
  ],
  ['Pasos en un reporte de fallo', `${MAX_STEPS}`, 'Contrato compartido'],
  ['Mensaje de error', `${MAX_ERROR_LENGTH.toLocaleString('es-CO')} car.`, 'Contrato compartido'],
  ['Timeout por prueba', '60 s', 'RUN_TIMEOUT_MS (por defecto)'],
  ['Peticiones por visitante', '10 / hora / ruta', 'RATE_LIMIT_PER_HOUR (por defecto)'],
  ['Presupuesto de IA', '1.000.000 tokens / día', 'AI_DAILY_TOKEN_BUDGET (por defecto)'],
];

const STREAM_SAMPLE = `{"type":"step-begin","index":0,"title":"Iniciar sesión"}
{"type":"step-end","index":0,"step":{"title":"Iniciar sesión","status":"passed","durationMs":812,"error":null}}
{"type":"step-begin","index":1,"title":"Verificar el título"}
{"type":"step-end","index":1,"step":{"title":"Verificar el título","status":"failed","durationMs":5003,"error":"expect(locator).toBeVisible() failed"}}
{"type":"result","result":{"status":"failed","durationMs":6120,"steps":[…],"pageSnapshot":"- banner: …"}}`;

const TOC = [
  ['flujo', 'Flujo'],
  ['endpoints', 'Endpoints'],
  ['stream', 'Stream de ejecución'],
  ['seguridad', 'Seguridad'],
  ['limites', 'Límites'],
];

export const ArchitectureView = () => (
  <div className="mx-auto grid max-w-6xl gap-8 px-4 py-6 sm:px-6 xl:grid-cols-[minmax(0,1fr)_180px]">
    <div className="min-w-0">
      <div className="mb-8">
        <h1 className="text-base font-semibold text-neutral-100">Arquitectura</h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          Monorepo TypeScript con tres servicios y contratos compartidos validados con Zod.
        </p>
      </div>

      <Section
        id="flujo"
        title="Flujo"
        description="El navegador nunca habla con el runner: la API valida, orquesta y transmite."
      >
        <div className="flex flex-col lg:flex-row lg:items-stretch">
          <Node
            name="Web"
            stack="React 18 · Vite · Tailwind"
            detail="Conversación con versiones, ejecución en vivo e historial."
          />
          <Link protocol={'HTTPS\nJSON · NDJSON'} />
          <Node
            name="API"
            stack="Fastify 4 · Zod · Claude"
            detail="Genera y repara con salida estructurada, aplica la política y los límites."
          />
          <Link protocol={'HTTP interno\nx-internal-api-key'} />
          <Node
            name="Runner"
            stack="Fastify 4 · Playwright 1.49"
            detail="Ejecuta cada script en Chromium aislado y emite el progreso por un canal propio."
          />
        </div>
      </Section>

      <Section
        id="endpoints"
        title="Endpoints"
        description="API pública. Los POST tienen límite por visitante."
      >
        <Table
          head={['Método', 'Ruta', 'Descripción']}
          rows={ENDPOINTS.map(([method, path, description]) => [
            <span className="tag">{method}</span>,
            <Mono>{path}</Mono>,
            <span className="text-neutral-400">{description}</span>,
          ])}
        />
      </Section>

      <Section
        id="stream"
        title="Stream de ejecución"
        description="La ejecución se transmite como NDJSON mientras Playwright corre. El último evento es siempre result o error."
      >
        <div className="overflow-hidden rounded-md border border-neutral-800 bg-neutral-950">
          <div className="border-b border-neutral-800 px-4 py-1.5 font-mono text-2xs text-neutral-500">
            POST /api/tests/execute · application/x-ndjson
          </div>
          <CodeBlock code={STREAM_SAMPLE} />
        </div>
      </Section>

      <Section
        id="seguridad"
        title="Seguridad"
        description="El script lo escribe un modelo: se trata como código no confiable, con barreras independientes."
      >
        <Table
          head={['Capa', 'Dónde', 'Qué hace']}
          rows={SECURITY.map(([layer, where, what]) => [
            <span className="text-neutral-100">{layer}</span>,
            <span className="font-mono text-2xs text-neutral-500">{where}</span>,
            <span className="text-neutral-400">{what}</span>,
          ])}
        />
      </Section>

      <Section
        id="limites"
        title="Límites"
        description="Valores del contrato compartido y valores por defecto de la configuración del servidor."
      >
        <Table
          head={['Límite', 'Valor', 'Origen']}
          rows={LIMITS.map(([name, value, origin]) => [
            name,
            <Mono>{value}</Mono>,
            <span className="font-mono text-2xs text-neutral-500">{origin}</span>,
          ])}
        />
      </Section>
    </div>

    <nav aria-label="En esta página" className="hidden xl:block">
      <div className="sticky top-20">
        <p className="eyebrow mb-2">En esta página</p>
        <ul className="space-y-1.5 border-l border-neutral-800">
          {TOC.map(([id, label]) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })}
                className="-ml-px border-l border-transparent pl-3 text-left text-xs text-neutral-500 transition-colors hover:border-neutral-400 hover:text-neutral-200"
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  </div>
);
