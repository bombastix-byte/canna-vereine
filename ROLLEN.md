# Rollen & Stellenbeschreibung ("wer darf was")

Rollen liegen als **Mehrfach-Auswahl** (`rollen`) auf jedem Mitglied (users).
Eine Person kann mehrere Rollen tragen; **Vorstand** hat implizit alle operativen
Rechte. Technisch durchgesetzt über `src/lib/rollen.ts` (App) und die
Collection-Regeln in PocketBase (Server).

## Rollen

| Rolle | Aufgabe | Rechtliche Grundlage |
|---|---|---|
| **mitglied** | Normales Mitglied: Mitgliederbereich, eigene Abgaben/Vorbestellungen. | — |
| **ausgabe** | Ausgabekraft am Tresen: bucht Abgaben, Limit-Prüfung läuft automatisch. | interne Organisation |
| **anbau** | Anbau-/Ernteverantwortliche: führt die Warenwirtschaft (Chargen, Ernte, Trocknung, Freigabe, Vernichtung). | interne Organisation |
| **praevention** | Präventionsbeauftragte Person: Einsicht, Ansprechperson Jugend-/Gesundheitsschutz. | **§ 23 KCanG** (vorgeschrieben) |
| **vorstand** | Vertretungsberechtigter Vorstand: Vollzugriff, Mitglieder-/Rollenverwaltung, Berichte, Jahresmeldung. | **§ 26 BGB** (vorgeschrieben) |

## Rechte-Matrix

| Bereich | mitglied | ausgabe | anbau | praevention | vorstand |
|---|:--:|:--:|:--:|:--:|:--:|
| Mitgliederbereich (eigenes) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tresen: Abgabe buchen | — | ✅ | — | — | ✅ |
| Alle Abgaben einsehen | — | ✅ | — | (✅)¹ | ✅ |
| Warenwirtschaft: Chargen anlegen/pflegen | — | — | ✅ | — | ✅ |
| Ernte / Freigabe / Sperren | — | — | ✅ | — | ✅ |
| Vernichtung dokumentieren | — | — | ✅ | — | ✅ |
| Bestand (Charge) fortschreiben | — | ✅² | ✅ | — | ✅ |
| Mitglieder-/Rollenverwaltung | — | — | — | — | ✅ |
| Sorten-Stammdaten | — | — | ✅ | — | ✅ |

¹ Einsicht der Präventionsperson ist über die Rolle erweiterbar; aktuell nicht schreibend.
² Nur technisch, weil die Abgabe den Charge-Bestand automatisch verringert.

## Vergabe der Rollen
Rollen setzt der Vorstand im PocketBase-CMS (users → Feld `rollen`) oder – noch zu
bauen – über eine Mitglieder-/Rollenverwaltung im Mitgliederbereich. Beim
Import bestehender Mitglieder wird das alte Einzelfeld `rolle` automatisch nach
`rollen` migriert (`scripts/seed-wawi.mjs`).

## Demo-Zugänge (Test)
- Vorstand/Tresen: `ausgabe@example.local` / `change-me-staff`
- Anbau: `anbau@example.local` / `change-me-anbau`
- Mitglieder: `anna@dummy.local` … `hugo@dummy.local` / `DummyDemo2026!`
