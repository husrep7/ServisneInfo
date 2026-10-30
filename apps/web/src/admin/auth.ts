// Privremena prijava za admin dashboard.
// Ovo je samo UI vrata: lozinka se provjerava u browseru (PBKDF2 hash), pa
// ne štiti podatke. Pravu zaštitu daje backend kad dođe admin API (#50/#51)
// i tada se ovaj fajl zamjenjuje provjerom na serveru.

const USERNAME = 'admin';
const SALT_HEX = 'dc64494530474c68a8c6bf4badbcd018';
const HASH_HEX = '9a7adda6b0b96026e49e81f7aedbf4ade88473b677a52027e3ee93a0cc830cb6';
const ITERATIONS = 210_000;
const SESSION_KEY = 'admin_session';

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function login(username: string, password: string): Promise<boolean> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(SALT_HEX), iterations: ITERATIONS },
    key,
    256,
  );
  const ok = username.trim() === USERNAME && bytesToHex(bits) === HASH_HEX;
  if (ok) sessionStorage.setItem(SESSION_KEY, '1');
  return ok;
}

export function isLoggedIn(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === '1';
}

export function logout(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
