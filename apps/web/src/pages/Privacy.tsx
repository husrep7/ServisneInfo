import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';

// Ko upravlja podacima i kako ga kontaktirati — postavlja se pri deployu (Vercel env)
const OPERATOR = import.meta.env.VITE_PRIVACY_OPERATOR as string | undefined;
const CONTACT  = import.meta.env.VITE_PRIVACY_CONTACT as string | undefined;
const UPDATED  = '30. 10. 2026.';

// Rokovi moraju odgovarati apps/backend/src/jobs/retention.job.ts (RETENTION) i KTD10
const RETENTION_ROWS: [string, string][] = [
  ['Nepotvrđena prijava (javno)', '6 sati, pa se skida sa liste i mape'],
  ['Ime i kontakt iz prijave', '7 dana, zatim se brišu'],
  ['Hash IP adrese prijavioca', '30 dana, zatim se briše'],
  ['Zadnja lokacija uređaja', 'dok je ne zamijeni nova; briše se kad isključite lokaciju ili nakon 90 dana neaktivnosti'],
  ['Adrese i postavke na mobilnoj', 'dok ih ne obrišete ili ne obrišete podatke u aplikaciji'],
  ['Adrese na webu', 'samo u vašem browseru, dok ih ne obrišete'],
];

export default function Privacy() {
  return (
    <div className="page">
      <PageHeader back eyebrow="ServisneInfo" title="Privatnost i uslovi" narrow />

      <article className="container narrow legal" style={{ marginTop: 20 }}>
        <p className="legal-meta">Zadnja izmjena: {UPDATED}</p>

        <section>
          <h2>Ukratko</h2>
          <ul>
            <li>Za korištenje ne treba račun, ime ni e-mail.</li>
            <li>Lokaciju koristimo samo ako je sami uključite u mobilnoj aplikaciji.</li>
            <li>Ime i kontakt iz prijave vidi samo moderator i brišu se nakon 7 dana.</li>
            <li>Svoje podatke možete obrisati sami, u Profilu na webu ili u Postavkama aplikacije.</li>
          </ul>
        </section>

        <section>
          <h2>Ko upravlja podacima</h2>
          <p>
            ServisneInfo{OPERATOR ? <>, {OPERATOR}</> : null}.{' '}
            {CONTACT
              ? <>Za pitanja o privatnosti pišite na <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</>
              : 'Kontakt za pitanja o privatnosti biće objavljen ovdje.'}
          </p>
        </section>

        <section>
          <h2>Šta prikupljamo i zašto</h2>
          <h3>Web</h3>
          <ul>
            <li><b>Sačuvane adrese</b> za filter „Kod mene" čuvaju se samo u vašem browseru i ne šalju se nama.</li>
            <li><b>Anonimni ID prijavioca</b> (nasumičan broj u browseru) šalje se uz prijavu, da bismo mogli ograničiti broj prijava i blokirati zloupotrebu.</li>
          </ul>
          <h3>Mobilna aplikacija</h3>
          <ul>
            <li><b>ID uređaja i push token</b>, da bismo vam mogli poslati obavijest.</li>
            <li><b>Sačuvane adrese i postavke</b> (podsjetnik, isključene usluge), da obavijesti stignu za prava mjesta.</li>
            <li><b>Trenutna lokacija</b>, samo ako uključite obavijesti po lokaciji. Pamtimo samo zadnju poziciju.</li>
          </ul>
          <h3>Prijava problema</h3>
          <ul>
            <li><b>Tip, opis, adresa i tačka na mapi</b> prikazuju se javno kao nepotvrđena prijava.</li>
            <li><b>Ime i kontakt</b> su opcioni. Vidi ih samo moderator, ako treba nešto provjeriti, i nikad se ne objavljuju.</li>
            <li><b>IP adresa</b> se ne čuva. Čuvamo samo njen jednosmjerni hash, za zaštitu od lažnih i masovnih prijava.</li>
          </ul>
        </section>

        <section>
          <h2>Koliko dugo čuvamo podatke</h2>
          <table className="legal-table">
            <tbody>
              {RETENTION_ROWS.map(([what, how]) => (
                <tr key={what}><th scope="row">{what}</th><td>{how}</td></tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2>Ko još vidi podatke</h2>
          <ul>
            <li><b>Javnost</b> vidi nepotvrđene prijave (tip, opis, adresu, tačku i vrijeme), ali nikad ime, kontakt ni ID.</li>
            <li><b>Moderator</b> vidi ime i kontakt iz prijave.</li>
            <li><b>Tehnički servisi</b> koje koristimo za rad aplikacije: hosting weba (Vercel) i servera; OpenStreetMap
              za mape i pretragu adresa (vidi vašu IP adresu i upisanu adresu); Google Fonts za font na webu; Expo, Apple
              i Google za dostavu push obavijesti.</li>
          </ul>
          <p>Podatke ne prodajemo i ne koristimo za reklame.</p>
        </section>

        <section>
          <h2>Brisanje i vaša prava</h2>
          <ul>
            <li><b>Web:</b> u <Link to="/settings">Profilu</Link> dugme „Obriši moje podatke sa ovog uređaja" briše adrese i anonimni ID iz browsera.</li>
            <li><b>Mobilna:</b> u Postavkama „Isključi obavijesti i obriši moje podatke" briše uređaj, adrese, postavke i
              lokaciju sa servera, kao i ime i kontakt iz vaših prijava.</li>
            <li>Možete tražiti uvid u podatke, ispravku ili brisanje{CONTACT ? <> na <a href={`mailto:${CONTACT}`}>{CONTACT}</a></> : null}.</li>
          </ul>
        </section>

        <section>
          <h2>Uslovi korištenja</h2>
          <ul>
            <li>ServisneInfo prikazuje obavijesti koje objavljuju komunalna preduzeća i prijave građana. Ne garantujemo da
              su potpune, tačne ni na vrijeme. Za službene informacije i hitne slučajeve kontaktirajte preduzeće.</li>
            <li>ServisneInfo nije povezan ni sa jednim od preduzeća čije obavijesti prikazuje.</li>
            <li>Prijave moraju biti istinite. Lažne i uvredljive prijave uklanjamo, a pošiljaoca možemo blokirati bez najave.</li>
            <li>Usluga je besplatna i može se promijeniti ili ugasiti. O važnim izmjenama ovih uslova obavijestićemo na ovoj stranici.</li>
          </ul>
        </section>
      </article>
    </div>
  );
}
