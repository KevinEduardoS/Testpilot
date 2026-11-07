// Vistas de la aplicación. Se reflejan en la URL (#/runs) para poder enlazarlas y recargar.
export const VIEWS = ['playground', 'runs', 'architecture'] as const;

export type View = (typeof VIEWS)[number];

export const VIEW_LABELS: Record<View, string> = {
  playground: 'Playground',
  runs: 'Ejecuciones',
  architecture: 'Arquitectura',
};

export const viewFromHash = (hash: string): View => {
  const candidate = hash.replace(/^#\/?/, '');
  return (VIEWS as readonly string[]).includes(candidate) ? (candidate as View) : 'playground';
};

export const hashForView = (view: View): string => `#/${view}`;
