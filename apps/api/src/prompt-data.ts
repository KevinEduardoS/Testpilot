import type { AllowedDomains } from '@testpilot/shared';

// Etiquetas que delimitan los datos en los mensajes al modelo.
export const DATA_TAGS = [
  'instruccion_usuario',
  'instrucciones_anteriores',
  'script_actual',
  'base_url',
  'instrucciones_usuario',
  'script_fallido',
  'resultado_ejecucion',
  'snapshot_pagina',
] as const;

export type DataTag = (typeof DATA_TAGS)[number];

const TAG_PATTERN = new RegExp(`<\\s*/?\\s*(?:${DATA_TAGS.join('|')})\\s*>`, 'gi');

// Los datos llegan del cliente o de páginas web: si contienen una etiqueta delimitadora, se
// elimina para que no puedan cerrar su bloque y presentarse como instrucciones. Se repite
// hasta que no quede ninguna, porque quitar una puede formar otra ("</scr</script_actual>ipt_actual>").
export const neutralizeTags = (text: string): string => {
  let current = text;
  let previous;
  do {
    previous = current;
    current = current.replace(TAG_PATTERN, '');
  } while (current !== previous);
  return current;
};

export const dataBlock = (tag: DataTag, content: string): string[] => [
  `<${tag}>`,
  neutralizeTags(content),
  `</${tag}>`,
];

// Viene de la configuración del servidor, no del cliente: va fuera de los bloques de datos.
export const allowedDomainsLine = (domains: AllowedDomains): string =>
  domains === null
    ? 'Dominios permitidos: cualquiera.'
    : `Dominios permitidos: ${domains.join(', ')} y sus subdominios. Cualquier otro está bloqueado.`;
