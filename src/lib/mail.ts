// E-Mail-Versand ueber SMTP (Vereins-Postfach). Konfiguration ueber Env:
//   SMTP_HOST, SMTP_PORT (587/465), SMTP_USER, SMTP_PASS, SMTP_FROM
// Ohne Konfiguration wird NICHT gesendet (Rueckgabe { ok:false, grund:'nicht
// konfiguriert' }) - Ablaeufe wie Aufnahme/Antrag laufen dann normal weiter,
// nur eben ohne automatische Mail. So bleibt das System auch ohne Postfach nutzbar.
import nodemailer from 'nodemailer';

function env(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
  const ime = import.meta.env as Record<string, string | undefined> | undefined;
  return ime ? ime[key] : undefined;
}

export function mailKonfiguriert(): boolean {
  return !!(env('SMTP_HOST') && env('SMTP_FROM'));
}

let cached: nodemailer.Transporter | null = null;
function transport(): nodemailer.Transporter | null {
  if (!mailKonfiguriert()) return null;
  if (cached) return cached;
  const port = Number(env('SMTP_PORT') ?? '587');
  cached = nodemailer.createTransport({
    host: env('SMTP_HOST'),
    port,
    secure: port === 465, // 465 = implizites TLS, 587 = STARTTLS
    auth: env('SMTP_USER') ? { user: env('SMTP_USER'), pass: env('SMTP_PASS') } : undefined,
  });
  return cached;
}

export interface MailErgebnis {
  ok: boolean;
  grund?: string;
}

/** Sendet eine E-Mail. Fehler werden geschluckt (nur geloggt) - eine nicht
 *  zustellbare Mail darf nie den ausloesenden Vorgang scheitern lassen. */
export async function sendeMail(opts: {
  an: string;
  betreff: string;
  text: string;
}): Promise<MailErgebnis> {
  const t = transport();
  if (!t) return { ok: false, grund: 'nicht konfiguriert' };
  try {
    await t.sendMail({
      from: env('SMTP_FROM'),
      to: opts.an,
      subject: opts.betreff,
      text: opts.text,
    });
    return { ok: true };
  } catch (e) {
    console.error('[mail] Versand fehlgeschlagen:', (e as Error)?.message ?? e);
    return { ok: false, grund: 'versand-fehler' };
  }
}
