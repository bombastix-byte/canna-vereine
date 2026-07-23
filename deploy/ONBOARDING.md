# Neuen Verein anlegen (Multi-Mandanten-Onboarding)

Jeder Verein läuft als eigener Satz Container (ein Astro- + ein PocketBase-Container)
mit eigener Domain und eigener Datenbank. Das folgende Vorgehen ist geskriptet,
wo es sicher geht, und von Hand, wo Server-Dateien betroffen sind.

## 1. Code-Seite scaffolden (lokal)

```bash
node scripts/neuer-verein.mjs \
  --slug=zittau \
  --name="Cannabis-Verein Zittau e. V." \
  --kurzname="Cannabis-Verein Zittau" \
  --kuerzel=CVZ \
  --stadt=Zittau --plz=02763 \
  --domain=zittau.example.de \
  --email=kontakt@zittau.example.de \
  [--theme=nacht|klar] [--oeffentlich]
```

Das erzeugt `src/config/<slug>.ts`, registriert die Site in `src/config/index.ts`
und gibt die Bausteine für Compose, Caddy und `.env` samt Checkliste aus.

Danach die `TODO`-Felder in `src/config/<slug>.ts` mit echten Vereinsdaten füllen
(Registereintrag, Anschrift, Vorstand, Präventionsbeauftragte, Erlaubnis-Az.).

Ohne `--oeffentlich` startet der Verein rein intern (nur Login/Impressum/Datenschutz
erreichbar) — das entspricht dem Konzept „kein öffentlicher Web-Auftritt".

## 2. Infrastruktur nachziehen (Server)

Die vom Skript ausgegebenen Bausteine einarbeiten:

- **`deploy/docker-compose.yml`**: die beiden Dienste `astro-<slug>` / `pb-<slug>`
  vor dem `volumes:`-Block einfügen und dort `pb_<slug>:` ergänzen. Diese Datei
  wird per Deploy synchronisiert.
- **`deploy/.env` auf dem Server**: `DOMAIN_<SLUG>=<domain>` ergänzen.
- **`deploy/sites/cvms.caddy`**: den Domain-Block versioniert ergänzen. Der
  gemeinsame `deploy/Caddyfile` importiert alle `sites/*.caddy`-Snippets;
  weitere VPS-Zellen erhalten eigene Snippets statt manuell angehängter Blöcke.
- **DNS**: A-/AAAA-Record der Domain auf den VPS zeigen lassen (für Auto-HTTPS).

## 3. Container bauen & starten (Server)

```bash
cd /opt/canna-vereine/deploy
docker compose up -d --build astro-<slug> pb-<slug>
# Caddy nach Caddyfile-Änderung neu erstellen (Bind-Mount/inode):
docker compose up -d --force-recreate caddy
```

## 4. Datenbank einrichten (Struktur-Seeds)

Superuser der neuen PB anlegen (temporär, danach löschen):

```bash
docker exec deploy-pb-<slug>-1 /pb/pocketbase superuser upsert \
  admin@onboarding.local 'EinStarkesTempPasswort' --dir /pb/pb_data
```

Struktur-Seeds gegen die neue PB laufen lassen (idempotent, Reihenfolge egal für
Wiederholung):

```bash
PB_URL=https://<domain> \
PB_ADMIN_EMAIL=admin@onboarding.local \
PB_ADMIN_PW='EinStarkesTempPasswort' \
node scripts/seed-struktur.mjs
```

Einige Basis-Seeds legen wenige Muster-/Referenzdatensätze an (z. B. eine
Beispiel-Charge). Für einen echten Verein im Admin (`/_/`) prüfen und ggf. löschen.

## 5. Automatik / Push (optional, empfohlen)

- **Push**: `VAPID_PUBLIC` / `VAPID_PRIVATE` / `VAPID_SUBJECT` in `deploy/.env`
  setzen (ein Keypaar reicht für alle Vereine):
  `node -e "console.log(require('web-push').generateVAPIDKeys())"`.
- **Erinnerungs-Automatik**: pro Verein ein System-Konto + Cron-Hook.
  - `CRON_TOKEN`, `SYSTEM_EMAIL`, `SYSTEM_PW` in `deploy/.env` ergänzen.
  - System-Konto anlegen:
    ```bash
    PB_URL=https://<domain> PB_ADMIN_EMAIL=… PB_ADMIN_PW=… \
    SYSTEM_EMAIL=… SYSTEM_PW=… node scripts/seed-system-konto.mjs
    ```
  - In `deploy/docker-compose.yml` beim `pb-<slug>`-Dienst analog zu `pb-goerlitz`
    `environment: CRON_TOKEN: ${CRON_TOKEN}` und den `./pb_hooks:/pb/pb_hooks:ro`-Mount
    ergänzen. Der Hook `pb_hooks/erinnerungen.pb.js` ruft
    `http://astro-<slug>:4321/api/erinnerungen` — die URL im Hook je Verein anpassen
    (oder den Vereins-Slug aus einer Env lesen).

## 5b. Backups (vor echten Daten Pflicht)

PocketBase sichert sich selbst konsistent (SQLite-sicher). Aktivieren:

```bash
PB_URL=https://<domain> PB_ADMIN_EMAIL=… PB_ADMIN_PW=… \
node scripts/backup-einrichten.mjs --jetzt   # täglich 03:00, 7 Stände + Test
```

Damit die Sicherungen einen Verlust des Datenbank-Volumes überleben, wird das
Backup-Verzeichnis auf den Host gemountet. In `docker-compose.yml` beim
`pb-<slug>`-Dienst analog zu Görlitz ergänzen und den Host-Ordner anlegen:

```yaml
    volumes:
      - ./backups/<slug>:/pb/pb_data/backups
```
```bash
mkdir -p /opt/canna-vereine/deploy/backups/<slug>
docker compose up -d pb-<slug>
```

Die Backups liegen dann unter `/opt/canna-vereine/deploy/backups/<slug>/`.

Nach dem ersten Backup und danach regelmaessig einen echten Restore in ein
temporaeres Docker-Volume pruefen:

```bash
./restore-verify.sh
```
**Off-site empfohlen:** dieses Verzeichnis zusätzlich weg vom Server sichern
(z. B. `rsync`/`borg` auf externen Speicher oder S3 in den PocketBase-
Backup-Einstellungen hinterlegen).

## 6. Erste Personen

- Vorstands-Superuser für die App: ein `users`-Konto mit Rolle `vorstand` anlegen
  (über den Admin oder ein kurzes Skript). Ab dann läuft alles über die Weboberfläche.
- Temporären PB-Superuser aus Schritt 4 wieder löschen:
  ```bash
  docker exec deploy-pb-<slug>-1 /pb/pocketbase superuser delete \
    admin@onboarding.local --dir /pb/pb_data
  ```

## Checkliste

- [ ] `neuer-verein.mjs` gelaufen, Config-TODOs gefüllt
- [ ] Compose-Dienste + Volume ergänzt
- [ ] `.env`: `DOMAIN_<SLUG>` (+ ggf. Automatik-Vars)
- [ ] Caddy-Block ergänzt, Caddy neu erstellt
- [ ] DNS zeigt auf den VPS
- [ ] `docker compose up -d --build` für den neuen Verein
- [ ] Struktur-Seeds gelaufen, Musterdaten geprüft
- [ ] Vorstands-Konto angelegt, Temp-Superuser gelöscht
- [ ] (optional) Push + Erinnerungs-Automatik eingerichtet
