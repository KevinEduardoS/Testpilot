import { Check, Copy } from 'lucide-react';
import { Highlight, themes, type PrismTheme } from 'prism-react-renderer';
import { useEffect, useState } from 'react';

const COPIED_FEEDBACK_MS = 2000;

// Tema sobrio: el de VS Code sin su fondo, para que el bloque herede el del panel.
const CODE_THEME: PrismTheme = {
  ...themes.vsDark,
  plain: { ...themes.vsDark.plain, backgroundColor: 'transparent' },
};

export const CopyButton = ({ text, label = 'Copiar' }: { text: string; label?: string }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timeout = window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" onClick={() => void copy()} className="btn-ghost h-7 px-2 text-xs">
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {copied ? 'Copiado' : label}
    </button>
  );
};

export const CodeBlock = ({ code }: { code: string }) => (
  <Highlight theme={CODE_THEME} code={code.trimEnd()} language="tsx">
    {({ tokens, getLineProps, getTokenProps }) => (
      <pre className="max-h-[560px] overflow-auto py-3 font-mono text-xs leading-6">
        {tokens.map((line, lineIndex) => (
          <div
            key={lineIndex}
            {...getLineProps({ line })}
            className="flex px-4 hover:bg-neutral-800/30"
          >
            <span className="mr-5 inline-block w-6 shrink-0 select-none text-right text-neutral-600">
              {lineIndex + 1}
            </span>
            <span>
              {line.map((token, tokenIndex) => (
                <span key={tokenIndex} {...getTokenProps({ token })} />
              ))}
            </span>
          </div>
        ))}
      </pre>
    )}
  </Highlight>
);
