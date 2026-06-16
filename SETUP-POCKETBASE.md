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
