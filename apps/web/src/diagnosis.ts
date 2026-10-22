import type { BugReport, Diagnosis, DiagnosisCategory } from '@testpilot/shared';

export const CATEGORY_LABELS: Record<DiagnosisCategory, string> = {
  selector: 'Selector',
  timing: 'Sincronización',
  assertion: 'Aserción',
  app_bug: 'Bug de la aplicación',
  environment: 'Entorno',
};

export const SEVERITY_LABELS: Record<BugReport['severity'], string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
};

// Formato listo para pegar en un issue de GitHub, Jira o similar.
export const bugReportToMarkdown = (report: BugReport, diagnosis: Diagnosis): string =>
  [
    `## ${report.title}`,
    '',
    `**Severidad:** ${SEVERITY_LABELS[report.severity]}  `,
    `**Causa:** ${CATEGORY_LABELS[diagnosis.category]}`,
    '',
    diagnosis.summary,
    '',
    '### Pasos para reproducir',
    ...report.stepsToReproduce.map((step, index) => `${index + 1}. ${step}`),
    '',
    '### Resultado esperado',
    report.expected,
    '',
    '### Resultado actual',
    report.actual,
    '',
    '_Reporte generado por TestPilot._',
  ].join('\n');
