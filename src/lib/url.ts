// Macht interne, wurzel-relative Links basis-pfad-faehig. Noetig, wenn die
// Seite unter einem Unterpfad ausgeliefert wird (z. B. GitHub Project Pages:
// bombastix-byte.github.io/<repo>/). Lokal und auf eigenem Server ist die
// Basis '/', dann ist pfad() die Identitaet.
const basis = import.meta.env.BASE_URL;

export function pfad(p: string): string {
  if (!p || !p.startsWith('/')) return p; // externe Links, mailto, Anker unveraendert
  const b = basis.endsWith('/') ? basis.slice(0, -1) : basis;
  return b + p;
}
