const SICHERE_METHODEN = new Set(['GET', 'HEAD', 'OPTIONS']);

function ersterHeaderWert(wert: string | null): string {
  return (wert ?? '').split(',')[0]?.trim() ?? '';
}

function normalisiereOrigin(wert: string): string | null {
  try {
    return new URL(wert).origin;
  } catch {
    return null;
  }
}

/**
 * Expliziter CSRF-Schutz fuer mutierende Astro-Routen hinter Reverse-Proxies.
 * TRUSTED_ORIGINS ist eine kommaseparierte Allowlist. Zusaetzlich wird der
 * vom Proxy gemeldete Host akzeptiert; Caddy setzt X-Forwarded-Host/Proto.
 */
export function originErlaubt(request: Request, erlaubteOrigins = ''): boolean {
  if (SICHERE_METHODEN.has(request.method.toUpperCase())) return true;

  const origin = normalisiereOrigin(request.headers.get('origin') ?? '');
  if (!origin) return false;

  const erlaubt = new Set<string>();
  for (const eintrag of erlaubteOrigins.split(',')) {
    const normalisiert = normalisiereOrigin(eintrag.trim());
    if (normalisiert) erlaubt.add(normalisiert);
  }

  const url = new URL(request.url);
  erlaubt.add(url.origin);

  const host = ersterHeaderWert(request.headers.get('x-forwarded-host'));
  const proto = ersterHeaderWert(request.headers.get('x-forwarded-proto'));
  if (host && (proto === 'https' || proto === 'http')) {
    const proxyOrigin = normalisiereOrigin(`${proto}://${host}`);
    if (proxyOrigin) erlaubt.add(proxyOrigin);
  }

  return erlaubt.has(origin);
}
