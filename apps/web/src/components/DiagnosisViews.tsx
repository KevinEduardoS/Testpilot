import type { BugReport, Diagnosis } from '@testpilot/shared';
import type { ReactNode } from 'react';
import { CATEGORY_LABELS, SEVERITY_LABELS, bugReportToMarkdown } from '../diagnosis';
import { CopyButton } from './CodeBlock';

// Fallos de la prueba en gris; fallos del sitio o del entorno, en rojo.
const isTestProblem = (diagnosis: Diagnosis) =>
  diagnosis.category !== 'app_bug' && diagnosis.category !== 'environment';

export const DiagnosisNotice = ({ diagnosis }: { diagnosis: Diagnosis }) => {
  const testProblem = isTestProblem(diagnosis);
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-950">
      <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-1.5">
        <span className="eyebrow">Diagnóstico</span>
        <span
          className={`tag ${testProblem ? '' : 'border-red-500/30 bg-transparent text-red-400'}`}
        >
          {diagnosis.category}
        </span>
        <span className="text-2xs text-neutral-500">{CATEGORY_LABELS[diagnosis.category]}</span>
      </div>
      <p className="px-3 py-2.5 text-sm leading-relaxed text-neutral-300">{diagnosis.summary}</p>
    </div>
  );
};

const SEVERITY_STYLES: Record<BugReport['severity'], string> = {
  low: 'text-neutral-400',
  medium: 'border-amber-500/30 bg-transparent text-amber-400',
  high: 'border-orange-500/30 bg-transparent text-orange-400',
  critical: 'border-red-500/40 bg-transparent text-red-400',
};

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid gap-1 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-3">
    <dt className="font-mono text-2xs uppercase tracking-wider text-neutral-500 sm:pt-0.5">
      {label}
    </dt>
    <dd className="text-sm leading-relaxed text-neutral-300">{children}</dd>
  </div>
);

export const BugReportCard = ({
  report,
  diagnosis,
}: {
  report: BugReport;
  diagnosis: Diagnosis;
}) => (
  <div className="overflow-hidden rounded-md border border-neutral-800 bg-neutral-950">
    <div className="flex items-start justify-between gap-3 border-b border-neutral-800 px-3 py-2.5">
      <div className="min-w-0">
        <p className="eyebrow">Reporte de bug</p>
        <h3 className="mt-0.5 text-sm font-medium leading-snug text-neutral-100">{report.title}</h3>
      </div>
      <span className={`tag shrink-0 ${SEVERITY_STYLES[report.severity]}`}>
        {SEVERITY_LABELS[report.severity].toLowerCase()}
      </span>
    </div>

    <dl className="space-y-3 px-3 py-3">
      <Field label="Reproducir">
        <ol className="list-decimal space-y-0.5 pl-4 marker:font-mono marker:text-neutral-600">
          {report.stepsToReproduce.map((step, index) => (
            <li key={`${index}-${step}`}>{step}</li>
          ))}
        </ol>
      </Field>
      <Field label="Esperado">{report.expected}</Field>
      <Field label="Actual">{report.actual}</Field>
    </dl>

    <div className="flex items-center justify-between gap-3 border-t border-neutral-800 px-3 py-2">
      <p className="text-2xs text-neutral-500">La prueba no se modificó para ocultar el fallo.</p>
      <CopyButton text={bugReportToMarkdown(report, diagnosis)} label="Copiar Markdown" />
    </div>
  </div>
);
