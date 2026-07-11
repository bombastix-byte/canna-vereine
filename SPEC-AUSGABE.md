# SPEC-AUSGABE — Audit & Härtungs-Spezifikation für das Ausgabe-Modul (KCanG)

**Erstellt:** 2026-07-10 · **Rolle dieses Dokuments:** Vollständige Vorgabe für die Umsetzung
durch das Executor-Modell (Claude Sonnet 5). Alle Entscheidungen sind hier getroffen —
der Executor implementiert, entscheidet aber keine Architektur neu.

**Auditierter Stand:** `src/lib/ausgabe.ts`, `src/pages/mitglieder/ausgabe/buchen.ts`,
`src/pages/mitglieder/ausgabe/stornieren.ts`, `src/pages/mitglieder/ausgabe.astro`,
`src/pages/mitglieder/ausgabe/beleg/[id].astro`, `src/pages/mitglieder/ausgabe/beleg/[id]/drucken.ts`,
`src/pages/mitglieder/vermehrung/buchen.ts`, `src/lib/{rollen,pb,status,audit,kassen-konnektor,verarbeitung}.ts`,
`src/middleware.ts`, sämtliche `pb/pb_migrations/*ausgaben*`, `*sorten*`, `*chargen*`, `*users*`,
`*audit_log*`, `scripts/{seed-ausgabe,seed-storno,test-ausgabe,test-tresen-http}.mjs`.

**Wichtiger Kontext zum Datenmodell:** `AUSGABE-MODUL.md` beschreibt noch den alten Fluss über
`sorten.bestand_gramm`. Die Implementierung bucht inzwischen gegen **`chargen`**
(`chargen.verfuegbar_g`, `chargen.status="freigegeben"`, `chargen.thc_prozent`); `sorten` ist nur
noch Stammdaten-Referenz. Das Doc ist an mehreren Stellen veraltet (siehe F12).

---

## 1. Verifizierte Invarianten (nachvollzogen, korrekt)

| # | Invariante | Beleg (Datei:Zeile) |
|---|---|---|
| V1 | Grenzwerte zentral und korrekt: 25 g/Tag, 50 g/Monat, U21 30 g/Monat, U21 ≤ 10 % THC, 8,50 €/g | `src/lib/ausgabe.ts:11-21` |
| V2 | THC-Vergleich ist **numerisch**: `charge.thc_prozent` ist PB-Feldtyp `number` (`pb/pb_migrations/1783004320_created_chargen.js`), wird in `buchen.ts:110-113` per `Number()` konvertiert und in `ausgabe.ts:123` / `ausgabe.ts:204` als Zahl gegen `U21_MAX_THC` verglichen. Kein String-Vergleich im Pfad. | `buchen.ts:110-113`, `ausgabe.ts:123,204` |
| V3 | Fehlendes Geburtsdatum → U21 (strengste Regel), serverseitig: `istU21()` liefert `true` bei nicht parsebarem Datum; der Endpoint ruft es mit `empfaenger.geburtsdatum` auf. | `ausgabe.ts:56-60`, `buchen.ts:108,116` |
| V4 | Tag/Monat Berlin-lokal, serverseitig bestimmt und als Snapshot (`tag`, `monat`) gespeichert; Tagesmenge = Teilmenge der Monatssätze mit `r.tag === tag` (konsistent, kein Zeitzonen-Verrutschen im Endpoint). | `ausgabe.ts:24-32`, `buchen.ts:95-96,107,150-151` |
| V5 | Limits gelten für die **Summe** aller Positionen eines Vorgangs — Aufteilen umgeht das Limit nicht. Unit-getestet. | `ausgabe.ts:181-221`, `scripts/test-ausgabe.mjs:72-77` |
| V6 | Die gesetzliche Prüfung läuft **serverseitig im POST-Endpoint**, unabhängig von UI-`max`-Attributen (die nur Komfort sind, `ausgabe.astro:289,306`). Reihenfolge: Menge → U21-THC → Tageslimit → Monatslimit → Bestand. | `buchen.ts:115-129` |
| V7 | Rollen-Gate doppelt: Endpoint (`darfAusgeben`, `buchen.ts:34`) **und** PB `createRule` auf `ausgaben` (`rollen ~ "ausgabe" || rollen ~ "vorstand"`, `1783004320_updated_ausgaben.js:7`). Ein `mitglied` kann weder über die Seite noch direkt über die PB-API eine Abgabe anlegen. |
| V8 | `ausgaben.deleteRule = null` in allen Migrationen — kein Löschen über die API, auch nicht durch Vorstand. | `1783002772_created_ausgaben.js:5` (nie geändert) |
| V9 | Snapshots werden zum Buchungszeitpunkt persistiert: `mitgliedsnummer`, `charge` (Nr.), `sorte_name`, `thc_prozent`, `cbd_prozent`, `produkt_typ`, `beitrag_euro`, `tag`, `monat`, `belegnr`, `abgegeben_von`. Spätere Änderungen an `sorten`/`chargen` verändern keinen Alt-Beleg. | `buchen.ts:138-155` |
| V10 | Mitglieder-Isolation auf `ausgaben`: list/viewRule = `mitglied = @request.auth.id || rollen ~ ausgabe/vorstand` — ein `mitglied` sieht nur eigene Abgaben; die Beleg-Seite verlässt sich auf diese Regel und sie greift. | `1783004320_updated_ausgaben.js:8-9`, `beleg/[id].astro:22` |
| V11 | Beleg enthält: Sorte, Charge, Menge, THC/CBD, Abgabedatum, Beitrag, Weitergabe-/Jugendschutz-/Präventionshinweis inkl. Präventionskontakt. | `beleg/[id].astro:104-138` |
| V12 | Lebenszyklus-Sperre serverseitig: ruhende/ausgetretene Mitglieder werden vor der Limitprüfung abgewiesen. | `buchen.ts:76-79`, `src/lib/status.ts:36-39` |
| V13 | Nur `status="freigegeben"`-Chargen buchbar (Endpoint prüft je Charge). | `buchen.ts:89-91` |
| V14 | Grenzfall-Unit-Tests existieren und decken exakt-25 g, 48+3 g Monat, U21 exakt 10 %, fehlendes Geburtsdatum, Multi-Positions-Schlupfloch ab: `node scripts/test-ausgabe.mjs` (rein, ohne DB). | `scripts/test-ausgabe.mjs` |
| V15 | `audit_log`: create nur Personal, update/delete `null`, lesen nur Vorstand — Storno-Protokoll ist selbst nicht manipulierbar. | `1783265112_created_audit_log.js:4-5,129-134` |

---

## 2. Findings (nach Schwere: legal > Datenintegrität > Zugriff > Nebenläufigkeit > kosmetisch)

### F1 — `ausgaben` ist NICHT append-only: updateRule erlaubt Personal das Umschreiben beliebiger Felder
**Schwere: HOCH (legal + Revisionssicherheit)** · reine Code-/Regel-Korrektur

- Migration `pb/pb_migrations/1783263595_updated_ausgaben.js:7` setzt
  `updateRule: '@request.auth.rollen ~ "ausgabe" || @request.auth.rollen ~ "vorstand"'`
  — **ohne Feldbeschränkung**. Eingeführt für die Storno-Funktion (`scripts/seed-storno.mjs:31-36` dokumentiert das ausdrücklich: „bisher war ausgaben append-only“).
- Konkretes Versagensszenario: Jede Person mit Rolle `ausgabe` kann per direktem
  `PATCH /api/collections/ausgaben/records/<id>` (eigener Token genügt) nachträglich
  `menge_gramm`, `thc_prozent`, `tag`, `monat`, `mitglied`, `belegnr` … eines beliebigen Alt-Datensatzes
  ändern. Damit sind Vergangenheits-Belege, Limit-Zählung und Jahresmeldung fälschbar —
  das Kernversprechen „Revisionssicherheit“ aus `AUSGABE-MODUL.md:27-28` ist an der API-Schicht gebrochen.
- Zusätzlich: `storniert=false` (Ent-Storno) ist über die API möglich, obwohl die UI das nicht anbietet.
- Fix: Task T2 (updateRule nur für Storno-Felder, kein Ent-Storno).

### F2 — Die PB-API ist ein zweiter, ungeprüfter Schreibpfad: Limits werden NUR im Astro-Endpoint erzwungen
**Schwere: HOCH (legal)** · Code-Fix (PB-Hook); Grundsatz bitte der Rechtsberatung als Architektur-Info mitgeben

- `ausgaben.createRule` prüft nur die Rolle (`1783004320_updated_ausgaben.js:7`), keinerlei Mengen-,
  U21- oder Datums-Plausibilität. Wer einen `ausgabe`-Token hat, kann direkt über die PB-API
  einen Datensatz mit `menge_gramm: 500`, frei gewähltem `tag`/`monat` (z. B. Vormonat → zählt nie in ein Limit)
  oder fremdem `abgegeben_von` anlegen — komplett am KCanG-Check in `buchen.ts:115-129` vorbei.
- Analog kann `ausgabe`-Personal `chargen.verfuegbar_g` beliebig setzen
  (`1783004320_created_chargen.js:258`: updateRule enthält `ausgabe`).
- Das ist kein Bug im Endpoint (der prüft korrekt), sondern eine fehlende **autoritative** Durchsetzung
  in der Datenbankschicht. PocketBase kann das nur per `pb_hooks` (derzeit existiert kein
  `pb/pb_hooks/`-Verzeichnis) — Task T6.

### F3 — Regression: `users`-list/viewRule nutzt das Altfeld `rolle` statt `rollen` → Tresen für neu angelegtes Personal funktionsunfähig + inkonsistente Sichtbarkeit
**Schwere: HOCH (Zugriff + funktional)** · reine Code-/Regel-Korrektur

- Migration `pb/pb_migrations/1783268072_updated_users.js:7-8` setzt (im UP-Zweig!)
  `listRule`/`viewRule` auf `… || @request.auth.rolle = "vorstand" || @request.auth.rolle = "ausgabe"` —
  das ist das **Legacy-Einzelfeld** `rolle` (`1783002772_updated_users.js`, maxSelect 1, nie entfernt).
  Der DOWN-Zweig derselben Migration enthält die eigentlich richtige `rollen ~`-Regel (inkl. `anbau`) —
  die Migration sieht wie ein versehentlicher Revert über die Admin-UI aus. Keine spätere Migration
  korrigiert das; der Dump der Live-DB (`pb/pb_data/data.db`) enthält die `rolle =`-Fassung als aktuelle Regel.
- Die App schreibt aber ausschließlich `rollen` (Mehrfachfeld): `src/pages/mitglieder/verwaltung/anlegen.ts:37,83`;
  `src/lib/pb.ts:80` liest nur `rollen`.
- Konkrete Folgen:
  1. **Funktional:** Neu über die Verwaltung angelegtes Ausgabe-Personal (nur `rollen=["ausgabe"]`, `rolle` leer)
     besteht zwar `darfAusgeben()` in der App, aber PB versteckt alle fremden `users`-Datensätze →
     Mitglieder-Dropdown am Tresen (`ausgabe.astro:85`) zeigt nur die eigene Person, und
     `pb.collection('users').getOne(mitgliedId)` in `buchen.ts:70` schlägt fehl → „Mitglied nicht gefunden“, keine Buchung möglich.
     (Die Demo-Seeds setzen zufällig noch das Altfeld — `scripts/seed-ausgabe.mjs:166-180` — darum fiel es nie auf.)
  2. **Zugriff:** Ein Konto mit Altfeld `rolle="ausgabe"`, aber ohne App-Rolle in `rollen`, kann die komplette
     Mitgliederliste (inkl. Geburtsdatum) über die PB-API lesen, obwohl die App es nicht als Personal betrachtet.
  3. `anbau` fehlt in der Regel ganz (war im DOWN-Stand enthalten) — Anbau-Team verliert die Sicht, die die
     Kommentare in `seed-ausgabe.mjs` bzw. `REGEL.wareLesen` (`src/lib/rollen.ts:109-113`) vorsehen.
- Fix: Task T1 (+ T11 für Altfeld/Seed-Bereinigung).

### F4 — Check-then-write-Race: Limit-Überschreitung und Bestandsfehler bei parallelen Buchungen
**Schwere: HOCH (Nebenläufigkeit → legal wirksam)** · Code-Fix

- Ablauf in `buchen.ts`: Monatssummen **lesen** (Z. 98-107) → prüfen (Z. 115-129) → `ausgaben` **anlegen**
  (Z. 136-169) → Bestand **lesen-rechnen-schreiben** (Z. 171-182). Nichts davon ist transaktional oder gesperrt;
  PocketBase-API bietet dem externen Client keine Transaktion.
- Szenario A (Limit): Zwei Ausgabekräfte buchen quasi-gleichzeitig für dasselbe Mitglied (22 g heute):
  beide lesen `mengeHeuteBisher=22`, beide prüfen 22+3 ≤ 25 → beide legen an → 28 g am Tag. Gleiche Mechanik
  fürs Monats-/U21-Limit.
- Szenario B (Bestand): Beide lesen `charge.verfuegbar_g=10`, buchen je 8 g, beide schreiben
  `Math.max(0, 10-8)=2` → Bestand zeigt 2 g, real sind 16 g abgegeben (das `Math.max(0,…)` in Z. 175 **verschleiert**
  sogar Unterdeckung, statt sie sichtbar zu machen).
- Gleiche Racefläche in `stornieren.ts:59-69` (Rückbuchung liest-rechnet-schreibt) und
  `vermehrung/buchen.ts` (Summen lesen → anlegen).
- Fix-Strategie (festgelegt, dreistufig): (a) In-Prozess-Serialisierung je Mitglied im Node-Server (T5) —
  ausreichend, weil `@astrojs/node` als Einzelprozess läuft; (b) atomarer Bestandsabzug per PB-Feld-Modifier
  `"verfuegbar_g-"` (T4); (c) autoritative Nachprüfung im PB-Hook (T6) als Schutz auch gegen den API-Direktpfad
  und etwaige Multi-Instanz-Deployments.

### F5 — Fail-open: Fehler beim Laden der Monatssummen ⇒ Limits werden gegen 0 geprüft
**Schwere: MITTEL-HOCH (legal)** · Code-Fix

- `buchen.ts:98-105`: `try { monatsSaetze = await …getFullList(…) } catch { monatsSaetze = []; }` —
  wirft die Abfrage (PB kurz weg, Timeout, Regel-Fehler), gilt das Mitglied als „hat diesen Monat 0 g bezogen“
  und die Buchung geht durch. Ein DB-Schluckauf genügt für eine Limit-Überschreitung.
- Dieselbe Muster-Kopie in `vermehrung/buchen.ts:53-60` (`catch { bisher = [] }`).
- (In `ausgabe.astro:77-83` ist das gleiche Muster nur Anzeige — dort tolerierbar, aber die Statuskarte
  zeigt dann fälschlich volle Restmengen; Hinweis genügt.)
- Fix: Task T3 — bei Query-Fehler **abbrechen** (Fehler-Redirect), niemals mit leerer Liste weiterprüfen.

### F6 — Beleg/Beipackzettel: Erntedatum (und ggf. weitere §-21-Pflichtangaben) fehlen
**Schwere: MITTEL (legal — zur Rechtsberatung)** · Code-Fix trivial, Anforderung juristisch klären

- Der Beleg (`beleg/[id].astro`) enthält Sorte, Charge, Menge, THC/CBD, Abgabedatum, Beitrag und die drei
  Hinweistexte (V11). **Nicht** enthalten: das **Erntedatum** der Charge — obwohl `chargen.ernte_datum` existiert
  (`1783004320_created_chargen.js:130`) — sowie ein Mindesthaltbarkeits-/Verbrauchsdatum und die Angabe
  Produktform in Gewicht je Position ist vorhanden, Gewicht gesamt ebenfalls.
- Ob Erntedatum/MHD auf dem Beipackzettel/der Verpackung Pflicht sind (§ 21 KCanG-Umfeld), ist hier **nicht**
  zu entscheiden → Frage an die Rechtsberatung. Der Datenpfad wird unabhängig davon vorbereitet (T8), da
  das Feld existiert und der Snapshot sonst nicht nachrüstbar ist (Alt-Chargen können gelöscht/geändert werden).

### F7 — THC-Snapshot verfälscht: „unbekannt“ wird als `0 %` gespeichert und gedruckt
**Schwere: MITTEL (Datenintegrität/Belegwahrheit)** · Code-Fix

- `buchen.ts:110-113`: `thcVon()` behandelt `thc_prozent <= 0` als `null` (unbekannt). Für **Erwachsene** ist
  eine Charge ohne THC-Wert buchbar (U21-Zweig wird übersprungen) und Z. 146 speichert `thcVon(charge) ?? 0` —
  der Beleg druckt dann **„0 %“** als vermeintliche Pflichtangabe (`beleg/[id].astro:121`), obwohl der Wert
  unbekannt ist. Eine falsche Angabe ist schlechter als keine.
- Nebenwirkung: eine ehrliche 0-%-THC-Charge (reines CBD) ist für U21 gesperrt („THC unbekannt“). Das ist die
  **konservative, gewollte** Auslegung (PB liefert für leere number-Felder `0`, echtes 0 und „nicht gepflegt“
  sind nicht unterscheidbar) — bleibt so, wird aber in `AUSGABE-MODUL.md` dokumentiert (T11).
- Fix: Task T7 — `null` speichern statt `0`, Beleg druckt dann „n. a.“.

### F8 — Storno-Politik: setzt Limits frei, zeitlich unbegrenzt, jede Ausgabekraft
**Schwere: MITTEL (legal/prozessual — Entscheidung Vorstand + Rechtsberatung, KEIN blinder Code-Fix)**

- `stornieren.ts` erlaubt jeder Person mit `ausgabe`-Rolle, **beliebig alte** Vorgänge zu stornieren
  (Grund optional, Z. 21). Stornierte Sätze zählen nicht mehr in Limits (`buchen.ts:101` filtert `storniert!=true`),
  nicht in der Jahresmeldung (`jahresmeldung.astro:28`, `exporte/[art].ts:60`), und der Bestand wird zurückgebucht.
- Risiko: Mitglied erhält 25 g, Vorgang wird storniert (Ware aber nicht zurückgegeben), Mitglied erhält am
  selben Tag erneut 25 g — die Dokumentation weist dann 25 g aus, real flossen 50 g. Der Audit-Log-Eintrag
  (`stornieren.ts:74-77`) macht es nachvollziehbar, verhindert es aber nicht.
- Positiv: append-only-Gedanke ist im Storno korrekt umgesetzt (Kennzeichnen statt Löschen), Audit-Log greift, CSV-Export zeigt Stornos transparent (`exporte/[art].ts:32-36`).
- Zu klären (Rechtsberatung/Vorstand): Muss stornierte, nicht zurückgegebene Ware in Limit und Jahresmeldung
  bleiben? Storno nur am selben Tag / nur Vorstand? Grund verpflichtend?
- Bis zur Klärung wird als konservativer Default T10 umgesetzt (Storno vergangener Tage nur Vorstand, Grund Pflicht).

### F9 — Belegnummern-Kollision möglich (`Date.now()`-Suffix zykliert alle 100 s)
**Schwere: NIEDRIG-MITTEL (Datenintegrität)** · Code-Fix

- `buchen.ts:132`: `belegnr = 'A-' + JJJJMMTT + '-' + String(Date.now()).slice(-5)` — die letzten 5 Ziffern des
  ms-Timestamps wiederholen sich alle 100 000 ms. Zwei Vorgänge **desselben Mitglieds am selben Tag** mit
  Kollision werden auf Beleg-Seite (`beleg/[id].astro:31-33`), Etikett (`drucken.ts:48-50`) und vor allem beim
  **Storno** (`stornieren.ts:35-37`, Filter `belegnr + mitglied`) zu EINEM Vorgang verschmolzen — ein Storno
  storniert dann beide.
- Fix: Task T9 (kollisionsfreie Belegnummer).

### F10 — Teilbuchung bei Multi-Positionen: Abgaben angelegt, aber Bestand/Kasse nicht nachgezogen
**Schwere: NIEDRIG-MITTEL (Datenintegrität)** · Code-Fix

- `buchen.ts:136-169`: Schlägt das Anlegen von Position k fehl, wird sofort returned — die bereits angelegten
  Positionen bleiben (bewusst, append-only, Meldung transparent), aber der **Bestandsabzug (Z. 171-182) und der
  Kassenvorgang (Z. 186-200) laufen nie** → `verfuegbar_g` zu hoch, Kasse ohne Vorgang, obwohl Abgaben existieren.
- Fix: in T4 enthalten (Bestandsabzug je Position direkt nach deren Create; Kassenvorgang über `gebucht` auch im Fehlerpfad).

### F11 — Filter-Strings per Template-Literal statt `pb.filter()`
**Schwere: NIEDRIG (Härtung; aktuell kein bekannter Exploit-Pfad)** · Code-Fix

- `buchen.ts:101`, `stornieren.ts:36`, `beleg/[id].astro:32`, `drucken.ts:49`, `ausgabe.astro:90,91,123,147`,
  `vermehrung/buchen.ts:57` interpolieren Werte direkt in PB-Filter. Heute entschärft, weil `mitgliedId` vorher
  ein erfolgreiches `getOne()` (nur `[a-z0-9]{15}`-IDs) passieren muss und `belegnr`/`tag` serverseitig entstehen —
  aber das ist implizit und bricht bei der nächsten Umstellung. PB-SDK bietet `pb.filter('mitglied={:id} …', {id})`.
- Fix: Task T11.

### F12 — Veraltete Doku/Seeds + kleinere Korrektheitspunkte
**Schwere: KOSMETISCH/NIEDRIG**

1. `AUSGABE-MODUL.md` beschreibt `sorten.bestand_gramm`-Fluss und behauptet „kein Ändern/Löschen über die API“
   (durch F1 falsch, nach T2 nur noch halb falsch → präzisieren: „nur Storno-Kennzeichnung, keine inhaltliche Änderung“).
2. `scripts/seed-ausgabe.mjs` lebt komplett in der Legacy-Welt (Einzelfeld `rolle`, `sorten`-Bestand, ausgaben
   ohne `charge_ref`) und setzt beim Lauf die **falschen users-Regeln** (Z. 61-66) — nach T1 würde ein erneuter
   Seed-Lauf F3 wieder einführen!
3. Beleg-Datumsanzeige `datum(a.tag + 'T00:00:00Z')` (`beleg/[id].astro:51`) rendert UTC-Mitternacht in der
   **Server**-Zeitzone: läuft der Server westlich von UTC, zeigt der Beleg den Vortag. Fix: `timeZone: 'UTC'`
   in den `toLocaleDateString`-Optionen (der String ist ja bereits der Berlin-Kalendertag).
4. Kein Audit-Log-Eintrag bei der Buchung selbst (nur bei Storno) — vertretbar, da der `ausgaben`-Datensatz das
   Protokoll ist; nach T2 auch unveränderlich. Kein Handlungsbedarf, nur Doku.
5. `ausgaben` hat keine Indexe (`1783002772_created_ausgaben.js:243`); Limit-Query filtert `mitglied+monat`,
   Tagesliste `tag`, Storno/Beleg `belegnr`. Bei Vereinsgröße unkritisch, Index kostet nichts → T12.

---

## 3. Executor-Task-Liste (für Sonnet 5, in dieser Reihenfolge umsetzen)

Allgemeine Regeln für alle Tasks:
- Neue PB-Migrationen als `pb/pb_migrations/<unix-ts>_updated_<collection>.js` im vorhandenen
  `migrate((app) => {…}, (app) => {…})`-Stil (UP setzt neu, DOWN stellt exakt den vorherigen Wert wieder her —
  Vorlage: `1783263595_updated_ausgaben.js`). Unix-ts fortlaufend > 1783614064 wählen.
- Bestehende Migrationen NIEMALS editieren.
- Nach jedem Task: `node scripts/test-ausgabe.mjs` muss weiter grün sein und `npx astro build` kompilieren.

### T1 — users-Sichtbarkeitsregeln auf `rollen` zurückstellen (fixt F3)
a) **Dateien:** neue Migration `pb/pb_migrations/<ts>_updated_users.js`.
b) **Änderung:** `listRule` und `viewRule` von `_pb_users_auth_` setzen auf exakt:
   `@request.auth.id != "" && (id = @request.auth.id || @request.auth.rollen ~ "ausgabe" || @request.auth.rollen ~ "anbau" || @request.auth.rollen ~ "vorstand")`
   (DOWN-Zweig: die aktuelle `rolle =`-Fassung aus `1783268072_updated_users.js:7-8`).
c) **Abnahme:** Frische PB starten (`pb\pocketbase.exe serve --dir pb\pb_data_test --migrationsDir pb\pb_migrations` mit leerem Datenverzeichnis), Superuser anlegen, zwei User anlegen: A mit `rollen=["ausgabe"]` (Feld `rolle` LEER), B mit `rollen=["mitglied"]`. Als A per PB-SDK `users.getFullList()` → liefert A **und** B. Als B → liefert nur B. Zusätzlich als A `users.getOne(<B.id>)` → 200.

### T2 — `ausgaben.updateRule` auf reine Storno-Kennzeichnung einschränken (fixt F1)
a) **Dateien:** neue Migration `pb/pb_migrations/<ts>_updated_ausgaben.js`.
b) **Änderung:** `updateRule` der Collection `pbc_1536184446` (`ausgaben`) setzen auf (eine Zeile):
   ```
   (@request.auth.rollen ~ "ausgabe" || @request.auth.rollen ~ "vorstand") && storniert != true && @request.body.storniert = true && @request.body.mitglied:isset = false && @request.body.mitgliedsnummer:isset = false && @request.body.sorte:isset = false && @request.body.sorte_name:isset = false && @request.body.charge:isset = false && @request.body.charge_ref:isset = false && @request.body.produkt_typ:isset = false && @request.body.thc_prozent:isset = false && @request.body.cbd_prozent:isset = false && @request.body.menge_gramm:isset = false && @request.body.beitrag_euro:isset = false && @request.body.tag:isset = false && @request.body.monat:isset = false && @request.body.abgegeben_von:isset = false && @request.body.belegnr:isset = false && @request.body.notiz:isset = false
   ```
   Wirkung: Update nur durch Personal, nur auf noch nicht stornierten Sätzen, nur wenn `storniert:true` gesetzt wird und KEIN inhaltliches Feld angefasst wird (erlaubt bleiben `storniert_am`, `storniert_von`, `storno_grund`). Ent-Storno (`storniert=false`) ist damit unmöglich. Hinweis: exakt diese Feldliste stammt aus `1783002772_created_ausgaben.js` + `1783078981_updated_ausgaben.js` (`produkt_typ`) + `charge_ref`-Feld (per Grep `charge_ref` in `pb/pb_migrations` verifizieren; falls das Feld anders heißt, Liste anpassen).
   (DOWN: die Regel aus `1783263595_updated_ausgaben.js:7`.)
c) **Abnahme:** Gegen laufende PB als `ausgabe`-User: (1) `PATCH ausgaben/<id>` mit `{menge_gramm: 999}` → **400/403**; (2) Storno über den Endpoint `/mitglieder/ausgabe/stornieren` → funktioniert weiterhin (Beleg zeigt STORNIERT); (3) `PATCH` mit `{storniert:false}` auf dem stornierten Satz → **400/403**. `stornieren.ts` NICHT ändern — dessen Update-Payload (Z. 50-55) erfüllt die neue Regel bereits.

### T3 — Fail-closed bei Limit-Datenbeschaffung (fixt F5)
a) **Dateien:** `src/pages/mitglieder/ausgabe/buchen.ts`, `src/pages/mitglieder/vermehrung/buchen.ts`.
b) **Änderung:** In `buchen.ts:98-105` den `catch { monatsSaetze = []; }` ersetzen durch
   `catch { return zurueck(redirect, mitgliedId, 'Limit-Prüfung nicht möglich (Datenbank nicht erreichbar) - Abgabe abgebrochen.'); }`.
   In `vermehrung/buchen.ts` (Z. 53-60) analog: `catch { return zurueck(redirect, mitgliedId, 'Limit-Prüfung nicht möglich - Weitergabe abgebrochen.'); }`.
c) **Abnahme:** Unit-artiger HTTP-Test: PB stoppen, Astro-Dev weiterlaufen lassen — POST auf `/mitglieder/ausgabe/buchen` … (Login-Cookie vorher holen; ohne PB schlägt schon `mitgliedAusToken` fehl, daher so testen:) alternativ in `buchen.ts` temporär nicht nötig — stattdessen Abnahme per Code-Review-Assertion: `grep -n "monatsSaetze = \[\]" src/pages/mitglieder/ausgabe/buchen.ts` liefert **keinen** Treffer mehr, und `node scripts/test-tresen-http.mjs` (voller Stack, Abschnitt 4) bleibt grün.

### T4 — Atomarer Bestandsabzug + konsistente Teilbuchung (fixt F4-Szenario B, F10)
a) **Dateien:** `src/pages/mitglieder/ausgabe/buchen.ts` (Buchungs-/Bestandsblock Z. 134-200), `src/pages/mitglieder/ausgabe/stornieren.ts` (Rückbuchung Z. 59-69).
b) **Änderung:**
   1. Bestandsabzug **in** die Create-Schleife ziehen: direkt nach jedem erfolgreichen `ausgaben.create` für diese Position `await pb.collection('chargen').update(charge.id, { 'verfuegbar_g-': menge })` — der PB-Feld-Modifier `feld-`/`feld+` rechnet serverseitig atomar auf dem aktuellen Wert. Danach den zurückgegebenen Datensatz prüfen: ist `verfuegbar_g <= 0`, zusätzlich `{ status: 'aufgebraucht' }` patchen; ist er **negativ**, NICHT auf 0 klemmen (ehrlicher Zählstand), sondern eine Warnung in die Redirect-Meldung aufnehmen („Bestand rechnerisch negativ – bitte Warenwirtschaft prüfen“). Das bisherige `Math.max(0, …)` (Z. 175) entfällt.
   2. Der Fehlerpfad „Nur k von n Positionen gebucht“ (Z. 161-167) ruft vor dem Return `erfasseVorgang` über die bereits `gebucht`-en Positionen auf (Kasse konsistent zur Abgabe) — den bestehenden Block Z. 186-200 dafür in eine lokale Funktion ziehen und aus beiden Pfaden aufrufen.
   3. `stornieren.ts` Rückbuchung: `{ 'verfuegbar_g+': Number(p.menge_gramm) || 0 }` statt Lesen-Addieren-Schreiben; Status-Reaktivierung (`aufgebraucht`→`freigegeben`) anhand des vom Update zurückgegebenen Datensatzes.
c) **Abnahme:** Voller Stack (PB + `npx astro dev` + Seeds, siehe Abschnitt 4). Skript `node scripts/test-tresen-http.mjs` grün. Zusätzlich neues Skript `scripts/test-race-http.mjs` (im Zuge von T5 erstellt, siehe dort) — Bestandsteil: Charge mit `verfuegbar_g=10` anlegen, zwei parallele Buchungen à 8 g für ZWEI verschiedene Mitglieder feuern (`Promise.all`); danach via Admin-SDK prüfen: `verfuegbar_g` ist exakt `10 - (Summe der erfolgreich gebuchten Mengen)` (kein stiller Verlust), und höchstens eine der beiden hat den Beleg erreicht ODER der Bestand ist ehrlich negativ + Warnmeldung kam (je nach Timing beides zulässig — assertiert wird die **Konsistenz** Bestand ↔ Summe gebuchter Abgaben).

### T5 — Buchungen je Mitglied serialisieren (fixt F4-Szenario A im Normalbetrieb)
a) **Dateien:** neu `src/lib/serie.ts`; `src/pages/mitglieder/ausgabe/buchen.ts`; `src/pages/mitglieder/vermehrung/buchen.ts`; neu `scripts/test-race-http.mjs`.
b) **Änderung:**
   1. `src/lib/serie.ts`: kleiner In-Prozess-Serialisierer:
      ```ts
      const ketten = new Map<string, Promise<unknown>>();
      /** Führt fn aus, serialisiert je Schlüssel (z. B. Mitglieds-ID). Single-Node-Schutz gegen Doppelbuchung. */
      export async function inReihe<T>(schluessel: string, fn: () => Promise<T>): Promise<T> {
        const vorher = ketten.get(schluessel) ?? Promise.resolve();
        const lauf = vorher.then(fn, fn);
        ketten.set(schluessel, lauf.catch(() => {}));
        try { return await lauf; } finally { if (ketten.get(schluessel) === lauf.catch(() => {})) ketten.delete(schluessel); }
      }
      ```
      (Executor: die Map-Aufräumlogik gern simpler — entscheidend ist: gleiche `schluessel` laufen strikt nacheinander, Fehler brechen die Kette nicht.)
   2. In `buchen.ts` alles ab dem Laden der Monatssätze (Z. 95) bis einschließlich Bestand/Kasse in `inReihe(mitgliedId, async () => { … })` wrappen (Rückgabewert = Response durchreichen). Ebenso in `vermehrung/buchen.ts` um Prüf+Buchungsblock.
   3. Kommentar im Code: Schutz gilt je Node-Prozess; bei Multi-Instanz-Betrieb ist der PB-Hook (T6) die autoritative Grenze.
   4. `scripts/test-race-http.mjs` (Muster: `test-tresen-http.mjs`): setzt Mitglied auf 20 g heute, feuert `Promise.all([buchen(3g), buchen(3g)])`; Assertion: **genau eine** Buchung landet auf `/beleg/`, die andere auf `Tageslimit`; Summe `ausgaben` heute (nicht storniert) für das Mitglied ≤ 25 g. Plus Bestandsteil aus T4c.
c) **Abnahme:** `node scripts/test-race-http.mjs` grün gegen laufenden Stack; `node scripts/test-tresen-http.mjs` weiterhin grün.

### T6 — PB-Hook als autoritative KCanG-Grenze in der Datenbankschicht (fixt F2, härtet F4)
a) **Dateien:** neu `pb/pb_hooks/ausgaben.pb.js` (PocketBase lädt `pb_hooks/*.pb.js` automatisch neben der exe).
b) **Änderung:** Hook `onRecordCreateRequest` für Collection `ausgaben` (PB ≥ 0.23-JSVM-API, vgl. `pb/pb_data/types.d.ts`):
   - Superuser-Requests durchlassen (`e.hasSuperuserAuth()`), damit Seeds/Tests/Admin-Reparaturen funktionieren.
   - `tag`/`monat` **serverseitig überschreiben** (Berlin-Kalendertag; im JSVM ohne Intl-Garantie über UTC+Offset-Berechnung: Berlin = UTC+1, +2 in Sommerzeit — Executor: letzte-März-/Oktober-Sonntags-Regel als kleine Funktion implementieren und mit den Randfällen aus Abschnitt 4/S9 testen), damit kein Client ein falsches Datum einliefern kann.
   - `menge_gramm` > 0 verlangen.
   - Summen berechnen: `$app.findRecordsByFilter("ausgaben", "mitglied = {:m} && monat = {:mo} && storniert != true", …)`; Tagessumme analog mit `tag`. U21 via `geburtsdatum` des Ziel-Mitglieds (`$app.findRecordById("users", …)`), fehlend ⇒ U21. Bei Verstoß `throw new BadRequestError("<gleiche Meldungstexte wie src/lib/ausgabe.ts>")`.
   - THC-Regel U21: `thc_prozent` des Requests muss > 0 und ≤ 10 sein, sonst ablehnen (Snapshot-Feld ist die Wahrheit des Requests; der Astro-Endpoint befüllt es aus der Charge).
   - Die Grenzwerte (25/50/30/10) als Konstanten mit Kommentar „muss `src/lib/ausgabe.ts` spiegeln“ am Dateikopf.
   - Der Hook läuft innerhalb der PB-Request-Verarbeitung und schließt damit auch das Race für den API-Direktpfad weitgehend; zusammen mit T5 ist der Normalbetrieb dicht.
c) **Abnahme:** (1) Direkter PB-API-Create als `ausgabe`-User mit `menge_gramm: 999` → 400 mit Tageslimit-Meldung; (2) mit `tag: '2020-01-01'` → angelegter Datensatz trägt den **heutigen** Berlin-Tag; (3) `node scripts/test-tresen-http.mjs` grün (die legitimen Endpoint-Buchungen passieren den Hook). Achtung: dessen Setup bucht per Admin (Superuser) 22 g vor — das muss dank Superuser-Bypass weiter klappen.

### T7 — THC-Snapshot ehrlich machen (fixt F7)
a) **Dateien:** `src/pages/mitglieder/ausgabe/buchen.ts` (Z. 146), `src/pages/mitglieder/ausgabe/beleg/[id].astro` (Z. 121), `src/pages/mitglieder/ausgabe.astro` (Tagesliste Z. 365 nutzt bereits `?? '—'` — prüfen, ok lassen), `src/lib/zpl.ts` (Etikett: gleiche Darstellung, Stelle per Grep `thc` finden).
b) **Änderung:** In `buchen.ts` Z. 146 `thc_prozent: thcVon(charge) ?? 0` → `thc_prozent: thcVon(charge)` (PB-number, not required ⇒ `null` zulässig; PB speichert dann 0/leer — deshalb zusätzlich:) Beleg-Rendering ändern zu: `p.thc_prozent > 0 ? \`${p.thc_prozent} %\` : 'n. a.'` (analog CBD). Hinweis im Code, dass `0` „nicht erhoben“ bedeutet (PB kennt kein echtes null für number) und die U21-Sperre deshalb bei 0 greift (konservativ, gewollt).
c) **Abnahme:** Charge ohne THC-Wert anlegen, an ERWACHSENEN buchen → Beleg zeigt bei THC „n. a.“, nicht „0 %“; an U21 → Abweisung „THC-Gehalt unbekannt“. `node scripts/test-ausgabe.mjs` grün.

### T8 — Erntedatum in Snapshot + Beleg (fixt F6, Datenpfad; Textpflicht klärt Rechtsberatung)
a) **Dateien:** neue Migration `pb/pb_migrations/<ts>_updated_ausgaben.js` (Textfeld `ernte_datum` auf `ausgaben`); `buchen.ts` (Snapshot `ernte_datum: (charge.ernte_datum || '').slice(0, 10)`); `beleg/[id].astro` (Positionszeile oder Kopftabelle: „Ernte: TT.MM.JJJJ“, leer ⇒ Zeile weglassen); Feld in die eingefrorene Liste der updateRule aus T2 **mit aufnehmen** (T2-Migration entsprechend schreiben, wenn T8 mitkommt — Reihenfolge beachten oder Folge-Migration).
b) **Abnahme:** Buchung einer Charge mit gepflegtem `ernte_datum` → Beleg zeigt das Erntedatum; Alt-Datensätze ohne Feld rendern ohne Fehler.

### T9 — Kollisionsfreie Belegnummer (fixt F9)
a) **Dateien:** `src/pages/mitglieder/ausgabe/buchen.ts` (Z. 132).
b) **Änderung:** `const belegnr = 'A-' + tag.replaceAll('-', '') + '-' + crypto.randomUUID().slice(0, 8);` (Import `node:crypto` nicht nötig — `crypto` ist global in Node ≥ 19; sonst `import { randomUUID } from 'node:crypto'`). Format bleibt menschenlesbar mit Tagespräfix.
c) **Abnahme:** Zwei Buchungen hintereinander → verschiedene `belegnr`; `test-tresen-http.mjs` grün (prüft nur `/beleg/`-Redirects, kein Format).

### T10 — Konservativer Storno-Default bis zur Rechtsklärung (adressiert F8)
a) **Dateien:** `src/pages/mitglieder/ausgabe/stornieren.ts`, `src/pages/mitglieder/ausgabe/beleg/[id].astro` (Formular).
b) **Änderung:** (1) `grund` wird Pflicht (leer ⇒ Redirect mit Fehlermeldung, Beleg-Formular `required` am Eingabefeld). (2) Liegt der `tag` des Ankers vor dem heutigen Berlin-Tag, ist Storno nur mit `istVorstand(mitglied.rollen)` erlaubt (Import aus `src/lib/rollen.ts`); sonst Redirect `?fehler=nurvorstand` + Meldungsausgabe auf der Beleg-Seite. (3) Kommentar mit TODO-Rechtsberatung: ob stornierte, nicht zurückgegebene Mengen im Limit/Jahresmeldung verbleiben müssen (dann wäre ein `ware_zurueck`-Flag nötig) — NICHT jetzt umsetzen.
c) **Abnahme:** Als `ausgabe`-User (ohne vorstand): Storno einer heutigen Abgabe mit Grund → ok; ohne Grund → abgelehnt; Storno einer gestrigen (per Admin-SDK mit gestrigem `tag` angelegten) Abgabe → abgelehnt; als `vorstand` → ok.

### T11 — Härtungs-/Doku-Sammeltask (F11, F12)
a) **Dateien:** alle unter F11 gelisteten Stellen; `src/pages/mitglieder/ausgabe/beleg/[id].astro:48-51`; `AUSGABE-MODUL.md`; `scripts/seed-ausgabe.mjs`.
b) **Änderung:** (1) Alle PB-Filter der Ausgabe-Pfade auf `pb.filter('feld = {:wert}', {wert})` umstellen (SDK ≥ 0.21, in `package.json` prüfen). (2) Beleg-Datum: `toLocaleDateString('de-DE', { …, timeZone: 'UTC' })`. (3) `AUSGABE-MODUL.md` aktualisieren: chargen-basierter Fluss, Storno-Verhalten („Kennzeichnung, kein Löschen; inhaltliche Felder API-seitig eingefroren“), U21-bei-THC-0-Konservativität, Hook als autoritative Grenze, users-Regelstand. (4) `seed-ausgabe.mjs`: die users-Regelsetzung (Z. 61-66) auf die `rollen ~`-Regel aus T1 umstellen und die `ausgaben`-Regeln an den Migrationsstand angleichen (KEINE Legacy-`rolle =`-Regeln mehr schreiben; das Legacy-Feld `rolle` selbst nicht löschen — Altbestand).
c) **Abnahme:** `grep -rn '@request.auth.rolle =' scripts src` → keine Treffer mehr; `npx astro build` grün; `node scripts/test-tresen-http.mjs` grün.

### T12 — Indexe auf `ausgaben`
a) **Dateien:** neue Migration `pb/pb_migrations/<ts>_updated_ausgaben.js`.
b) **Änderung:** `collection.indexes` ergänzen um:
   `CREATE INDEX idx_ausgaben_mitglied_monat ON ausgaben (mitglied, monat)`,
   `CREATE INDEX idx_ausgaben_tag ON ausgaben (tag)`,
   `CREATE INDEX idx_ausgaben_belegnr ON ausgaben (belegnr)`.
c) **Abnahme:** Migration läuft auf frischer PB durch; `sqlite`-frei prüfbar über PB-Admin-UI → Collection ausgaben → Indexes.

---

## 4. End-to-End-Verifikationsplan (offener Punkt „Verifikation gegen laufende PocketBase“)

### 4.1 Stack aufsetzen (Windows, Repo-Wurzel `D:\Claude\Projects\canna-vereine`)
1. **Frisches Datenverzeichnis** (Produktions-`pb_data` nicht anfassen):
   `pb\pocketbase.exe serve --http 127.0.0.1:8090 --dir pb\pb_data_e2e --migrationsDir pb\pb_migrations`
   → Migrationskette läuft automatisch; Superuser über den beim Erststart ausgegebenen Link bzw.
   `pb\pocketbase.exe superuser upsert admin@goerlitz.local change-me-admin --dir pb\pb_data_e2e` anlegen.
2. **.env** (Repo-Wurzel, von den Seeds via `--env-file` gelesen): `PB_URL=http://127.0.0.1:8090`,
   `PB_ADMIN_EMAIL=admin@goerlitz.local`, `PB_ADMIN_PW=change-me-admin`,
   `PB_STAFF_EMAIL=ausgabe@example.local`, `PB_STAFF_PW=change-me-staff`.
3. **Seeds** (Reihenfolge): `node --env-file=.env scripts/seed.mjs`, dann `scripts/seed-dummies.mjs`
   (legt M-101 Anna, M-102 Bengt, M-104 David/U21, M-108 Hugo/ohne Geburtsdatum an), dann
   `scripts/seed-wawi.mjs` (Chargen inkl. „Gushers“ 26 % und „CBD Aurora“ 9 %), dann
   `scripts/seed-storno.mjs`, `scripts/seed-status.mjs`, `scripts/seed-mitglieder-rechte.mjs`.
   Schlägt ein Seed wegen fehlender Vorgänger-Collections fehl, fehlende `seed-*.mjs` aus dessen
   Kopfkommentar ergänzen — die Skripte sind idempotent.
4. **App:** `npx astro dev --host 127.0.0.1 --port 4321`.

### 4.2 Automatisierte Läufe (müssen alle grün sein)
- `node scripts/test-ausgabe.mjs` — reine Grenzwertlogik (bereits vorhanden).
- `node scripts/test-tresen-http.mjs` — HTTP-Szenarien Tageslimit/U21/ohne Geburtsdatum/exakt 25 g (vorhanden).
- `node scripts/test-race-http.mjs` — Parallelität (neu aus T5).

### 4.3 Szenario-Matrix (per HTTP als Personal `ausgabe@example.local`, sofern nicht anders vermerkt; „→“ = erwartetes Ergebnis)
| # | Szenario | Erwartung |
|---|---|---|
| S1 | Mitglied wählen (`/mitglieder/ausgabe?nr=M-101`) | Statuskarte: Alter, heute X/25, Monat Y/50, „Darf jetzt noch“ = min(Rest Tag, Rest Monat) |
| S2 | Erwachsener, 22 g heute, +3 g buchen | Beleg (`/beleg/<id>?neu=1`), Summe heute exakt **25 g** |
| S3 | danach +0,1 g | Redirect mit `Tageslimit`-Meldung, KEIN neuer `ausgaben`-Satz (per Admin-SDK zählen) |
| S4 | Erwachsener mit 49,9 g im Monat, +0,1 g → ok; danach +0,1 g | erst Beleg (exakt 50), dann `Monatslimit`-Abweisung |
| S5 | U21 (M-104) mit 29 g Monat, +1 g (9 %-Charge) → ok (exakt 30); +0,1 g | `Monatslimit` (30 g), nicht 50 g |
| S6 | U21 wählt >10 %-Charge (Gushers 26 %) — Dropdown zeigt sie deaktiviert; POST direkt mit deren `charge_1` | serverseitige Abweisung `THC` (UI-Umgehung wirkungslos) |
| S7 | Mitglied ohne Geburtsdatum (M-108): Statuskarte | rote Kennzeichnung „wird streng als U21 behandelt“; >10 %-Buchung abgewiesen; Monatslimit 30 g |
| S8 | Multi-Position: 22 g heute + (2 g + 2 g in einem Vorgang) → `Tageslimit`; (2 g + 1 g) → EIN Beleg mit 2 Positionen, eine `belegnr` | Summenprüfung greift über Positionen |
| S9 | **Monatswechsel Berlin-Zeit:** per Admin-SDK einen Satz mit `tag='<letzter Tag Vormonat>'`, `monat='<Vormonat>'`, 50 g anlegen → Buchung heute 5 g | ok (Vormonat zählt nicht); zweiter Satz mit aktuellem Monat 50 g → Abweisung. Zusatz (nach T6): PB-API-Create um 23:30 **UTC** ausführen und prüfen, dass der Hook den **Berliner Folgetag** in `tag` erzwingt |
| S10 | **Append-only-Beweis** (nach T2): als `ausgabe`-User `PATCH` auf `menge_gramm` → 400/403; `DELETE` → 400/403 (deleteRule null); Storno über Endpoint → ok; `PATCH storniert=false` → 400/403 |
| S11 | **Snapshot-Beweis:** buchen, danach Charge umbenennen + `thc_prozent` ändern → Alt-Beleg unverändert (Sorte/THC vom Buchungszeitpunkt) |
| S12 | **Mitglieder-Isolation:** als Demo-Mitglied (M-101) anmelden: eigener Beleg abrufbar; Beleg-URL eines fremden Mitglieds → Redirect `fehler=beleg`; PB-API `ausgaben.getFullList` liefert nur eigene Sätze; `users.getFullList` nur sich selbst |
| S13 | **Rollen-Gate:** als M-101 POST `/mitglieder/ausgabe/buchen` → Redirect `keinzugriff`; PB-API-Create auf `ausgaben` → 400/403 |
| S14 | **Direkt-API-Grenze** (nach T6): als `ausgabe`-User PB-API-Create `menge_gramm: 26` → 400 Tageslimit |
| S15 | **Storno-Fluss:** Vorgang stornieren (mit Grund) → Beleg zeigt STORNIERT, `chargen.verfuegbar_g` zurückgebucht, Limit wieder frei (Statuskarte), `audit_log`-Eintrag `abgabe.storniert` vorhanden; Jahresmeldung (`/mitglieder/jahresmeldung`) zählt den Vorgang nicht mehr, CSV-Export (`/mitglieder/exporte/ausgaben`) zeigt ihn mit Storno-Spalte |
| S16 | **Race** (nach T4/T5): `test-race-http.mjs` — genau eine von zwei parallelen 3-g-Buchungen bei 20 g Vorstand kommt durch; Bestand konsistent |
| S17 | **Bestand:** Charge auf 5 g setzen, 6 g buchen → `bestand`-Abweisung; 5 g buchen → ok, Charge `status='aufgebraucht'`, verschwindet aus dem Dropdown |
| S18 | **Beleg-Pflichtangaben:** Druckansicht enthält Vereinsname+Anschrift, Belegnr, Datum, Mitgliedsnummer, je Position Sorte/Charge/Menge/THC-CBD/Beitrag, Gesamt, die drei Hinweise; (nach T8) Erntedatum |

### 4.4 Abschlusskriterium
Alle S1-S18 dokumentiert grün (Kurzprotokoll als Kommentar im PR / in `AUSGABE-MODUL.md` unter „Noch offen“
den Punkt „Verifikation gegen laufende PocketBase“ streichen und durch Datum + Skriptnamen ersetzen).
Offene Rechtsfragen an die Rechtsberatung (NICHT vom Executor zu entscheiden):
(1) Pflichtangaben Beipackzettel — Erntedatum/MHD (F6); (2) Storno-Semantik für Limit & Jahresmeldung (F8);
(3) Bestätigung der Grenzwerte 25/50/30/10 % und der konservativen U21-Annahme bei fehlendem Geburtsdatum
(bereits Code-Kommentar in `src/lib/ausgabe.ts:5-8`).
