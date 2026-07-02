# Vereinssystem – Übersicht (Samen → Ausgabe + Verwaltung)

Selbstgehostetes System für die Anbauvereinigung auf dem bestehenden
Astro-5 + PocketBase-Stack. Deckt die vollständige KCanG-Kette ab.

## Bereiche im Mitgliederbereich (`/mitglieder/*`)
| Seite | Rolle | Zweck |
|---|---|---|
| `bereich` | alle | Dashboard |
| `wawi` | anbau, vorstand | Warenwirtschaft: Chargen Anbau→Ernte→Freigabe→Vernichtung |
| `ausgabe` | ausgabe, vorstand | Tresen: Abgabe buchen (Limits 25/50 g, U21 30 g/≤10 % THC), bucht auf Charge |
| `ausgabe/beleg/[id]` | ausgabe / eigenes | Beleg/Beipackzettel: OS-Druck + ZPL an Etikettendrucker |
| `vermehrung` | ausgabe, vorstand | Samen/Stecklinge (7/5 pro Monat) |
| `jahresmeldung` | vorstand, praevention | Aggregat für die Behördenmeldung |
| `verwaltung` | vorstand | Mitglieder & Rollen pflegen |

## Rollen
`mitglied · ausgabe · anbau · praevention · vorstand` (Mehrfach; Vorstand = Vollzugriff).
Details + Rechte-Matrix: **ROLLEN.md**. Logik: `src/lib/rollen.ts`.

## Logik-Bausteine (rein, getestet)
- `src/lib/ausgabe.ts` – Abgabe-Grenzen (Tag/Monat/U21/THC/Bestand), Beitrag, Berlin-Datum.
- `src/lib/wawi.ts` – Charge-Lebenszyklus, Schwund, Chargennummer.
- `src/lib/vermehrung.ts` – Samen/Stecklinge-Grenzen.
- `src/lib/jahresmeldung.ts` – Jahres-Aggregat.
- `src/lib/zpl.ts` – ZPL-Etikett.

## PocketBase-Collections
`users` (+ rollen/mitgliedsnummer/geburtsdatum) · `sorten` · `chargen` ·
`ausgaben` (append-only, mit `charge_ref`) · `vernichtungen` (append-only) ·
`vermehrung_ausgaben` · dazu die bestehenden (mitteilungen, termine, …).

## Einrichten (idempotent, in dieser Reihenfolge)
```bash
node --env-file=.env scripts/seed.mjs            # Basis
node --env-file=.env scripts/seed-ausgabe.mjs    # Sorten, Abgabe, Rollen (rolle)
node --env-file=.env scripts/seed-wawi.mjs       # rollen-Migration, Chargen, Vernichtung
node --env-file=.env scripts/seed-erweiterung.mjs# Vermehrung, Vorstand-Schreibrecht
node --env-file=.env scripts/seed-dummies.mjs    # optionale Testmitglieder
node --env-file=.env scripts/import-mitglieder.mjs data/mitglieder.csv  # echte Mitglieder
```
Server lokal: `pb\pocketbase.exe serve --http=127.0.0.1:8090 --dir pb\pb_data` + `npm run dev`.
Etikettendrucker: `PRINTER_HOST`/`PRINTER_PORT` (Standard 9100) in `.env` setzen; ohne Konfiguration liefert der Druck-Endpoint die ZPL-Datei zum manuellen Senden.

## Tests
```bash
node scripts/test-ausgabe.mjs            # Limit-Logik (29)
node scripts/test-erweiterung.mjs        # Jahresmeldung/Vermehrung/ZPL (19)
node --env-file=.env scripts/test-wawi-http.mjs        # Warenwirtschaft E2E (8)
node --env-file=.env scripts/test-tresen-http.mjs      # Tresen E2E (5)
node --env-file=.env scripts/test-erweiterung-http.mjs # Verwaltung/Vermehrung/Meldung/ZPL E2E (9)
```
(HTTP-Tests brauchen laufende PocketBase + `npm run dev`.)

## Demo-Logins
- Vorstand/Tresen: `ausgabe@example.local` / `change-me-staff`
- Anbau: `anbau@example.local` / `change-me-anbau`
- Mitglieder: `anna@dummy.local` … `hugo@dummy.local` / `DummyDemo2026!`

## Weitere Doku
- **ROLLEN.md** – Stellenbeschreibung + Rechte-Matrix
- **WARENWIRTSCHAFT.md** – Charge-Lebenszyklus im Detail
- **AUSGABE-MODUL.md** – Tresen/Abgabe im Detail
