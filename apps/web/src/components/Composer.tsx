import { EXAMPLES } from '@testpilot/shared';
import { FlaskConical, Globe, LoaderCircle, Sparkles } from 'lucide-react';
import type { FormEvent, KeyboardEvent } from 'react';

export const MAX_INSTRUCTION_LENGTH = 1000;

type ComposerProps = {
  instruction: string;
  baseUrl: string;
  loading: boolean;
  demoMode: boolean;
  onInstructionChange: (value: string) => void;
  onBaseUrlChange: (value: string) => void;
  onSubmit: () => void;
};

export const Composer = ({
  instruction,
  baseUrl,
  loading,
  demoMode,
  onInstructionChange,
  onBaseUrlChange,
  onSubmit,
}: ComposerProps) => {
  const canSubmit = instruction.trim().length > 0 && !loading;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (canSubmit) {
      onSubmit();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && canSubmit) {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="space-y-4">
      {demoMode && (
        <div className="flex gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.07] p-4 text-sm">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <p className="leading-relaxed text-amber-100/80">
            <span className="font-medium text-amber-200">Modo demo.</span> La IA no está
            configurada: elige uno de los ejemplos. Sus scripts son predefinidos, pero la ejecución
            en el navegador es real.
          </p>
        </div>
      )}
      <form onSubmit={handleSubmit} className="card p-5">
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="instruction" className="text-sm font-medium text-zinc-200">
            Instrucción
          </label>
          <span className="font-mono text-[11px] tabular-nums text-zinc-500">
            {instruction.length}/{MAX_INSTRUCTION_LENGTH}
          </span>
        </div>
        <textarea
          id="instruction"
          value={instruction}
          maxLength={MAX_INSTRUCTION_LENGTH}
          onChange={(event) => onInstructionChange(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={6}
          placeholder="Describe el caso de prueba en lenguaje natural…"
          className="field resize-none leading-relaxed"
        />

        <label htmlFor="baseUrl" className="mb-2 mt-4 block text-sm font-medium text-zinc-200">
          URL base <span className="font-normal text-zinc-500">(opcional)</span>
        </label>
        <div className="relative">
          <Globe className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            id="baseUrl"
            type="url"
            value={baseUrl}
            onChange={(event) => onBaseUrlChange(event.target.value)}
            placeholder="https://ejemplo.com"
            className="field pl-10 font-mono text-[13px]"
          />
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="hidden text-xs text-zinc-500 sm:inline">
            <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px]">
              Ctrl
            </kbd>{' '}
            +{' '}
            <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px]">
              Enter
            </kbd>{' '}
            para generar
          </span>
          <button
            type="submit"
            disabled={!canSubmit}
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none"
          >
            {loading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {loading ? 'Generando…' : 'Generar prueba'}
          </button>
        </div>
      </form>

      <div>
        <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Ejemplos
        </p>
        <div className="grid gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              disabled={loading}
              onClick={() => {
                onInstructionChange(example.instruction);
                onBaseUrlChange(example.baseUrl);
              }}
              className="group flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 text-left text-sm text-zinc-400 transition hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-zinc-200 disabled:pointer-events-none disabled:opacity-50"
            >
              {example.label}
              <span className="font-mono text-[11px] text-zinc-600 group-hover:text-zinc-400">
                saucedemo.com
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
