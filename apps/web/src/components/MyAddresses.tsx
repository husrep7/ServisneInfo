import { useState } from 'react';
import { MAX_ADDRESSES, makeAddress, saveAddresses, useAddresses } from '../addresses';
import { storageAvailable } from '../storage';
import { AddressSearch } from './AddressSearch';
import { PinPicker, type LatLng } from './PinPicker';
import { Icon } from './Icon';

// Do 5 adresa za filter "Kod mene" (R4, KTD2): pretraga, potvrda ili pomjeranje pina, oznaka
export function MyAddresses() {
  const addresses = useAddresses();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [text, setText] = useState('');
  const [point, setPoint] = useState<LatLng | null>(null);
  const [persisted] = useState(storageAvailable);

  const reset = () => { setAdding(false); setLabel(''); setText(''); setPoint(null); };

  const save = () => {
    if (!point) return;
    saveAddresses([...addresses, makeAddress(label, text.trim() || 'Odabrano na mapi', point.lat, point.lng)]);
    reset();
  };

  const remove = (id: string) => saveAddresses(addresses.filter(a => a.id !== id));

  return (
    <div className="stack">
      <div className="section-head" style={{ marginTop: 12, marginBottom: 0 }}>
        <h2 className="section-title">Moje adrese</h2>
        <span className="section-meta">{addresses.length}/{MAX_ADDRESSES}</span>
      </div>

      {!persisted && (
        <p className="notice">Browser ne dozvoljava čuvanje podataka, pa će se adrese zaboraviti kad zatvorite stranicu.</p>
      )}

      {addresses.length === 0 && !adding && (
        <div className="card"><p className="setting-sub" style={{ marginTop: 0 }}>
          Dodajte adresu (kuća, posao, roditelji…) i filter „Kod mene" na početnoj će prikazati samo prekide koji je pogađaju.
          Adrese ostaju samo u ovom browseru.
        </p></div>
      )}

      {addresses.length > 0 && (
        <div className="addr-list">
          {addresses.map(a => (
            <div key={a.id} className="card addr-item">
              <span className="setting-icon"><Icon name="pin" /></span>
              <div className="addr-item-body">
                <div className="addr-item-label">{a.label}</div>
                {a.label !== a.text && <div className="addr-item-text">{a.text}</div>}
              </div>
              <button className="btn secondary" onClick={() => remove(a.id)} aria-label={`Ukloni adresu ${a.label}`}>Ukloni</button>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="card form">
          <AddressSearch onPick={r => { setPoint({ lat: r.lat, lng: r.lng }); setText(r.label); }} />
          <PinPicker value={point} onChange={setPoint} label="Mapa: kliknite ili prevucite pin na tačnu lokaciju" />
          <p className="pin-help" style={{ marginTop: 0 }}>
            {point ? 'Provjerite pin i po potrebi ga prevucite na tačnu lokaciju.' : 'Potražite adresu ili kliknite na mapu.'}
          </p>
          <label className="form-label">
            Oznaka <span className="opt">(opciono)</span>
            <input className="field-input" style={{ marginTop: 8 }} value={label} maxLength={40}
              placeholder="npr. Kuća, Posao" onChange={e => setLabel(e.target.value)} />
          </label>
          <div className="addr-search-row">
            <button className="btn primary" onClick={save} disabled={!point}>Sačuvaj adresu</button>
            <button className="btn secondary" onClick={reset}>Odustani</button>
          </div>
        </div>
      ) : addresses.length < MAX_ADDRESSES ? (
        <button className="btn secondary block" onClick={() => setAdding(true)}>
          <Icon name="plus" size={16} /> Dodaj adresu
        </button>
      ) : (
        <p className="setting-sub">Sačuvano je najviše {MAX_ADDRESSES} adresa. Uklonite jednu da dodate novu.</p>
      )}
    </div>
  );
}
