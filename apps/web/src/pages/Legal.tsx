import type { ReactNode } from 'react';
import { PageHeader } from '../components/PageHeader';
import { CONTACT_EMAIL } from '../config';

// NACRT — tekst treba pregledati prije objave
const UPDATED = '30. 10. 2026.';

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="page">
      <PageHeader back eyebrow={`Posljednja izmjena: ${UPDATED}`} title={title} narrow />
      <div className="container narrow" style={{ marginTop: 20 }}>
        <article className="card legal">{children}</article>
      </div>
    </div>
  );
}

const Contact = () => <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

export function Terms() {
  return (
    <LegalPage title="Uslovi korištenja">
      <h2>O usluzi</h2>
      <p>ServisneInfo prikuplja javno objavljene obavijesti komunalnih preduzeća u Kantonu Sarajevo
        (voda, struja, gas, grijanje, internet) i prikazuje ih na jednom mjestu. Korištenje je besplatno.</p>

      <h2>Tačnost podataka</h2>
      <p>Podatke preuzimamo automatski sa zvaničnih stranica preduzeća. Adrese, vremena i područja mogu
        biti nepotpuni ili kasniti. ServisneInfo nije zvanični kanal nijednog preduzeća — za provjeru
        uvijek otvorite zvanični izvor naveden uz obavijest ili kontaktirajte preduzeće.</p>

      <h2>Prijave korisnika</h2>
      <p>Prijave se odmah prikazuju kao nepotvrđene. Zadržavamo pravo da uklonimo prijave koje su
        netačne, uvredljive ili se ne odnose na komunalne usluge.</p>

      <h2>Odgovornost</h2>
      <p>Uslugu pružamo „kakva jeste“. Ne odgovaramo za štetu nastalu oslanjanjem na prikazane podatke.</p>

      <h2>Kontakt</h2>
      <p>Pitanja o ovim uslovima: <Contact /></p>
    </LegalPage>
  );
}
