# Oeffentliche Seiten online stellen (Statik-Demo)

Build erzeugen:

```bash
npm run build:static
```

Ergebnis liegt in `./dist` (rein statisch, nur oeffentliche Seiten plus eine
Platzhalter-Seite fuer den Mitgliederbereich). Auch als `canna-vereine-static.zip`
gepackt.

Alle vier Designs lassen sich auf der Live-Seite per Adresse durchschalten:
`...?theme=botanik`, `?theme=klar`, `?theme=warm`, `?theme=nacht`.

## Schnellste Wege (Konto noetig, einmal anmelden)

Hinweis: Statik-Hoster verlangen ein Konto. Anmeldung musst du selbst machen,
danach genuegt ein Schritt.

### Netlify Drop (am einfachsten, kein CLI)

1. https://app.netlify.com/drop oeffnen.
2. Den Ordner `dist` per Drag-and-drop ins Browserfenster ziehen.
3. Sofort entsteht eine oeffentliche HTTPS-Adresse, die du teilen kannst.

### Cloudflare Pages (Direct Upload)

1. Im Cloudflare-Dashboard: Workers & Pages, "Create", "Pages",
   "Upload assets".
2. `dist` hochladen (oder das ZIP). Fertig, feste Adresse.

### Per CLI (wenn du schon angemeldet bist)

```bash
# Netlify
npx netlify deploy --dir=dist --prod

# Cloudflare
npx wrangler pages deploy dist
```

## DSGVO-Hinweis

Fuer eine kurze Demo unkritisch. Fuer den Dauerbetrieb der echten Vereinsseiten
moeglichst EU-/DE-Hosting waehlen (passt zur spaeteren PocketBase-Instanz).
