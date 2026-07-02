# Netcup: Server bestellen und canna-vereine live bringen

Konkreter Copy-Paste-Ablauf fuer Netcup als Hoster. Deckt die Netcup-spezifischen
Schritte (Server bestellen, absichern, Docker installieren) ab. Danach uebernimmt
die allgemeine Anleitung `DEPLOY-PRODUCTION.md` (DNS, Code, Start, PocketBase,
Backups). Reihenfolge: erst dieses Dokument (0 bis 3), dann `DEPLOY-PRODUCTION.md`
ab Schritt 1 (DNS).

## 0. Server bestellen (einmalig)

- Bei Netcup einen **VPS** waehlen. Richtwert fuer alle drei Vereine zusammen:
  mindestens 2 vCPU / 4 GB RAM / 40 GB SSD (z. B. die kleineren VPS-Tarife
  reichen klar aus). Standort **Nuernberg (DE)** -> DSGVO.
- Betriebssystem-Image: **Ubuntu 24.04 LTS** (oder 22.04 LTS).
- Beim Bestellen einen **SSH-Public-Key** hinterlegen, falls vorhanden. Sonst
  setzt Netcup ein root-Passwort, das du beim ersten Login aenderst.
- Nach der Bereitstellung im Netcup-SCP (Server Control Panel) die **IPv4** (und
  optional IPv6) des Servers notieren. Die brauchst du fuer die DNS-A-Records.

## 1. Erstzugang und absichern

Vom eigenen Rechner einloggen (IP einsetzen):

```bash
ssh root@<Server-IP>
```

Grundabsicherung auf dem Server:

```bash
# System aktuell
apt update && apt upgrade -y

# Nicht-root-Benutzer mit sudo (Name frei waehlbar)
adduser deploy
usermod -aG sudo deploy

# Firewall: nur SSH und Web zulassen
apt install -y ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

Danach am besten als `deploy` weiterarbeiten (`ssh deploy@<Server-IP>`) und
fuer alle folgenden Befehle `sudo` voranstellen, wo noetig.

## 2. Docker installieren

```bash
# Offizielles Docker-Installationsskript
curl -fsSL https://get.docker.com | sudo sh

# Den eigenen Benutzer ohne sudo docker nutzen lassen
sudo usermod -aG docker $USER
# danach einmal aus- und wieder einloggen, damit die Gruppe greift

# Pruefen
docker --version
docker compose version
```

## 3. Weiter mit der allgemeinen Anleitung

Ab hier ist nichts mehr Netcup-spezifisch. Folge `DEPLOY-PRODUCTION.md`:

1. **DNS** je Verein einen A-Record auf die Netcup-IP (Schritt 1 dort). Die
   A-Records setzt du beim Domain-Registrar, nicht zwingend bei Netcup.
2. **Code holen** und `.env` mit echten Domains + ACME_EMAIL fuellen (Schritt 2).
3. **`docker compose up -d --build`** (Schritt 3). Caddy holt automatisch HTTPS,
   sobald die DNS-Eintraege auf den Server zeigen.
4. **PocketBase** je Verein einrichten (Schritt 4).
5. **Backups** aktivieren, `backup.sh` per Cron (Schritt 5).

## Hinweise speziell zu Netcup

- Netcup bietet im SCP eigene **Snapshots/Images**. Vor dem ersten Go-Live einen
  Snapshot des frisch eingerichteten Servers ziehen, dann hast du einen sauberen
  Wiederherstellungspunkt.
- DNS und Domains koennen, muessen aber nicht bei Netcup liegen. Wichtig ist nur,
  dass die A-Records der Vereinsdomains auf die Server-IP zeigen.
- Ports 80/443 muessen offen sein (oben per ufw erledigt), sonst schlaegt die
  automatische HTTPS-Ausstellung durch Caddy fehl.
