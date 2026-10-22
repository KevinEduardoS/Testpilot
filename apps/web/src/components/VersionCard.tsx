import { FileCode } from 'lucide-react';

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
    className={`group flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
      selected
        ? 'border-indigo-400/40 bg-indigo-500/10'
        : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.04]'
    }`}
  >
    <FileCode className={`h-4 w-4 shrink-0 ${selected ? 'text-indigo-300' : 'text-zinc-500'}`} />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm text-zinc-200">{title}</span>
      <span className="text-xs text-zinc-500">
        {stepCount} pasos · {selected ? 'en el panel' : 'ver en el panel'}
      </span>
    </span>
    <span
      className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] ${
        selected ? 'bg-indigo-400/20 text-indigo-200' : 'bg-white/5 text-zinc-400'
      }`}
    >
      v{version}
    </span>
  </button>
);
