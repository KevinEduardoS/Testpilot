import type { BugReport, Diagnosis } from '@testpilot/shared';
import { Bug, Stethoscope } from 'lucide-react';
import type { ReactNode } from 'react';
import { CATEGORY_LABELS, SEVERITY_LABELS, bugReportToMarkdown } from '../diagnosis';
import { CopyButton } from './CodeBlock';

// Fallos de la prueba en un tono neutro; fallos del sitio o del entorno, en rojo.
const isTestProblem = (diagnosis: Diagnosis) =>
  diagnosis.category !== 'app_bug' && diagnosis.category !== 'environment';

export const DiagnosisNotice = ({ diagnosis }: { diagnosis: Diagnosis }) => {
  const testProblem = isTestProblem(diagnosis);
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm">
      <div className="mb-1.5 flex items-center gap-2">
        <Stethoscope className="h-4 w-4 shrink-0 text-indigo-400" />
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Diagnóstico
        </span>
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
            testProblem
              ? 'border-sky-400/20 bg-sky-400/10 text-sky-300'
              : 'border-rose-400/20 bg-rose-400/10 text-rose-300'
          }`}
        >
          {CATEGORY_LABELS[diagnosis.category]}
        </span>
      </div>
      <p className="leading-relaxed text-zinc-300">{diagnosis.summary}</p>
    </div>
  );
};

const SEVERITY_STYLES: Record<BugReport['severity'], string> = {
  low: 'border-zinc-400/20 bg-zinc-400/10 text-zinc-300',
  medium: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  high: 'border-orange-400/25 bg-orange-400/10 text-orange-300',
  critical: 'border-rose-400/30 bg-rose-400/15 text-rose-300',
};

const ReportSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <div>
    <h4 className="mb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">{title}</h4>
    {children}
  </div>
);

export const BugReportCard = ({
  report,
  diagnosis,
}: {
  report: BugReport;
  diagnosis: Diagnosis;
}) => (
  <div className="overflow-hidden rounded-lg border border-rose-400/20 bg-rose-950/10">
    <div className="flex items-start justify-between gap-3 border-b border-rose-400/10 px-3.5 py-3">
      <div className="flex min-w-0 gap-2.5">
        <Bug className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-rose-300/70">
            Reporte de bug
          </p>
          <h3 className="mt-0.5 text-sm font-medium leading-snug text-zinc-100">{report.title}</h3>
        </div>
      </div>
      <span
        className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${SEVERITY_STYLES[report.severity]}`}
      >
        {SEVERITY_LABELS[report.severity]}
      </span>
    </div>

    <div className="space-y-3 px-3.5 py-3 text-sm leading-relaxed text-zinc-300">
      <ReportSection title="Pasos para reproducir">
        <ol className="list-decimal space-y-0.5 pl-5 marker:text-zinc-600">
          {report.stepsToReproduce.map((step, index) => (
            <li key={`${index}-${step}`}>{step}</li>
          ))}
        </ol>
      </ReportSection>
      <ReportSection title="Esperado">
        <p>{report.expected}</p>
      </ReportSection>
      <ReportSection title="Actual">
        <p>{report.actual}</p>
      </ReportSection>
    </div>

    <div className="flex items-center justify-between gap-3 border-t border-rose-400/10 px-3.5 py-2.5">
      <p className="text-xs text-zinc-500">La prueba no se modificó para ocultar el fallo.</p>
      <CopyButton text={bugReportToMarkdown(report, diagnosis)} label="Copiar Markdown" />
    </div>
  </div>
);
