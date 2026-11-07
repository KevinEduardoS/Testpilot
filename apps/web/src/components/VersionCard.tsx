import { ChevronRight } from 'lucide-react';

type VersionCardProps = {
  title: string;
  stepCount: number;
  version: number;
  selected: boolean;
  onSelect: (version: number) => void;
};

export const VersionCard = ({
  title,
  stepCount,
  version,
  selected,
  onSelect,
}: VersionCardProps) => (
  <button
    type="button"
    onClick={() => onSelect(version)}
    aria-pressed={selected}
    className={`group flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
      selected
        ? 'border-neutral-600 bg-neutral-800/60'
        : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700 hover:bg-neutral-900'
    }`}
  >
    <span className="tag shrink-0">v{version}</span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm text-neutral-100">{title}</span>
      <span className="font-mono text-2xs text-neutral-500">
        {stepCount} {stepCount === 1 ? 'paso' : 'pasos'} · script generado
      </span>
    </span>
    <ChevronRight
      className={`h-4 w-4 shrink-0 transition-colors ${
        selected ? 'text-neutral-300' : 'text-neutral-600 group-hover:text-neutral-400'
      }`}
    />
  </button>
);
