# Vereins-App (Android, ohne App-Store)

Die App ist eine dünne Hülle (Capacitor) um die Live-Website: Sie lädt die
Server-App direkt, dadurch kommen praktisch alle Updates weiterhin per
normalem Server-Deploy. Eine neue APK braucht es nur, wenn sich die Hülle
selbst ändert (Icon, Berechtigungen, Plugins).

Bewusste Entscheidung gegen die App-Stores: Google Play und Apple App Store
lassen Apps, die die Cannabis-Abgabe unterstützen, praktisch nicht zu - und
die Nutzer sind ohnehin nur Vereinsmitglieder. Verteilung daher:

- **Android**: signierte APK zum direkten Download im Mitgliederbereich
  (`/mitglieder/app`, Datei nur für angemeldete Mitglieder).
- **iPhone/iPad**: die installierbare Website (PWA) - "Zum Home-Bildschirm".

## Aufbau

- `app/` - Capacitor-Projekt. `capacitor.config.ts` liest `APP_URL`
  (Standard: goerlitz-Domain); `app/android/` ist das generierte
  Android-Projekt (eingecheckt, Paket `de.cannaverein.goerlitz`).
- Kamera-Berechtigung in der AndroidManifest.xml: der QR-Scan am Tresen
  (Seite Ausgabe, Knopf "QR mit Kamera scannen") nutzt getUserMedia +
  BarcodeDetector im WebView. Auf Geräten ohne BarcodeDetector (z. B.
  iOS-Safari) bleibt der Knopf verborgen; Tippen/USB-Scanner gehen immer.

## APK bauen (GitHub Actions, kein lokales Android-SDK nötig)

Workflow **"Android-APK bauen"** (`.github/workflows/android-apk.yml`):
manuell starten (workflow_dispatch) oder Tag `app-v*` pushen. Ergebnis:
Artifact `canna-verein-apk`.

Signatur-Secrets im Repo (einmalig einrichten, Keystore gut aufbewahren -
Updates MÜSSEN mit demselben Keystore signiert sein):

- `ANDROID_KEYSTORE_BASE64` - base64 des Keystores (Erzeugung: siehe
  Kommentar im Workflow)
- `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`

Ohne Secrets baut der Workflow eine nur debug-signierte APK (nur zum Testen).

## APK veröffentlichen

Artifact herunterladen und als `deploy/downloads/canna-verein.apk` auf den
Server legen (Ordner ist per Volume ins astro-goerlitz-Containerdateisystem
eingebunden, Pfad `/downloads`):

    scp canna-verein.apk deploy@89.58.9.0:/opt/canna-vereine/deploy/downloads/

Kein Neustart nötig - die Seite `/mitglieder/app` zeigt den Download-Knopf,
sobald die Datei da ist. Lokale `.apk`-Dateien in `deploy/downloads/` sind
gitignored (nie einchecken - der Deploy-Tarball würde sie sonst mitnehmen).

## Weitere Vereine

Paketname und App-Name stecken im Android-Projekt (`app/android`). Für
csc/leipzig später eigene Build-Flavors (oder je Verein ein eigenes
`cap add android`) anlegen; die `APP_URL` allein reicht nicht.
