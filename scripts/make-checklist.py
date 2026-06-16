# Erzeugt die Onboarding-Checkliste als ausfüllbares PDF-Formular
# (interaktive Textfelder + Kontrollkaestchen). Eine Datei pro Verein.
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Flowable,
    HRFlowable, KeepTogether,
)

GRUEN = colors.HexColor("#2f5340")
GRUEN_TIEF = colors.HexColor("#1e3a2c")
MESSING = colors.HexColor("#9c7c4a")
GRAU = colors.HexColor("#55605a")
INK = colors.HexColor("#1f2422")
FELD_RAND = colors.HexColor("#b9b3a3")
FELD_FUELL = colors.HexColor("#fffdf8")

styles = getSampleStyleSheet()
h_title = ParagraphStyle("t", parent=styles["Title"], fontName="Helvetica-Bold",
                         fontSize=19, textColor=GRUEN_TIEF, spaceAfter=2, leading=23)
h_sub = ParagraphStyle("s", parent=styles["Normal"], fontSize=10, textColor=GRAU, spaceAfter=2)
h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontName="Helvetica-Bold",
                    fontSize=12, textColor=GRUEN, spaceBefore=14, spaceAfter=6, leading=15)
label = ParagraphStyle("l", parent=styles["Normal"], fontSize=9, leading=12,
                       textColor=GRUEN_TIEF, spaceAfter=2)
note = ParagraphStyle("n", parent=styles["Normal"], fontSize=8.5, leading=11.5,
                      textColor=GRAU)
box_intro = ParagraphStyle("bi", parent=styles["Normal"], fontSize=9, leading=13,
                           textColor=GRUEN_TIEF)

_n = [0]


def _name(prefix):
    _n[0] += 1
    return "%s%d" % (prefix, _n[0])


class FieldText(Flowable):
    def __init__(self, height=15, multiline=False):
        super().__init__()
        self.height = height
        self.multiline = multiline
        self.w = 100

    def wrap(self, aw, ah):
        self.w = aw
        return (aw, self.height)

    def draw(self):
        self.canv.acroForm.textfield(
            name=_name("f"), x=0, y=0, width=self.w, height=self.height,
            borderWidth=0.7, borderColor=FELD_RAND, fillColor=FELD_FUELL,
            textColor=INK, fontName="Helvetica", fontSize=10, relative=True,
            forceBorder=True, fieldFlags="multiline" if self.multiline else "",
        )


class CheckRow(Flowable):
    def __init__(self, options, height=15):
        super().__init__()
        self.options = options
        self.height = height

    def wrap(self, aw, ah):
        self.w = aw
        return (aw, self.height)

    def draw(self):
        x = 0
        size = 11
        for opt in self.options:
            self.canv.acroForm.checkbox(
                name=_name("c"), x=x, y=1, size=size, buttonStyle="check",
                borderWidth=0.7, borderColor=FELD_RAND, fillColor=FELD_FUELL,
                textColor=INK, relative=True,
            )
            self.canv.setFont("Helvetica", 9.5)
            self.canv.setFillColor(INK)
            self.canv.drawString(x + size + 4, 3, opt)
            x += size + 8 + self.canv.stringWidth(opt, "Helvetica", 9.5) + 14


def infobox(text):
    t = Table([[Paragraph(text, box_intro)]], colWidths=[494])
    t.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.8, MESSING),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f3eddc")),
        ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


def feld(spec):
    """spec: ('t', label) | ('a', label, h) | ('cr', label, [opts]) | ('c', label)"""
    art = spec[0]
    flows = []
    if art == "t":
        flows = [Paragraph(spec[1], label), FieldText()]
    elif art == "a":
        flows = [Paragraph(spec[1], label), FieldText(height=spec[2], multiline=True)]
    elif art == "cr":
        flows = [Paragraph(spec[1], label), CheckRow(spec[2])]
    elif art == "c":
        flows = [CheckRow([spec[1]])]
    flows.append(Spacer(1, 7))
    return KeepTogether(flows)


SECTIONS = [
    ("1. Allgemeine Vereinsdaten", [
        ("t", "Vollständiger Vereinsname laut Satzung"),
        ("t", "Kurzname für die Kopfzeile (z. B. Anbauvereinigung Görlitz)"),
        ("t", "Sitz / Stadt"),
        ("t", "Vereinsregisternummer und zuständiges Amtsgericht"),
        ("t", "Erlaubnis nach § 11 KCanG: Aktenzeichen und Status (beantragt / erteilt)"),
        ("t", "Umsatzsteuer-Identifikationsnummer (falls vorhanden)"),
        ("cr", "Gewünschtes Design:", ["botanik", "klar", "warm", "nacht", "noch offen"]),
    ], None),
    ("2. Kontakt und Impressum", [
        ("t", "Straße und Hausnummer"),
        ("t", "PLZ und Ort"),
        ("t", "Öffentliche E-Mail-Adresse"),
        ("t", "Telefon und Erreichbarkeit (optional)"),
        ("t", "Vertretungsberechtigter Vorstand nach § 26 BGB"),
        ("a", "Inhaltlich verantwortliche Person mit Anschrift (für das Impressum)", 30),
    ], None),
    ("3. Vorstand und Projekt-Ansprechpartner", [
        ("a", "Vorstandsmitglieder mit Funktion, die genannt werden sollen", 36),
        ("t", "Hauptansprechpartner Projekt: Name"),
        ("t", "Hauptansprechpartner: E-Mail und Telefon"),
    ], None),
    ("4. Prävention und Beratung (Pflicht nach KCanG)", [
        ("t", "Präventionsbeauftragte Person: Name und Funktion (§ 23 KCanG)"),
        ("t", "Kontakt der präventionsbeauftragten Person"),
        ("a", "Regionale Sucht- und Beratungsstellen (Name, Telefon, Webadresse)", 36),
    ], None),
    ("5. Pflichtdokumente (bitte als PDF beilegen)", [
        ("c", "Satzung"),
        ("c", "Beitragsordnung"),
        ("c", "Gesundheitskonzept"),
        ("c", "Jugendschutzkonzept"),
        ("c", "Optional: Hausordnung / Aufnahmeantrag"),
    ], None),
    ("6. Aufnahmeverfahren", [
        ("a", "Besonderheiten oder Abweichungen vom gesetzlichen Standardablauf", 30),
        ("t", "Wie und wohin werden Aufnahmeanträge eingereicht?"),
    ], None),
    ("7. Anbau und Sorten (rein sachlich)", [
        ("a", "Sorten mit Bezeichnung, Herkunft, THC-Gehalt und CBD-Gehalt", 48),
    ], "Hinweis: Es sind ausschließlich objektive Angaben zulässig, keine anpreisenden "
       "oder wertenden Beschreibungen (KCanG-Werbeverbot)."),
    ("8. Mitgliederbereich (intern, hinter Login)", [
        ("cr", "Gewünschte Inhalte:", ["Mitteilungen", "Termine", "Dokumente"]),
        ("t", "Wer pflegt die Inhalte künftig selbst (Name / Rolle)"),
    ], "Die ersten Mitgliederzugänge legt der Vorstand selbst an. Mitgliederdaten werden "
       "vertraulich und DSGVO-konform verarbeitet."),
    ("9. Domain, E-Mail und Technik", [
        ("t", "Wunsch-Domain für diesen Verein (z. B. anbauvereinigung-name.de)"),
        ("t", "Domain bereits vorhanden? Wenn ja: wer verwaltet sie (Registrar/Zugang)?"),
        ("t", "Gewünschte E-Mail-Adressen (z. B. kontakt@, prävention@)"),
        ("t", "Hosting-Wunsch (Empfehlung: Server in Deutschland/EU)"),
    ], None),
    ("10. Logo und Markenmaterial", [
        ("cr", "Logo liegt bei als:", ["SVG", "EPS", "AI", "PDF", "PNG", "folgt"]),
        ("t", "Vorhandene Hausfarben / Corporate Design (HEX-Werte)"),
        ("t", "Schrift-Wünsche (falls vorhanden)"),
        ("cr", "Neutrale Fotos (Vereinsraum, Team):", ["liegen bei", "folgen", "keine"]),
    ], "Wichtig (KCanG): Logo und Bilder müssen sachlich bleiben. Keine konsumfördernden, "
       "verherrlichenden oder werbenden Motive (z. B. keine inszenierten Cannabis-Bilder)."),
    ("11. Rechtliches und Freigaben", [
        ("t", "Wer prüft die Datenschutzerklärung juristisch?"),
        ("t", "Datenschutzbeauftragte Person (falls benannt)"),
        ("t", "Auftragsverarbeitung (AVV) mit Hostern: Zuständigkeit"),
        ("t", "Inhaltliche Freigabe der fertigen Seite durch"),
    ], None),
]

story = []
story.append(Paragraph("Checkliste: Informationen und Material für Ihre Vereinsseite", h_title))
story.append(Paragraph("Anbauvereinigungs-Website nach KCanG · ausfüllbar · Stand 16.06.2026", h_sub))
story.append(Spacer(1, 4))
story.append(HRFlowable(width="100%", thickness=1, color=MESSING, spaceAfter=10))

story.append(infobox(
    "Bitte pro Verein einmal ausfüllen. Sie können direkt in die Felder tippen und das PDF "
    "gespeichert zurücksenden, oder es ausdrucken und handschriftlich ausfüllen. Nicht alles "
    "muss sofort vorliegen, fehlende Punkte reichen wir nach. Vorschau der vier Designs: "
    "bombastix-byte.github.io/canna-vereine/ (Adresse um ?theme=botanik, ?theme=klar, "
    "?theme=warm oder ?theme=nacht ergänzbar)."
))
story.append(Spacer(1, 10))

# Kopfzeilen-Felder
for s in [("t", "Verein"), ("t", "Ausgefüllt von"), ("t", "Datum")]:
    story.append(feld(s))

for titel, items, hinweis in SECTIONS:
    block = [Paragraph(titel, h2)]
    story.append(KeepTogether(block))
    for it in items:
        story.append(feld(it))
    if hinweis:
        story.append(Paragraph(hinweis, note))
        story.append(Spacer(1, 6))

story.append(Spacer(1, 10))
story.append(HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#d9ddd9"), spaceAfter=6))
story.append(Paragraph(
    "Fragen jederzeit an Ihren Projektkontakt. Sobald die Daten vorliegen, pflegen wir sie ein.",
    note))


def fuss(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(GRAU)
    canvas.drawString(50, 25, "Anbauvereinigungs-Website · Onboarding-Checkliste")
    canvas.drawRightString(A4[0] - 50, 25, "Seite %d" % doc.page)
    canvas.restoreState()


doc = SimpleDocTemplate(
    "Onboarding-Checkliste.pdf", pagesize=A4,
    leftMargin=50, rightMargin=50, topMargin=46, bottomMargin=42,
    title="Onboarding-Checkliste Anbauvereinigungs-Website",
    author="Website-Projekt Anbauvereinigungen",
)
doc.build(story, onFirstPage=fuss, onLaterPages=fuss)
print("Formular-PDF erzeugt: Onboarding-Checkliste.pdf")
