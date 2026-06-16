# canna-vereine

KCanG-konformes, konfigurationsgetriebenes Website-Template fuer Cannabis-
Anbauvereinigungen. Pilotprojekt fuer die Vereinigungen in Goerlitz und Leipzig
(drei Seiten geplant).

## Stack

- **Astro 5** als Frontend, eine Codebasis fuer alle Vereine.
- **PocketBase** (geplant) als selbst gehostetes CMS + Auth: Vorstand pflegt
  News/Dokumente/Termine selbst, gleichzeitig Login-Backend fuer den
  Mitgliederbereich.
- **Hosting:** Hetzner (DE), DSGVO-konform.

## Konfigurationsprinzip

Alle sichtbaren Inhalte einer Seite stammen aus einer `SiteConfig`
(`src/config/<verein>.ts`). Eine weitere Vereinsseite braucht nur:

1. neue Datei `src/config/leipzig.ts` (Kopie von `goerlitz.ts`, Daten ersetzen),
2. Eintrag in der Registry `src/config/index.ts`,
3. Build mit `SITE_ID=leipzig`.

## Themes (eigenes Gesicht je Verein)

Struktur und Inhalt sind fuer alle Vereine identisch, die Anmutung steuert das
Feld `theme` in der `SiteConfig`. Drei Designs stehen bereit:

- `botanik` — klassisch-editorial, Serifen, tiefes Gruen + Messing.
- `klar` — modern, weiss, kraeftige Grotesk, Petrol-Akzent, scharfe Kanten.
- `warm` — gemeinschaftlich, Creme + Terrakotta, humanistisch, weiche Rundungen.
- `nacht` — elegant dunkel, High-Contrast-Serife (Baskerville), Salbei + Messing.

Die Gestaltung liegt komplett in `src/styles/themes.css` als Token-Saetze je
`[data-theme]`; `src/styles/global.css` ist themeneutral (nur Layout). Ein neues
Theme = ein weiterer Token-Block, keine Aenderung an Inhalt oder Struktur.

Die Token sind semantisch (`--bg`, `--ink`, `--brand`, `--hero-bg`, `--radius`,
`--font-display` usw.) und damit nicht an ein bestimmtes Layout gebunden: ein
Theme laesst sich auf eine andere Seitenstruktur uebertragen, solange diese
dieselben Token nutzt. Einzige Kopplung sind wenige `[data-theme] .klasse`
Feinheiten je Theme (gesammelt in themes.css).

**Demo-Umschalter:** im Dev/Angebot per Query `?theme=klar`, `?theme=warm`,
`?theme=nacht` durchschaltbar. Im Echtbetrieb steht das Theme fest in der
Vereins-Config.

## Layouts (Grundstruktur)

Unabhaengig vom Theme bestimmt das Feld `layout` in der `SiteConfig` die
Grundstruktur:

- `standard` (Default) — Kopfleiste oben mit horizontaler Navigation.
- `sidebar` — feste Seitenleiste am Desktop, Hamburger-Schublade am Handy
  (reines CSS, kein JS). Modern und schlank.

Beide Layouts nutzen dieselben Theme-Token, jede Theme/Layout-Kombination ist
also moeglich. Struktur in `src/layouts/Basis.astro` (Weiche), Sidebar in
`src/components/Sidebar.astro` und `src/styles/sidebar.css`. Die Inhaltsseiten
bleiben unveraendert, sie nutzen weiter nur `Basis`.

## Befehle

```bash
npm install
npm run dev      # Entwicklung (Standard SITE_ID=goerlitz)
npm run build    # statischer Build
```

Andere Seite bauen: Umgebungsvariable `SITE_ID` setzen (z. B. `leipzig`).

## Seitenstruktur

- `/` Startseite (sachliche Einordnung, Themenuebersicht)
- `/aufnahmeverfahren` Voraussetzungen und Ablauf (keine Beitrittsaufforderung)
- `/satzung-beitraege` Satzung + Beitragsordnung (PDF)
- `/gesundheit-jugendschutz` Gesundheits- und Jugendschutzkonzept
- `/praevention-beratung` Praeventionsbeauftragte Person + externe Beratung
- `/anbau-sorten` objektive Sortenangaben (THC/CBD, Herkunft)
- `/rechtliche-hinweise` gesetzliche Grundlagen
- `/kontakt`, `/impressum`, `/datenschutz`
- `/mitglieder` Login (serverseitig, PocketBase-Auth)
- `/mitglieder/anmelden` POST-Endpunkt: Login, setzt httpOnly-Cookie
- `/mitglieder/bereich` geschuetztes Dashboard (Mitteilungen, Termine, Dokumente)
- `/mitglieder/abmelden` Logout

## Mitgliederbereich (PocketBase)

Hybrid-Rendering: oeffentliche Seiten sind statisch, die `/mitglieder/*` Routen
serverseitig (`export const prerender = false`, Node-Adapter). Auth und Inhalte
liefert ein selbst gehostetes PocketBase; der Token liegt in einem httpOnly-
Cookie (`pb_token`). Server-Adresse ueber `PB_URL` (siehe `.env.example`).

- Einrichtung des Servers: siehe `SETUP-POCKETBASE.md`.
- Lokales Befuellen fuer die Demo: `node scripts/seed.mjs` (legt Collections,
  ein Testmitglied und Beispielinhalte an, idempotent).
- Lib: `src/lib/pb.ts` (Client + Token-Validierung).

## Compliance-Leitlinien (KCanG)

Eingehalten im Template:
- keine Animationen, kein Sound, gedaempfte Farben, keine werbenden Grafiken
- keine Call-to-Actions ("Jetzt Mitglied werden"), nur sachliche Darstellung
- kein Merchandising, keine Rabatte, keine Preiswerbung
- Pflichthinweise zu Jugendschutz und Gesundheit, Praeventionskontakt

## Offene Punkte vor Livegang

1. **Echte Vereinsdaten** einsetzen (alle mit `TODO`/`Platzhalter` markierten
   Felder in `src/config/goerlitz.ts`).
2. **Deutsche Umlaute** in allen Inhalten korrekt setzen (Goerlitz -> Goerlitz
   mit oe nur als Platzhalter; final: richtige Schreibweise mit ae/oe/ue/ss
   ersetzen durch echte Umlaute).
3. **PocketBase produktiv** hosten (lokal erledigt + getestet): Instanz auf dem
   Server, `PB_URL` setzen, je Verein eine eigene Instanz. Backups einrichten.
4. **PDF-Dokumente** (Satzung, Beitragsordnung, Konzepte) hinterlegen.
5. **Datenschutzerklaerung** juristisch pruefen lassen (Hosting, Logs,
   Mitgliederbereich, AVV).
6. **Zweite/dritte Vereinsseite** via neue Config anlegen.
