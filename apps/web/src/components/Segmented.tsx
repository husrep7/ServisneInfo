import type { CSSProperties, ReactNode } from 'react';

// Segmentirani izbor sa klizačem ispod aktivne opcije
export function Segmented<T extends string>({ value, onChange, options, label }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; count?: number }[];
  label: string;
}) {
  const idx = Math.max(0, options.findIndex(o => o.value === value));
  return (
    <div className="seg" role="group" aria-label={label}
      style={{ '--n': options.length, '--i': idx } as CSSProperties}>
      <span className="seg-thumb" aria-hidden="true" />
      {options.map(o => (
        <button key={o.value} type="button" aria-pressed={o.value === value}
          className={`seg-opt${o.value === value ? ' on' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined && <span className="seg-count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
