import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { postReport } from '../api';

type IncidentType = 'water' | 'electricity' | 'gas' | 'heating' | 'internet';

const TYPES: { value: IncidentType; label: string; icon: string; bg: string; color: string }[] = [
  { value: 'water',       label: 'Vodovod',  icon: '💧', bg: 'var(--water-bg)',       color: 'var(--water)' },
  { value: 'electricity', label: 'Elektro',  icon: '⚡', bg: 'var(--electricity-bg)', color: 'var(--electricity)' },
  { value: 'gas',         label: 'Gas',      icon: '🔥', bg: 'var(--gas-bg)',         color: 'var(--gas)' },
  { value: 'heating',     label: 'Grijanje', icon: '🏠', bg: 'var(--heating-bg)',     color: 'var(--heating)' },
  { value: 'internet',    label: 'Internet', icon: '🌐', bg: 'var(--internet-bg)',    color: 'var(--internet)' },
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
      await postReport(form);
      setSuccess(true);
      setForm(EMPTY);
    } catch {
      setError('Greška pri slanju. Pokušajte ponovo.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="page">
        <div className="s-header" style={{ paddingBottom: 20 }}>
          <div className="s-header-title" style={{ fontSize: 20 }}>Prijava poslana</div>
        </div>
        <div className="empty" style={{ paddingTop: 60 }}>
          <div className="empty-icon">✅</div>
          <div className="empty-title">Hvala na prijavi!</div>
          <div className="empty-sub" style={{ marginBottom: 32 }}>
            Vaša prijava je zaprimljena. Provjeriće je naš tim i dodati u sistem ukoliko je potvrđena.
          </div>
          <button onClick={() => setSuccess(false)} className="btn-primary" style={{ marginBottom: 12 }}>
            Prijavi još jedan incident
          </button>
          <button onClick={() => navigate('/')} className="btn-secondary">
            Idi na početnu
          </button>
        </div>
      </div>
    );
  }

  const selectedType = TYPES.find(t => t.value === form.type);

  return (
    <div className="page">
      {/* Header */}
      <div className="s-header" style={{ paddingBottom: 20 }}>
        <button onClick={() => navigate(-1)} aria-label="Nazad" className="back-btn" style={{ marginRight: 12 }}>‹</button>
        <div>
          <div className="s-header-title" style={{ fontSize: 20 }}>Prijavi incident</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="report-form">

        {/* Tip incidenta */}
        <div className="type-select-section">
          <label className="form-field-label">
            Tip incidenta *
          </label>
          <div className="type-select-grid">
            {TYPES.map(t => (
              <button type="button" key={t.value} aria-pressed={form.type === t.value} onClick={() => setForm(f => ({ ...f, type: t.value }))}
                className={`type-select-btn${form.type === t.value ? ' active' : ''}`}
                style={{ '--accent': t.color, '--accent-bg': t.bg } as CSSProperties}>
                <span className="type-select-icon">{t.icon}</span>
                <span className="type-select-label">
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Kratak opis */}
        <Field label="Kratak opis problema *">
          <input
            placeholder={selectedType ? `npr. Nema ${selectedType.label === 'Elektro' ? 'struje' : selectedType.label === 'Vodovod' ? 'vode' : 'gasa'} od jutros...` : 'Opišite problem u jednoj rečenici'}
            value={form.title}
            onChange={set('title')}
          />
        </Field>

        {/* Adresa */}
        <Field label="Ulica / Adresa *">
          <input
            placeholder="npr. Ferhadija 12, Grbavica, Ilidža..."
            value={form.address}
            onChange={set('address')}
          />
        </Field>

        {/* Opis */}
        <Field label="Dodatni detalji (opciono)">
          <textarea
            placeholder="Kada je počelo? Koliko kuća/stanova je pogođeno? Imate li info o uzroku?"
            value={form.description}
            onChange={set('description')}
            rows={4}
            className="textarea"
          />
        </Field>

        {/* Podjeljeno sa --- */}
        <div className="form-divider-row">
          <div className="form-divider-line" />
          <span className="form-divider-label">VAŠI PODACI (opciono)</span>
          <div className="form-divider-line" />
        </div>

        {/* Ime */}
        <Field label="Ime i prezime">
          <input placeholder="Kako da vas nazovemo?" value={form.reporterName} onChange={set('reporterName')} />
        </Field>

        {/* Kontakt */}
        <Field label="Telefon ili e-mail">
          <input placeholder="Za potvrdu prijave (neće biti objavljeno)" value={form.contact} onChange={set('contact')} />
        </Field>

        {/* Error */}
        {error && (
          <div className="form-error">
            ⚠️ {error}
          </div>
        )}

        {/* Submit */}
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Slanje...' : '📤 Pošalji prijavu'}
        </button>

        <p className="form-hint">
          Prijave prolaze kroz ručnu provjeru prije objavljivanja.
        </p>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactElement<React.InputHTMLAttributes<HTMLInputElement> | React.TextareaHTMLAttributes<HTMLTextAreaElement>> }) {
  const childProps = (children as React.ReactElement<{ className?: string }>).props;
  return (
    <div className="form-field">
      <label className="form-field-label">
        {label}
      </label>
      {React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        className: `field-input${childProps.className ? ` ${childProps.className}` : ''}`,
      })}
    </div>
  );
}

import React from 'react';
