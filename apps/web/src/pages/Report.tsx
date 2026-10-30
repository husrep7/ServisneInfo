import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { postReport } from '../api';
import { reporterId } from '../addresses';
import { PinPicker, type LatLng } from '../components/PinPicker';
import { AddressSearch } from '../components/AddressSearch';
import type { IncidentType } from '../types';
import { typeStyle } from '../types';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/States';
import { Icon, TypeIcon } from '../components/Icon';

const TYPES: { value: IncidentType; label: string }[] = [
  { value: 'water',       label: 'Vodovod'  },
  { value: 'electricity', label: 'Elektro'  },
  { value: 'gas',         label: 'Gas'      },
  { value: 'heating',     label: 'Grijanje' },
  { value: 'internet',    label: 'Internet' },
];

interface Form {
  type:         IncidentType | '';
  title:        string;
  description:  string;
  address:      string;
  reporterName: string;
  contact:      string;
}

const EMPTY: Form = { type: '', title: '', description: '', address: '', reporterName: '', contact: '' };

export default function Report() {
  const navigate  = useNavigate();
  const [form, setForm]     = useState<Form>(EMPTY);
  const [point, setPoint]   = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState('');

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.type)    return setError('Odaberite tip incidenta.');
    // Ista pravila kao na backendu (routes/reports.ts)
    if (form.title.trim().length < 5)   return setError('Kratak opis mora imati najmanje 5 znakova.');
    if (form.address.trim().length < 3) return setError('Unesite adresu/lokaciju (najmanje 3 znaka).');
    setError('');
    setLoading(true);
    try {
      await postReport({ ...form, type: form.type, ...(point ?? {}), reporterKey: reporterId() });
      setSuccess(true);
      setForm(EMPTY);
      setPoint(null);
    } catch {
      setError('Greška pri slanju. Pokušajte ponovo.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="page">
        <PageHeader back title="Prijava poslana" narrow />
        <div className="container narrow">
          <EmptyState title="Hvala na prijavi!"
            action={
              <div className="stack" style={{ width: '100%', maxWidth: 320 }}>
                <button onClick={() => setSuccess(false)} className="btn primary block">Prijavi još jedan incident</button>
                <button onClick={() => navigate('/')} className="btn secondary block">Idi na početnu</button>
              </div>
            }>
            Prijava je odmah vidljiva drugima kao nepotvrđena. Postaje prekid kad je potvrdi moderator
            ili kad isti problem u blizini prijave još dva korisnika. Ako je niko ne potvrdi, ističe za 6 sati.
          </EmptyState>
        </div>
      </div>
    );
  }

  const selectedType = TYPES.find(t => t.value === form.type);

  return (
    <div className="page">
      <PageHeader back eyebrow="ServisneInfo" title="Prijavi incident" narrow />

      <div className="container narrow" style={{ marginTop: 20 }}>
        <form onSubmit={handleSubmit} className="card form" noValidate>
          <div>
            <span className="form-label" id="type-label">Šta ne radi?</span>
            <div className="type-grid" role="group" aria-labelledby="type-label">
              {TYPES.map(t => (
                <button type="button" key={t.value} aria-pressed={form.type === t.value}
                  onClick={() => setForm(f => ({ ...f, type: t.value }))}
                  className={`type-btn${form.type === t.value ? ' active' : ''}`}
                  style={typeStyle(t.value)}>
                  <span className="type-btn-icon"><TypeIcon type={t.value} size={20} /></span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <Field label="Kratak opis problema">
            <input
              placeholder={selectedType ? `npr. Nema ${selectedType.label === 'Elektro' ? 'struje' : selectedType.label === 'Vodovod' ? 'vode' : selectedType.label === 'Internet' ? 'interneta' : selectedType.label === 'Grijanje' ? 'grijanja' : 'gasa'} od jutros...` : 'Opišite problem u jednoj rečenici'}
              value={form.title}
              onChange={set('title')}
            />
          </Field>

          <div>
            <span className="form-label" id="where-label">Gdje? <span className="opt">(pin na mapi pomaže da se prijava potvrdi)</span></span>
            <div className="stack" role="group" aria-labelledby="where-label">
              <AddressSearch placeholder="Potražite ulicu i broj"
                onPick={r => {
                  setPoint({ lat: r.lat, lng: r.lng });
                  setForm(f => ({ ...f, address: f.address.trim() ? f.address : r.label }));
                }} />
              <PinPicker value={point} onChange={setPoint} label="Mapa: kliknite da postavite mjesto problema" />
              <div className="pin-help">
                {point
                  ? <span><Icon name="check" size={14} /> Pin je postavljen — možete ga prevući.</span>
                  : <span>Kliknite na mapu da označite mjesto.</span>}
                {'geolocation' in navigator && (
                  <button type="button" className="link-btn" disabled={locating}
                    onClick={() => {
                      setLocating(true);
                      navigator.geolocation.getCurrentPosition(
                        p => { setPoint({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocating(false); },
                        () => setLocating(false),
                        { enableHighAccuracy: true, timeout: 10_000 },
                      );
                    }}>
                    {locating ? 'Tražim lokaciju…' : 'Koristi moju lokaciju'}
                  </button>
                )}
                {point && <button type="button" className="link-btn" onClick={() => setPoint(null)}>Ukloni pin</button>}
              </div>
            </div>
          </div>

          <Field label="Ulica / adresa">
            <input placeholder="npr. Ferhadija 12, Grbavica, Ilidža..." value={form.address} onChange={set('address')} />
          </Field>

          <Field label="Dodatni detalji" optional>
            <textarea
              placeholder="Kada je počelo? Koliko kuća/stanova je pogođeno? Imate li info o uzroku?"
              value={form.description}
              onChange={set('description')}
              rows={4}
              className="textarea"
            />
          </Field>

          <div className="form-divider">Vaši podaci (opciono)</div>
          <p className="form-hint" style={{ textAlign: 'left', marginTop: -8 }}>
            Ime i kontakt vidi samo moderator, nikad se ne objavljuju, i brišu se nakon 7 dana.{' '}
            <Link to="/privatnost">Više o privatnosti</Link>
          </p>

          <Field label="Ime i prezime" optional>
            <input placeholder="Kako da vas nazovemo?" value={form.reporterName} onChange={set('reporterName')} />
          </Field>

          <Field label="Telefon ili e-mail" optional>
            <input placeholder="Ako moderator treba nešto provjeriti" value={form.contact} onChange={set('contact')} />
          </Field>

          {error && (
            <div className="form-error" role="alert"><Icon name="alert" size={18} /> {error}</div>
          )}

          <button type="submit" disabled={loading} className="btn primary block">
            <Icon name="send" size={17} /> {loading ? 'Slanje...' : 'Pošalji prijavu'}
          </button>

          <p className="form-hint">Prijava se odmah prikazuje kao nepotvrđena. Moguće je poslati najviše 3 prijave na sat.</p>
        </form>
      </div>
    </div>
  );
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactElement<React.InputHTMLAttributes<HTMLInputElement> | React.TextareaHTMLAttributes<HTMLTextAreaElement>> }) {
  const childProps = (children as React.ReactElement<{ className?: string }>).props;
  return (
    <div>
      <label className="form-label">
        {label} {optional && <span className="opt">(opciono)</span>}
        <span style={{ display: 'block', marginTop: 8 }}>
          {React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
            className: `field-input${childProps.className ? ` ${childProps.className}` : ''}`,
          })}
        </span>
      </label>
    </div>
  );
}
