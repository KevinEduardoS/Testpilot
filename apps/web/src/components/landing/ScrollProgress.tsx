import { useEffect, useState } from 'react';

// Barra fina bajo la cabecera que indica cuánto de la página se ha recorrido.
export const ScrollProgress = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      const scrollable = scrollHeight - clientHeight;
      setProgress(scrollable > 0 ? scrollTop / scrollable : 0);
    };
    const onScroll = () => {
      if (frame === 0) {
        frame = requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="absolute inset-x-0 bottom-0 h-px" aria-hidden="true">
      <div
        className="h-full origin-left bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
};
