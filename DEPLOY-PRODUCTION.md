# Produktiv hosten (eigene Domains, eigener Server)

Anbieter-neutral: laeuft auf jedem Linux-Server mit Docker (Hetzner, Netcup,
IONOS, o. ae.). Caddy holt automatisch HTTPS-Zertifikate. Pro Verein eine
Domain, ein Astro-Server und eine eigene PocketBase-Instanz.

Alle Dateien dafuer liegen im Ordner `deploy/`.

## Architektur

- **Caddy** (Reverse-Proxy, Port 80/443): automatisches HTTPS, Routing je Domain.
- Je Verein **ein Astro-Server** (oeffentliche Seiten + Mitgliederbereich).
- Je Verein **eine PocketBase-Instanz** (Auth + CMS, getrennte Daten).
- Erreichbar unter der jeweiligen Vereinsdomain. PocketBase liegt unter
  `/_/` (Admin) und `/api/` (inkl. Datei-Downloads) derselben Domain, daher
  genuegt je Verein ein einziger DNS-Eintrag, keine Subdomains noetig.

## Voraussetzungen

- Ein Linux-Server (z. B. Ubuntu 22.04+), Richtwert 2 vCPU / 4 GB RAM, reicht
  fuer alle drei Vereine zusammen. Standort EU/Deutschland (DSGVO).
- Docker und Docker Compose installiert.
- Pro Verein eine registrierte Domain (Registrar frei waehlbar).

## Schritt fuer Schritt

### 1. DNS setzen (bei jedem Registrar gleich)

Pro Verein einen **A-Record** auf die IPv4 des Servers (und optional AAAA auf
die IPv6). Keine Subdomains noetig. Beispiel:

```
goerlitz.example.de      A     <Server-IP>
csc-goerlitz.example.de  A     <Server-IP>
leipzig.example.de       A     <Server-IP>
```

### 2. Code auf den Server

```bash
git clone https://github.com/bombastix-byte/canna-vereine.git
cd canna-vereine/deploy
cp .env.example .env
# .env oeffnen und echte Domains + ACME_EMAIL eintragen
```

### 3. Starten

```bash
docker compose up -d --build
```

Caddy beantragt automatisch die HTTPS-Zertifikate, sobald die DNS-Eintraege auf
den Server zeigen. Das kann beim ersten Mal ein paar Minuten dauern.

### 4. PocketBase je Verein einrichten

Pro Verein einmalig:

1. `https://<vereinsdomain>/_/` aufrufen und einen Admin (Superuser) anlegen.
2. Die drei Collections `mitteilungen`, `termine`, `dokumente` anlegen
   (Felder und Zugriffsregeln siehe `SETUP-POCKETBASE.md`).
3. Mitgliederzugaenge in der Collection `users` anlegen (kein oeffentliches
   Registrieren). Optional die geplanten Backups in den Einstellungen aktivieren.

Danach ist der Mitgliederbereich unter `https://<vereinsdomain>/mitglieder`
nutzbar.

> Hinweis: `scripts/seed.mjs` ist ein Demo-Werkzeug (legt Testdaten an) und
> nicht fuer den Produktivbetrieb gedacht.

### 5. Backups

- In jeder PocketBase unter Einstellungen die geplanten Backups aktivieren.
- Zusaetzlich offsite sichern mit `deploy/backup.sh` per Cron:

```bash
0 3 * * * /pfad/zu/canna-vereine/deploy/backup.sh >> /var/log/canna-backup.log 2>&1
```

### 6. Aktualisieren

```bash
cd canna-vereine && git pull
cd deploy && docker compose up -d --build
```

## Inhalte und Design

- Echte Vereinsdaten in `src/config/<verein>.ts` eintragen, dann neu bauen
  (Schritt 6). Theme je Verein ueber das Feld `theme`.
- Eine weitere Vereinsseite: neue Config plus je ein `astro-`/`pb-`Dienst und
  ein Domain-Block in `Caddyfile` und `docker-compose.yml`.

## Kostenrahmen (Richtwert 2026)

- Server fuer alle drei Vereine: ca. 4 bis 6 Euro/Monat.
- PocketBase: kostenlos (Open Source).
- Domains: ca. 10 bis 15 Euro pro Domain und Jahr.
- Summe grob 110 bis 140 Euro/Jahr fuer alle drei zusammen.
