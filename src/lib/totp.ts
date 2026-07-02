// TOTP (RFC 6238) fuer die Zwei-Faktor-Anmeldung mit Authenticator-Apps
// (Google Authenticator, Aegis, 2FAS, ...). Bewusst ohne Fremdpaket:
// Node-crypto reicht, und die Logik bleibt pruefbar (RFC-Testvektoren im Test).
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Bytes -> Base32 (ohne Padding), wie von Authenticator-Apps erwartet. */
export function base32Encode(buf: Uint8Array): string {
  let bits = 0;
  let wert = 0;
  let out = '';
  for (const b of buf) {
    wert = (wert << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(wert >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(wert << (5 - bits)) & 31];
  return out;
}

/** Base32 -> Bytes (tolerant gegenueber Klein-/Leerzeichen). */
export function base32Decode(s: string): Uint8Array {
  const sauber = s.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let wert = 0;
  const out: number[] = [];
  for (const c of sauber) {
    wert = (wert << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((wert >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

/** Neues zufaelliges Geheimnis (20 Bytes, Base32) fuer die Einrichtung. */
export function neuesSecret(): string {
  return base32Encode(randomBytes(20));
}

/** HOTP (RFC 4226): 6-stelliger Code fuer einen Zaehlerwert. */
export function hotp(secretB32: string, zaehler: number): string {
  const puffer = Buffer.alloc(8);
  puffer.writeBigUInt64BE(BigInt(zaehler));
  const mac = createHmac('sha1', Buffer.from(base32Decode(secretB32))).update(puffer).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const code =
    (((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3]) % 1_000_000;
  return String(code).padStart(6, '0');
}

/** Aktueller TOTP-Zeitschritt (30-Sekunden-Fenster). */
export function zeitschritt(jetztMs: number = Date.now()): number {
  return Math.floor(jetztMs / 1000 / 30);
}

/**
 * Prueft einen eingegebenen Code gegen das Geheimnis (Fenster +-1 Schritt,
 * also 30 s Uhrabweichung). Liefert den verwendeten Zeitschritt zurueck oder
 * null - der Aufrufer speichert den Schritt gegen Wiederverwendung (Replay).
 */
export function totpPruefen(
  secretB32: string,
  eingabe: string,
  jetztMs: number = Date.now(),
): number | null {
  const code = eingabe.replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return null;
  const basis = zeitschritt(jetztMs);
  for (const delta of [0, -1, 1]) {
    const schritt = basis + delta;
    const soll = hotp(secretB32, schritt);
    if (soll.length === code.length && timingSafeEqual(Buffer.from(soll), Buffer.from(code))) {
      return schritt;
    }
  }
  return null;
}

/** otpauth-URL fuer den Einrichtungs-QR (Issuer = Vereinsname). */
export function otpauthUrl(issuer: string, konto: string, secretB32: string): string {
  const i = encodeURIComponent(issuer);
  const k = encodeURIComponent(konto);
  return `otpauth://totp/${i}:${k}?secret=${secretB32}&issuer=${i}&algorithm=SHA1&digits=6&period=30`;
}
