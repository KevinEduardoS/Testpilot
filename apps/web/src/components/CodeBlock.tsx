import { Check, Copy } from 'lucide-react';
import { Highlight, themes } from 'prism-react-renderer';
import { useEffect, useState } from 'react';

const COPIED_FEEDBACK_MS = 2000;

export const CopyButton = ({ text }: { text: string }) => {
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
    <button
      type="button"
      onClick={() => void copy()}
      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-200"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  );
};

export const CodeBlock = ({ code }: { code: string }) => (
  <Highlight theme={themes.oneDark} code={code.trimEnd()} language="tsx">
    {({ tokens, getLineProps, getTokenProps }) => (
      <pre className="max-h-[560px] overflow-auto py-4 font-mono text-[12.5px] leading-6">
        {tokens.map((line, lineIndex) => (
          <div
            key={lineIndex}
            {...getLineProps({ line })}
            className="flex px-4 hover:bg-white/[0.02]"
          >
            <span className="mr-5 inline-block w-6 shrink-0 select-none text-right text-zinc-600">
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
