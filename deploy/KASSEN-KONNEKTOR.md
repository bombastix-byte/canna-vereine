# Externe Kasse anbinden (Kassen-Konnektor)

CVMS kann als Warenwirtschafts-/KCanG-System betrieben werden und jeden
**Barvorgang** (Abgabe-Selbstkostenbeitrag, Aufnahmebeitrag) an eine **externe
Kassensoftware** melden — z. B. an eine bestehende Kasse mit TSE. Das interne
Kassenmodul wird dann abgeschaltet (Verwaltung › Module → „Kasse" aus).

## Einrichten (im Admin)
Verwaltung › **Module** → Abschnitt **Externe Kasse**:
- **Anbindung:** `Webhook` (universell) oder `JTL` (über eine Webhook-Middleware).
- **Ziel-URL:** Endpoint, der die Vorgänge entgegennimmt.
- **Token:** optional, wird als `Authorization: Bearer <token>` gesendet.

Jeder Vorgang wird zusätzlich dauerhaft protokolliert (Verwaltung ›
**Externe Kasse**); fehlgeschlagene Zustellungen lassen sich dort erneut senden.

## Was CVMS sendet (Webhook-Vertrag)
`POST <Ziel-URL>`, Header `content-type: application/json`,
`authorization: Bearer <token>` (falls gesetzt), `x-kasse-konnektor: webhook|jtl`.

Body (Beispiel Abgabe):
```json
{
  "quelle": "CVMS",
  "verein": "goerlitz",
  "typ": "webhook",
  "art": "abgabe",
  "belegnr": "A-20260706-28495",
  "mitgliedsnummer": "M-105",
  "datum": "2026-07-06",
  "betrag_euro": 17.0,
  "positionen": [
    { "bezeichnung": "Northern Lights 2026-0002", "menge_g": 2, "betrag_euro": 17.0 }
  ]
}
```
Aufnahmebeitrag: `"art": "aufnahme"`, ohne `positionen`, mit `betrag_euro`.

Die empfangende Seite antwortet mit HTTP 2xx bei Erfolg (Body wird im Protokoll
gespeichert). Alles andere gilt als Fehler und kann erneut zugestellt werden.

## JTL
JTL-POS nimmt Fremd-Transaktionen nicht direkt per Webhook entgegen. Praktikabel
ist eine **kleine Middleware**, die den obigen POST empfängt und die Buchung über
die JTL-Schnittstelle (JTL-Wawi-API / Import) einbucht — dort greift dann die
TSE. So bleibt JTL das rechtlich maßgebliche Kassensystem, CVMS liefert nur die
Vorgänge zu. Der genaue JTL-Weg hängt von der JTL-Version/Lizenz ab und wird mit
den JTL-Zugangsdaten des Vereins finalisiert.

## Rechtlicher Hinweis
Ob der Verein überhaupt eine TSE braucht (KassenSichV/§146a AO) oder mit einer
offenen Ladenkasse + Kassenbuch auskommt, klärt der Steuerberater. Braucht es
keine TSE, genügt die interne CVMS-Kasse; braucht es eine, bleibt die bestehende
Kasse per Konnektor führend.
