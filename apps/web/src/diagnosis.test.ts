import { describe, expect, it } from 'vitest';
import { bugReportToMarkdown } from './diagnosis';

describe('bugReportToMarkdown', () => {
  it('genera un reporte con severidad, causa, pasos y resultados', () => {
    const markdown = bugReportToMarkdown(
      {
        title: 'La ordenación no funciona',
        severity: 'medium',
        stepsToReproduce: ['Iniciar sesión', 'Ordenar por precio'],
        expected: 'Primero el más barato',
        actual: 'El orden no cambia',
      },
      { category: 'app_bug', summary: 'La aplicación ignora la ordenación.' },
    );

    expect(markdown).toBe(
      [
        '## La ordenación no funciona',
        '',
        '**Severidad:** Media  ',
        '**Causa:** Bug de la aplicación',
        '',
        'La aplicación ignora la ordenación.',
        '',
        '### Pasos para reproducir',
        '1. Iniciar sesión',
        '2. Ordenar por precio',
        '',
        '### Resultado esperado',
        'Primero el más barato',
        '',
        '### Resultado actual',
        'El orden no cambia',
        '',
        '_Reporte generado por TestPilot._',
      ].join('\n'),
    );
  });
});
