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
      <p>Prijave prekida prolaze ručnu provjeru prije objave. Zadržavamo pravo da odbijemo ili uklonimo
        prijave koje su netačne, uvredljive ili se ne odnose na komunalne usluge.</p>

      <h2>Odgovornost</h2>
      <p>Uslugu pružamo „kakva jeste“. Ne odgovaramo za štetu nastalu oslanjanjem na prikazane podatke.</p>

      <h2>Kontakt</h2>
      <p>Pitanja o ovim uslovima: <Contact /></p>
    </LegalPage>
  );
}

export function Privacy() {
  return (
    <LegalPage title="Politika privatnosti">
      <h2>Šta prikupljamo</h2>
      <p>Pregled obavijesti ne zahtijeva račun niti lične podatke.</p>
      <p>Kada pošaljete prijavu prekida, čuvamo opis problema i adresu koju unesete. Ime i kontakt
        (telefon ili e-mail) su opcioni i koriste se samo za potvrdu prijave — nikad se ne objavljuju.</p>

      <h2>Podaci na vašem uređaju</h2>
      <p>Aplikacija u pregledniku pamti samo odabranu temu (svijetla/tamna). Ne koristimo kolačiće za
        praćenje ni oglašavanje.</p>

      <h2>Dijeljenje</h2>
      <p>Lične podatke ne prodajemo niti dijelimo sa trećim stranama.</p>

      <h2>Vaša prava</h2>
      <p>Možete zatražiti uvid u svoje podatke ili njihovo brisanje na <Contact />.</p>
    </LegalPage>
  );
}
