# Ausgabe- & Compliance-Modul (KCanG)

Bucht die Abgabe an Mitglieder am Tresen mit **automatischer gesetzlicher
Prüfung**. Ersetzt die bisherige Excel-Führung der Ausgabe. Die Geld-Kasse
(JTL POS) bleibt separat und kassiert den Beitrag; dieses Modul dokumentiert die
**Menge** und druckt den Beleg/Beipackzettel.

## Gesetzliche Grenzen (in `src/lib/ausgabe.ts`, zentral)
- **25 g / Tag** und **50 g / Monat** je Mitglied.
- **Unter 21 Jahre:** **30 g / Monat** und nur Sorten mit **höchstens 10 % THC**.
- Beitrag: **8,50 €/g** (`BEITRAG_PRO_GRAMM`).
- Fehlt das Geburtsdatum → Mitglied wird **sicherheitshalber als U21** behandelt
  (strengste Grenzen) und im Tresen rot markiert.
- Tag/Monat werden **Berlin-lokal** bestimmt (kein Zeitzonen-Verrutschen).

> Grenzwerte vor dem Live-Betrieb mit der Rechtsberatung gegenprüfen. Die Logik
> liegt gebündelt in einer Datei und ist damit leicht anzupassen.

## Rollen (Feld `rolle` auf `users`)
- `mitglied` (Standard) – sieht nur die eigenen Abgaben.
- `vorstand` / `ausgabe` – dürfen am Tresen buchen und sehen alle Abgaben.

## Datenmodell (PocketBase)
- **`users`** erweitert um `geburtsdatum`, `mitgliedsnummer`, `rolle`.
- **`sorten`** – Stammdaten mit **numerischem** `thc_prozent` (für die U21-Prüfung),
  `cbd_prozent`, `charge`, `bestand_gramm`, `aktiv`. Pflege im CMS.
- **`ausgaben`** – append-only Abgabe-Protokoll (kein Ändern/Löschen über die API,
  Revisionssicherheit). Snapshots von Sorte/THC/Mitgliedsnummer für den Beleg.

## Ablauf am Tresen (`/mitglieder/ausgabe`)
1. Mitglied wählen → Statuskarte zeigt Alter/U21, heute X/25 g, Monat Y/Limit,
   Restmengen.
2. Sorte + Menge → **Abgabe buchen**. Der Endpoint `ausgabe/buchen.ts` prüft
   serverseitig alle Grenzen, legt den Datensatz an, schreibt den Bestand fort.
3. Weiterleitung auf den **Beleg** (`/mitglieder/ausgabe/beleg/<id>`) mit
   Druckknopf – enthält alle KCanG-Pflichtangaben (Sorte, Charge, Menge, THC/CBD,
   Datum, Beitrag, Weitergabe-/Jugendschutz-/Präventionshinweis). Druckt über den
   OS-Druckdialog auf jeden angebundenen Etikettendrucker.

## Einrichten
```bash
# .env mit PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PW (wie beim bestehenden seed)
node --env-file=.env scripts/seed-ausgabe.mjs
```
Legt die Felder/Collections idempotent an, setzt Sichtbarkeitsregeln und spielt
Demo-Sorten (eine ≤10 % THC, zwei darüber) + Demo-Rollen ein.
Demo-Tresen-Login: `PB_STAFF_EMAIL` / `PB_STAFF_PW`.

## Noch offen (bewusst nicht im MVP)
- **Echte Daten**: Mitglieder inkl. Geburtsdatum importieren, Sorten mit echten
  THC-Werten + Chargen pflegen.
- **Direkter Etikettendruck** an den SUPVAN/Katasymbol T50M Pro (Consumer-BT-Gerät,
  kein offener Befehlssatz) – aktuell über OS-Druckdialog. Für Automatik ggf.
  ZPL/TSPL-Drucker.
- **Rückwärts**: Anbau → Ernte → Bestand → Vernichtung, sowie **Jahresmeldung**.
- **JTL-Kasse**: bisher lose gekoppelt (Beitrag separat); optionaler Abgleich später.
- Verifikation gegen eine laufende PocketBase-Instanz (Build kompiliert; End-to-End
  mit echter DB steht noch aus).
