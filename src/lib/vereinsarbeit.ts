const PRAEFIXE = [
  '/mitglieder/ausgabe',
  '/mitglieder/anbau',
  '/mitglieder/wawi',
  '/mitglieder/jahresmeldung',
  '/mitglieder/verwaltung',
  '/mitglieder/antraege',
  '/mitglieder/beitraege',
  '/mitglieder/kasse',
  '/mitglieder/nachricht',
  '/mitglieder/code',
] as const;

/** Operative Vereinsseiten sind bis zu einer vollstaendigen Uebersetzung deutsch. */
export function istVereinsarbeitPfad(pathname: string): boolean {
  return PRAEFIXE.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
