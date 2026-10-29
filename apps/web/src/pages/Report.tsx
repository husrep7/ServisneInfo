import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { postReport } from '../api';

type IncidentType = 'water' | 'electricity' | 'gas' | 'heating' | 'internet';

const TYPES: { value: IncidentType; label: string; icon: string; bg: string; color: string }[] = [
  { value: 'water',       label: 'Vodovod',  icon: '💧', bg: '#DDF3FF', color: '#007AFF' },
  { value: 'electricity', label: 'Elektro',  icon: '⚡', bg: '#FFF8C6', color: '#ECBD34' },
  { value: 'gas',         label: 'Gas',      icon: '🔥', bg: '#F7D6DC', color: '#EC5E78' },
  { value: 'heating',     label: 'Grijanje', icon: '🏠', bg: '#DED6F6', color: '#C281D1' },
  { value: 'internet',    label: 'Internet', icon: '🌐', bg: '#E4EEEB', color: '#8BB0BA' },
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
          <button onClick={() => setSuccess(false)} style={{
            background: '#007AFF', color: '#fff', border: 'none', borderRadius: 12,
            padding: '14px 32px', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 12, width: '100%',
          }}>
            Prijavi još jedan incident
          </button>
          <button onClick={() => navigate('/')} style={{
            background: 'var(--border)', color: 'var(--text)', border: 'none', borderRadius: 12,
            padding: '14px 32px', fontSize: 15, fontWeight: 700, cursor: 'pointer', width: '100%',
          }}>
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
        <button onClick={() => navigate(-1)} aria-label="Nazad" style={{
          color: '#fff', background: 'none', border: 'none', fontSize: 22, cursor: 'pointer',
          marginRight: 12, opacity: .8, padding: '4px 8px 4px 0',
        }}>‹</button>
        <div>
          <div className="s-header-title" style={{ fontSize: 20 }}>Prijavi incident</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '20px 20px 40px' }}>

        {/* Tip incidenta */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: '#949AA9', textTransform: 'uppercase', marginBottom: 12 }}>
            Tip incidenta *
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {TYPES.map(t => (
              <button type="button" key={t.value} aria-pressed={form.type === t.value} onClick={() => setForm(f => ({ ...f, type: t.value }))}
                style={{
                  background: form.type === t.value ? t.bg : 'var(--card)',
                  border: `2px solid ${form.type === t.value ? t.color : 'var(--border)'}`,
                  borderRadius: 12, padding: '12px 8px', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  transition: 'all .15s',
                }}>
                <span style={{ fontSize: 24 }}>{t.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: form.type === t.value ? t.color : '#949AA9' }}>
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
            style={{ resize: 'none' }}
          />
        </Field>

        {/* Podjeljeno sa --- */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 20px' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#C4C4C4', letterSpacing: 1 }}>VAŠI PODACI (opciono)</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
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
          <div style={{ background: '#FFF0F0', border: '1px solid #FFDCDC', borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: 13, color: '#ED1D1D', fontWeight: 600 }}>
            ⚠️ {error}
          </div>
        )}

        {/* Submit */}
        <button type="submit" disabled={loading} style={{
          width: '100%', background: loading ? '#C4C4C4' : '#007AFF',
          color: '#fff', border: 'none', borderRadius: 12, padding: '16px',
          fontSize: 15, fontWeight: 800, cursor: loading ? 'default' : 'pointer',
          letterSpacing: .5, transition: 'background .2s',
        }}>
          {loading ? 'Slanje...' : '📤 Pošalji prijavu'}
        </button>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#C4C4C4', marginTop: 14, lineHeight: 1.5 }}>
          Prijave prolaze kroz ručnu provjeru prije objavljivanja.
        </p>
      </form>
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  width: '100%', border: '1.5px solid var(--border)', borderRadius: 10,
  padding: '12px 14px', fontSize: 14, fontWeight: 500,
  fontFamily: 'Quicksand, sans-serif', outline: 'none',
  background: 'var(--bg)', color: 'var(--text)', transition: 'border-color .15s',
};

function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = 'var(--primary)';
  e.target.style.background = 'var(--card)';
}
function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = 'var(--border)';
  e.target.style.background = 'var(--bg)';
}

function Field({ label, children }: { label: string; children: React.ReactElement<React.InputHTMLAttributes<HTMLInputElement> | React.TextareaHTMLAttributes<HTMLTextAreaElement>> }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: '#949AA9', textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </label>
      {React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        style: { ...fieldStyle, ...(((children as React.ReactElement<{ style?: React.CSSProperties }>).props.style) ?? {}) },
        onFocus,
        onBlur,
      })}
    </div>
  );
}

import React from 'react';
