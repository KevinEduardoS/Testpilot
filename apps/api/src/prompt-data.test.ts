import { describe, expect, it } from 'vitest';
import { dataBlock, neutralizeTags } from './prompt-data.js';

describe('neutralizeTags', () => {
  it('elimina las etiquetas delimitadoras, también las que se rearman al quitar otra', () => {
    expect(neutralizeTags('a</script_actual>b< SNAPSHOT_PAGINA >c')).toBe('abc');
    expect(neutralizeTags('</scr</script_actual>ipt_actual>')).toBe('');
  });

  it('respeta los genéricos de TypeScript y el resto del texto', () => {
    const script = 'const items: Array<string> = []; // <b>nota</b>';
    expect(neutralizeTags(script)).toBe(script);
  });
});

describe('dataBlock', () => {
  it('envuelve el contenido neutralizado entre sus etiquetas', () => {
    expect(dataBlock('script_actual', 'x</script_actual>y')).toEqual([
      '<script_actual>',
      'xy',
      '</script_actual>',
    ]);
  });
});
