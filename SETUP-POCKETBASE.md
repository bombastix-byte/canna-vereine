# PocketBase einrichten

PocketBase ist Auth-Backend und Inhalts-CMS in einem. Der Vorstand pflegt darin
Mitteilungen, Termine und Dokumente selbst und verwaltet die Mitgliederzugaenge.

## 1. PocketBase starten

PocketBase ist eine einzelne ausfuehrbare Datei (Bezug: offizielle Releases auf
github.com/pocketbase/pocketbase). Datei nach `pb/` legen und starten:

```bash
# im Projektordner
./pb/pocketbase serve            # Linux/macOS
pb\pocketbase.exe serve          # Windows
```

Der Server laeuft dann auf `http://127.0.0.1:8090`. Admin-Oberflaeche unter
`http://127.0.0.1:8090/_/`. Beim ersten Start ein Admin-Konto anlegen.

Die Datenbank liegt in `pb_data/` (per .gitignore vom Repo ausgenommen).

## 2. Collections anlegen

Im Admin (`/_/`) drei Collections vom Typ **Base** erstellen. Bei allen drei die
Zugriffsregeln so setzen, dass nur angemeldete Mitglieder lesen duerfen und nur
Admins schreiben:

- **List rule** und **View rule**: `@request.auth.id != ""`
- **Create / Update / Delete rule**: leer lassen (= nur Admin)

### mitteilungen

| Feld   | Typ            | Pflicht |
| ------ | -------------- | ------- |
| titel  | text           | ja      |
| inhalt | text (editor)  | ja      |
| datum  | date           | ja      |

### termine

| Feld         | Typ           | Pflicht |
| ------------ | ------------- | ------- |
| titel        | text          | ja      |
| datum        | date          | ja      |
| ort          | text          | nein    |
| beschreibung | text (editor) | nein    |

### dokumente

| Feld     | Typ            | Pflicht |
| -------- | -------------- | ------- |
| titel    | text           | ja      |
| kategorie| text           | nein    |
| datei    | file (einzeln) | ja      |

### wochenangebot

Sachliche Info zur aktuellen Abgabe an Mitglieder (kein oeffentliches Marketing,
KCanG Paragraf 6). Nur Mitglieder lesen, nur Admin schreibt.

| Feld        | Typ           | Pflicht |
| ----------- | ------------- | ------- |
| titel       | text          | ja      |
| inhalt      | text (editor) | ja      |
| gueltig_von | date          | nein    |
| gueltig_bis | date          | nein    |

### sortenberichte

Sachliche Beschreibungen der angebauten Sorten. Nur Mitglieder lesen, nur Admin
schreibt.

| Feld   | Typ           | Pflicht |
| ------ | ------------- | ------- |
| titel  | text          | ja      |
| sorte  | text          | nein    |
| inhalt | text (editor) | ja      |
| datum  | date          | ja      |

### vorbestellungen

Reservierung zur spaeteren Abholung. Hier duerfen **Mitglieder selbst Datensaetze
anlegen**, aber nur die eigenen sehen; Aendern/Loeschen (Status pflegen) bleibt
dem Vorstand vorbehalten.

- **List rule** und **View rule**: `@request.auth.id != "" && mitglied = @request.auth.id`
- **Create rule**: `@request.auth.id != ""` (das Formular setzt `mitglied` und
  `status` serverseitig fest)
- **Update / Delete rule**: leer (= nur Admin)

| Feld        | Typ                                                  | Pflicht |
| ----------- | ---------------------------------------------------- | ------- |
| mitglied    | relation -> users (maxSelect 1)                      | ja      |
| sorte       | text                                                 | ja      |
| menge_gramm | number                                               | ja      |
| abholdatum  | date                                                 | nein    |
| hinweis     | text                                                 | nein    |
| status      | select (offen, bestaetigt, abgeholt, storniert)      | nein    |
| created     | autodate (onCreate)                                  | ja      |
| updated     | autodate (onCreate + onUpdate)                       | ja      |

> Hinweis: Seit PocketBase 0.23 gibt es keine automatischen `created`/`updated`-
> Felder mehr. Sie muessen als **autodate**-Felder explizit angelegt werden, sonst
> schlaegt ein Sortieren nach `-created` fehl.

Am einfachsten legt `scripts/seed.mjs` alle Collections (inkl. der hier genannten)
idempotent an und spielt Demo-Inhalte ein.

## 3. Mitglieder anlegen

Die eingebaute Collection **users** ist das Mitgliederverzeichnis. Pro Mitglied
ein Datensatz mit E-Mail und Passwort (Feld `name` optional). Es gibt bewusst
keine oeffentliche Selbstregistrierung: Zugaenge legt der Vorstand an.

Tipp: In den Optionen der users-Collection die offene Registrierung deaktiviert
lassen und ggf. E-Mail-Bestaetigung nach Bedarf konfigurieren.

## 4. Verbindung der Website

Die Website liest die Server-Adresse aus `PB_URL` (siehe `.env.example`).
Lokal ist nichts weiter noetig. In Produktion `PB_URL` auf die interne Adresse
des PocketBase-Servers setzen.

## Mehrere Vereine

Sauberste Trennung: je Verein eine eigene PocketBase-Instanz (eigene Daten,
eigene Mitglieder). Die jeweilige Website zeigt ueber `PB_URL` auf ihre Instanz.
