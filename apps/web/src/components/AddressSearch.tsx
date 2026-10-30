import { useState } from 'react';
import { searchAddress, type GeocodeResult } from '../api';
import { Icon } from './Icon';

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'results'; items: GeocodeResult[] }
  | { kind: 'empty' }
  | { kind: 'error' };

// Stanja pretrage kao na mobilnoj (U7 korak 7): učitavanje, bez rezultata, greška sa ponovnim pokušajem
export function AddressSearch({ onPick, placeholder = 'npr. Ferhadija 12' }: {
  onPick: (r: GeocodeResult) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function run() {
    if (q.trim().length < 3) return;
    setState({ kind: 'loading' });
    try {
      const items = await searchAddress(q.trim());
      setState(items.length ? { kind: 'results', items } : { kind: 'empty' });
    } catch {
      setState({ kind: 'error' });
    }
  }

  return (
    <div className="addr-search">
      <div className="addr-search-row">
        <input
          className="field-input"
          value={q}
          placeholder={placeholder}
          aria-label="Pretraga adrese"
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); run(); } }}
        />
        <button type="button" className="btn secondary" onClick={run}
          disabled={state.kind === 'loading' || q.trim().length < 3}>
          {state.kind === 'loading' ? 'Traženje…' : 'Traži'}
        </button>
      </div>

      <div aria-live="polite">
        {state.kind === 'empty' && (
          <p className="addr-search-msg">Adresa nije pronađena u Kantonu Sarajevo. Možete sami postaviti pin na mapi.</p>
        )}
        {state.kind === 'error' && (
          <p className="addr-search-msg error">
            Pretraga trenutno nije dostupna.{' '}
            <button type="button" className="link-btn" onClick={run}>Pokušaj ponovo</button>
          </p>
        )}
        {state.kind === 'results' && (
          <ul className="addr-results">
            {state.items.map(r => (
              <li key={`${r.lat},${r.lng}`}>
                <button type="button" onClick={() => { onPick(r); setState({ kind: 'idle' }); }}>
                  <Icon name="pin" size={15} /> {r.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
