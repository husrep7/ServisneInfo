import { useEffect, useState } from 'react';

// Trenutno vrijeme koje se osvježava svakih `ms` milisekundi
export function useNow(ms = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(iv);
  }, [ms]);
  return now;
}
