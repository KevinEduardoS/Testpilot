import { useEffect, useState } from 'react';

export const useElapsedSeconds = (startedAt: number) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  return Math.max(0, Math.floor((now - startedAt) / 1000));
};
