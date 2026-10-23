import {
  Bug,
  Code,
  Globe,
  Lock,
  MessageSquareText,
  MonitorPlay,
  Network,
  Scale,
  ScanSearch,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';
import { Reveal } from './Reveal';

const SectionHeading = ({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) => (
  <Reveal className="mx-auto max-w-2xl text-center">
    <p className="section-eyebrow">{eyebrow}</p>
    <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
      {title}
    </h2>
    <p className="mt-4 text-pretty leading-relaxed text-zinc-400">{description}</p>
  </Reveal>
);

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: MessageSquareText,
    title: 'Describe',
    text: 'Escribe el caso en lenguaje natural y pide cambios en la conversación. Cada respuesta es una versión nueva del script.',
  },
  {
    icon: Code,
    title: 'Genera',
    text: 'Claude escribe un script de Playwright con pasos legibles, selectores accesibles y aserciones web-first.',
  },
  {
    icon: MonitorPlay,
    title: 'Ejecuta',
    text: 'El runner lo ejecuta en Chromium y transmite cada paso en vivo, con su duración y una captura final.',
  },
  {
    icon: Stethoscope,
    title: 'Diagnostica',
    text: 'Si falla, la IA analiza el error y el árbol de accesibilidad: corrige la prueba o redacta el reporte del bug.',
  },
];

export const HowItWorks = () => (
  <section id="como-funciona" className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
    <SectionHeading
      eyebrow="Cómo funciona"
      title="De una frase a un diagnóstico"
      description="Un flujo completo de QA en cuatro pasos, desde la instrucción hasta saber si el fallo es de la prueba o del sitio."
    />
    <ol className="relative mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {/* Línea que une los pasos en escritorio. */}
      <Reveal className="pointer-events-none absolute inset-x-0 top-[3.25rem] hidden lg:block">
        <div className="draw-line mx-[12.5%] h-px origin-left bg-gradient-to-r from-indigo-400/70 via-sky-400/70 to-emerald-400/70" />
      </Reveal>
      {STEPS.map(({ icon: Icon, title, text }, index) => (
        <li key={title}>
          <Reveal delay={index * 120} className="relative h-full">
            <div className="group h-full rounded-xl border border-white/[0.08] bg-zinc-900 p-6 transition duration-300 hover:-translate-y-1 hover:border-indigo-400/30 hover:shadow-xl hover:shadow-indigo-950/40">
              <div className="flex items-center gap-3">
                <span className="relative flex h-14 w-14 items-center justify-center rounded-xl border border-indigo-400/20 bg-zinc-950 text-indigo-300 transition group-hover:scale-105 group-hover:text-white">
                  <Icon className="h-6 w-6" />
                </span>
                <span className="font-mono text-xs text-zinc-600">0{index + 1}</span>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{text}</p>
            </div>
          </Reveal>
        </li>
      ))}
    </ol>
  </section>
);

const LAYERS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: ScanSearch,
    title: 'Análisis del código',
    text: 'Cada script se analiza como árbol de sintaxis antes de ejecutarse: sin eval, sin acceso a Node y sin JavaScript arbitrario en la página.',
  },
  {
    icon: Globe,
    title: 'Dominios permitidos',
    text: 'Las pruebas solo visitan los dominios autorizados. Se comprueba en el código y se bloquea en la red del navegador.',
  },
  {
    icon: Lock,
    title: 'Proceso aislado',
    text: 'El navegador corre en un proceso sin los secretos del servicio, con tiempo límite y cancelación si el visitante se va.',
  },
  {
    icon: Network,
    title: 'Runner privado',
    text: 'Solo la API puede invocar al runner, con una clave interna y un token de identidad de la nube.',
  },
  {
    icon: Scale,
    title: 'Reparaciones honestas',
    text: 'Una corrección nunca puede quitar aserciones ni ocultar un bug real: la API las descarta automáticamente.',
  },
  {
    icon: Bug,
    title: 'Datos, no órdenes',
    text: 'El contenido de las páginas y del usuario llega a la IA delimitado como datos, protegido contra prompt injection.',
  },
];

export const Security = () => (
  <section id="seguridad" className="relative overflow-hidden py-24">
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[30rem] w-[60rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/10 blur-3xl"
      aria-hidden="true"
    />
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <SectionHeading
        eyebrow="Seguridad por capas"
        title="Ejecutar código generado por IA, sin riesgos"
        description="Un script escrito por un modelo es código no confiable. TestPilot lo trata así, con varias barreras independientes."
      />
      <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LAYERS.map(({ icon: Icon, title, text }, index) => (
          <Reveal key={title} delay={(index % 3) * 100}>
            <div className="group h-full rounded-xl border border-white/[0.08] bg-zinc-900/50 p-6 transition duration-300 hover:border-emerald-400/25 hover:bg-zinc-900/80">
              <Icon className="h-5 w-5 text-emerald-300 transition group-hover:scale-110" />
              <h3 className="mt-4 font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

const STACK = [
  'TypeScript',
  'React',
  'Vite',
  'Tailwind CSS',
  'Fastify',
  'Playwright',
  'Claude',
  'Zod',
  'Vitest',
  'Docker',
  'Cloud Run',
  'Vercel',
];

export const TechStack = () => (
  <section className="border-y border-white/[0.06] bg-zinc-950/60 py-10" aria-label="Tecnologías">
    <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
      {/* La lista se duplica para que la cinta sea continua. */}
      <ul className="flex w-max animate-marquee gap-3 hover:[animation-play-state:paused]">
        {[...STACK, ...STACK].map((name, index) => (
          <li
            key={`${name}-${index}`}
            aria-hidden={index >= STACK.length}
            className="whitespace-nowrap rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 font-mono text-xs text-zinc-400"
          >
            {name}
          </li>
        ))}
      </ul>
    </div>
  </section>
);
