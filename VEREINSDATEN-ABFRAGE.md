# Vereinsdaten-Abfrage (Website-Livegang)

Diese Angaben brauchen wir vom Verein, bevor die Website online gehen kann. Alles
hier landet 1:1 auf der oeffentlichen Seite bzw. im Impressum und muss daher
korrekt und vollstaendig sein. Bitte je Punkt ausfuellen oder "entfaellt"
schreiben. Umlaute (ae/oe/ue/ss) bitte echt schreiben, also Goerlitz -> Goerlitz
mit oe wird zu dem richtigen Zeichen.

Hinweis zur Rechtslage (KCanG Paragraf 6): Die Seite ist bewusst rein sachlich,
keine Werbung, keine Bilder von Pflanzen/Produkten, keine Angebote. Bitte daher
auch in den Zulieferungen nur sachliche Angaben.

Pro Verein einmal ausfuellen. (Vorlage gilt fuer Goerlitz 1, Goerlitz 2 / CSC
und Leipzig gleichermassen.)

---

## 1. Verein und Register

- Exakter Vereinsname laut Satzung (mit "e. V."): ______________________
- Kurzname fuer Kopfzeile/Titel: ______________________
- Stadt: ______________________
- Vereinsregister (VR-Nummer + zustaendiges Amtsgericht): ______________________
- Erlaubnis nach Paragraf 11 KCanG: Aktenzeichen und Status
  (beantragt / erteilt am ...): ______________________

## 2. Kontakt (oeffentlich sichtbar)

- Strasse und Hausnummer: ______________________
- PLZ und Ort: ______________________
- Oeffentliche E-Mail (z. B. kontakt@euredomain.de): ______________________
- Telefon (optional, oder "kein Telefon"): ______________________
- Gewuenschte Domain fuer die Website (z. B. euer-verein.de): ______________________

## 3. Vorstand (Pflicht fuers Impressum)

Vertretungsberechtigte Personen nach Paragraf 26 BGB. Bitte Name + Rolle:

- Vorsitz: ______________________
- Stellvertretung: ______________________
- weitere (optional): ______________________

## 4. Praeventionsbeauftragte Person (Pflicht nach Paragraf 23 KCanG)

- Name: ______________________
- E-Mail (optional, z. B. praevention@euredomain.de): ______________________

## 5. Oertliche Suchtberatung (eine regionale Stelle)

Wir hinterlegen zusaetzlich die bundesweiten Stellen (BZgA, Sucht-und-Drogen-
Hotline) automatisch. Bitte eine Beratungsstelle vor Ort ergaenzen:

- Name der Beratungsstelle: ______________________
- Telefon: ______________________
- Webseite (optional): ______________________

## 6. Dokumente zum Download (PDF, soweit vorhanden)

Bitte als PDF mitschicken, was schon existiert. Fehlendes einfach weglassen.

- [ ] Satzung
- [ ] Beitragsordnung
- [ ] Gesundheits-/Praeventionskonzept
- [ ] Jugendschutzkonzept

## 7. Impressum, Ergaenzungen

- Inhaltlich verantwortliche Person (Name, Anschrift wie oben oder abweichend): ______________________
- Umsatzsteuer-ID (nur falls vorhanden): ______________________

---

### Was danach passiert

Sobald diese Angaben vorliegen, tragen wir sie in die jeweilige Vereins-Config
ein (`src/config/<verein>.ts`), bauen die Seite neu und schalten sie unter eurer
Domain live. Der nicht-oeffentliche Mitgliederbereich (Login, News, Termine,
Dokumente) kommt aus PocketBase und wird beim Livegang mit eingerichtet; die
Mitglieder-Zugaenge legen wir gemeinsam an (kein oeffentliches Registrieren).
