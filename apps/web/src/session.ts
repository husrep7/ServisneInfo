// Prijavljeni korisnik (ADR-0003): token sesije i osnovni podaci čuvaju se u browseru,
// a backend ih provjerava na svakom zahtjevu. Gost = korisnik koji je preskočio prijavu.
import { useSyncExternalStore } from 'react';
import { readJSON, removeKey, writeJSON } from './storage';

export interface User {
  id:          string;
  email:       string;
  name:        string | null;
  hasPassword: boolean;
  hasGoogle:   boolean;
}

export interface Session {
  token: string;
  user:  User;
}

const KEY = 'si_session';
const GUEST_KEY = 'si_guest';

let session: Session | null | undefined;
let guest: boolean | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(fn => fn());

export function getSession(): Session | null {
  if (session === undefined) {
    const s = readJSON<Session | null>(KEY, null);
    session = s && typeof s.token === 'string' && s.user ? s : null;
  }
  return session;
}

export function setSession(s: Session | null): void {
  session = s;
  if (s) { writeJSON(KEY, s); setGuest(false); } else removeKey(KEY);
  emit();
}

export function isGuest(): boolean {
  if (guest === undefined) guest = readJSON<boolean>(GUEST_KEY, false) === true;
  return guest;
}

export function setGuest(value: boolean): void {
  guest = value;
  if (value) writeJSON(GUEST_KEY, true); else removeKey(GUEST_KEY);
  emit();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, getSession);
}

export function useGuest(): boolean {
  return useSyncExternalStore(subscribe, isGuest);
}

// "Abdullah" iz imena ili emaila
export function firstName(u: User): string {
  return (u.name?.split(/\s+/)[0] || u.email.split('@')[0]).replace(/^\w/, c => c.toUpperCase());
}
