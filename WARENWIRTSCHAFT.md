# Warenwirtschaft (Samen → Ausgabe)

Lückenlose, KCanG-taugliche Verfolgung vom Anbaulos bis zur Abgabe. Kern ist die
**Charge**: ein Anbaulos einer Sorte, das seinen Lebenszyklus durchläuft. Jede
Abgabe am Tresen bucht auf eine konkrete Charge → **volle Rückverfolgbarkeit**
und batch-genaue THC-Werte für die U21-Prüfung.

## Lebenszyklus einer Charge
```
anbau ──Ernte──▶ geerntet ──Freigabe──▶ freigegeben ──Abgaben──▶ aufgebraucht
  │  (Frischgewicht)   │ (Trockengewicht,      │  (verfügbar_g sinkt)
  │                    │  THC/CBD, = Bestand)   │
  └────────── sperren / vernichten (jederzeit dokumentiert) ──────────┘
```
- **Anbau**: Sorte, Herkunft (Samen/Stecklinge), Pflanzenzahl, Standort, Beginn.
- **Ernte**: Frischgewicht + Datum → Status `geerntet`.
- **Freigabe**: Trockengewicht (= verfügbarer Bestand), gemessene THC/CBD-Werte →
  Status `freigegeben`. Erst jetzt am Tresen abgebbar. Der **Schwund**
  (frisch→trocken) wird angezeigt.
- **Abgabe** (Tresen): verringert `verfuegbar_g` der Charge; bei 0 → `aufgebraucht`.
- **Vernichtung**: dokumentiert (Menge, Grund, Zeuge, Datum, ausführende Person);
  bei freigegebener Charge wird der Bestand fortgeschrieben.

## Datenmodell (PocketBase)
- **chargen** – die Anbaulose (Status, Gewichte, THC/CBD, verfügbar, Herkunft…).
  Regeln: lesen = Personal (anbau/ausgabe/vorstand); anlegen/pflegen = anbau/vorstand.
- **vernichtungen** – append-only Vernichtungsprotokoll (kein Ändern/Löschen).
- **ausgaben** – um `charge_ref` erweitert → Abgabe ist bis zum Anbaulos verkettet.
- **sorten** – Stammdaten (Katalog). Bestand liegt jetzt an der **Charge**, nicht mehr an der Sorte.

## Bedienung
`/mitglieder/wawi` (Rolle **anbau** oder **vorstand**): Bestandsübersicht je Sorte,
neue Charge anlegen, je Charge die passenden Aktionen (Ernte/Freigabe/Sperren/
Vernichten), Vernichtungs-Protokoll. Freigegebene Chargen erscheinen automatisch
am Tresen (`/mitglieder/ausgabe`).

## Einrichten
```bash
node --env-file=.env scripts/seed-wawi.mjs
```
Migriert `rolle`→`rollen`, legt `chargen`+`vernichtungen` an, erweitert `ausgaben`
um `charge_ref`, stellt alle Regeln auf das Rollenmodell um und spielt Demo-Chargen
(3 freigegeben, 1 geerntet, 1 im Anbau) + einen Anbau-Nutzer ein. Idempotent.

## Tests
- `node scripts/test-ausgabe.mjs` – Limit-Logik (29 Fälle).
- `node --env-file=.env scripts/test-wawi-http.mjs` – Lebenszyklus anlegen→Ernte→Freigabe→Vernichtung.
- `node --env-file=.env scripts/test-tresen-http.mjs` – Abgabe auf Charge + Limits.
(HTTP-Tests brauchen laufende PocketBase + `npm run dev`.)

## Inzwischen ergänzt (siehe SYSTEM-UEBERSICHT.md)
- **Jahresmeldung** `/mitglieder/jahresmeldung` (Aggregat angebaut/abgegeben/vernichtet/Mitgliederzahl).
- **Vermehrungsmaterial** `/mitglieder/vermehrung` (Samen/Stecklinge, 7/5 pro Monat).
- **Mitglieder-/Rollenverwaltung** `/mitglieder/verwaltung` + CSV-Import `scripts/import-mitglieder.mjs`.
- **ZPL-Etikettendruck** an Netzwerkdrucker (Port 9100), Datei-Fallback ohne Drucker.

## Noch offen
- Echte Mitglieder-/Sortendaten importieren.
- Grenzwerte/Dokumentationspflichten mit Rechtsberatung gegenprüfen.
- Physischer Etikettendrucker-Test (Logik/ZPL getestet, Hardware steht aus).
