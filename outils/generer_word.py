# Convertit les livrables Markdown (livrables/*.md) en documents Word (livrables/*.docx).
# Usage : python outils/generer_word.py        (demande la bibliothèque python-docx)
# Les .md restent la source : corriger le .md puis relancer ce script.
import glob
import os
import re

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

RACINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
VERT, EBENE, GRIS = RGBColor(0x00, 0x7A, 0x5E), RGBColor(0x1C, 0x14, 0x10), RGBColor(0x55, 0x4A, 0x43)
POLICE = "Calibri"

# gras, code, lien ou adresse entre chevrons
INLINE = re.compile(r"(\*\*.+?\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|<https?://[^>]+>|\*[^*\s][^*]*\*)")


def police(run, taille=None, gras=None, italique=None, couleur=None, nom=POLICE):
    run.font.name = nom
    run._element.rPr.rFonts.set(qn("w:eastAsia"), nom)
    if taille:
        run.font.size = Pt(taille)
    if gras is not None:
        run.bold = gras
    if italique is not None:
        run.italic = italique
    if couleur is not None:
        run.font.color.rgb = couleur


def ecrire(paragraphe, texte, taille=None, gras=None, couleur=None):
    """Ajoute un texte Markdown en ligne (gras, italique, code, liens) à un paragraphe."""
    for morceau in INLINE.split(texte):
        if not morceau:
            continue
        if morceau.startswith("**"):
            police(paragraphe.add_run(morceau[2:-2]), taille, True, couleur=couleur)
        elif morceau.startswith("`"):
            police(paragraphe.add_run(morceau[1:-1]), (taille or 11) - 1, gras, couleur=couleur, nom="Consolas")
        elif morceau.startswith("["):
            libelle, cible = re.match(r"\[([^\]]+)\]\(([^)]+)\)", morceau).groups()
            # un lien vers un fichier du dépôt devient son nom ; une adresse web est gardée entre parenthèses
            police(paragraphe.add_run(libelle if not cible.startswith("http") else f"{libelle} ({cible})"), taille, gras, couleur=couleur)
        elif morceau.startswith("<http"):
            police(paragraphe.add_run(morceau[1:-1]), taille, gras, couleur=couleur)
        elif morceau.startswith("*"):
            police(paragraphe.add_run(morceau[1:-1]), taille, gras, True, couleur)
        else:
            police(paragraphe.add_run(morceau), taille, gras, couleur=couleur)


def fond(cellule, hexa):
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hexa)
    cellule._element.get_or_add_tcPr().append(shd)


def tableau(doc, lignes):
    cellules = [[c.strip() for c in l.strip().strip("|").split("|")] for l in lignes]
    entete, corps = cellules[0], cellules[2:]
    n = len(entete)
    table = doc.add_table(rows=1, cols=n)
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    # largeurs proportionnelles à la longueur des textes, bornées, sur 16 cm utiles
    poids = [max(8, min(60, max(len(r[i]) if i < len(r) else 0 for r in [entete] + corps))) for i in range(n)]
    largeurs = [Cm(16 * p / sum(poids)) for p in poids]
    for i, texte in enumerate(entete):
        c = table.rows[0].cells[i]
        c.width = largeurs[i]
        fond(c, "1C1410")
        c.paragraphs[0].paragraph_format.space_after = Pt(2)
        ecrire(c.paragraphs[0], texte, 10, True, RGBColor(0xFF, 0xFF, 0xFF))
    for r, ligne in enumerate(corps):
        cells = table.add_row().cells
        for i in range(n):
            cells[i].width = largeurs[i]
            if r % 2:
                fond(cells[i], "F6F1E4")
            cells[i].paragraphs[0].paragraph_format.space_after = Pt(2)
            ecrire(cells[i].paragraphs[0], ligne[i] if i < len(ligne) else "", 10)
    # la ligne d'en-tête se répète en haut de chaque page
    tr = table.rows[0]._tr.get_or_add_trPr()
    rep = OxmlElement("w:tblHeader")
    rep.set(qn("w:val"), "true")
    tr.append(rep)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def convertir(source, cible):
    doc = Document()
    section = doc.sections[0]
    section.page_width, section.page_height = Cm(21), Cm(29.7)
    section.left_margin = section.right_margin = Cm(2.5)
    section.top_margin = section.bottom_margin = Cm(2.2)
    normal = doc.styles["Normal"]
    normal.font.name, normal.font.size = POLICE, Pt(11)
    normal.element.rPr.rFonts.set(qn("w:eastAsia"), POLICE)
    normal.paragraph_format.space_after = Pt(7)
    normal.paragraph_format.line_spacing = 1.12
    for nom, taille, couleur, avant in (("Title", 24, EBENE, 0), ("Heading 1", 16, VERT, 16), ("Heading 2", 13, EBENE, 12), ("Heading 3", 11.5, VERT, 10)):
        st = doc.styles[nom]
        st.font.name, st.font.size, st.font.bold, st.font.color.rgb = POLICE, Pt(taille), True, couleur
        st.element.rPr.rFonts.set(qn("w:eastAsia"), POLICE)
        st.element.rPr.rFonts.set(qn("w:ascii"), POLICE)
        st.element.rPr.rFonts.set(qn("w:hAnsi"), POLICE)
        st.paragraph_format.space_before, st.paragraph_format.space_after = Pt(avant), Pt(6)
        st.paragraph_format.keep_with_next = True

    pied = section.footer.paragraphs[0]
    pied.alignment = WD_ALIGN_PARAGRAPH.CENTER
    police(pied.add_run("Alliance — SAFINUM Innovate Challenge, épreuve de présélection"), 8.5, couleur=GRIS)

    lignes = open(source, encoding="utf-8").read().split("\n")
    i = 0
    while i < len(lignes):
        l = lignes[i]
        if not l.strip():
            i += 1
        elif l.startswith("```"):
            i += 1
            while i < len(lignes) and not lignes[i].startswith("```"):
                p = doc.add_paragraph()
                p.paragraph_format.space_after = Pt(0)
                p.paragraph_format.left_indent = Cm(0.6)
                police(p.add_run(lignes[i] or " "), 8, nom="Consolas")
                i += 1
            i += 1
            doc.add_paragraph().paragraph_format.space_after = Pt(2)
        elif l.startswith("|"):
            bloc = []
            while i < len(lignes) and lignes[i].startswith("|"):
                bloc.append(lignes[i])
                i += 1
            tableau(doc, bloc)
        elif re.match(r"^#{1,4} ", l):
            niveau = len(l.split(" ")[0])
            texte = l[niveau + 1:].strip()
            if niveau == 1:
                p = doc.add_paragraph(style="Title")
                ecrire(p, texte, 24, True, EBENE)
                # filet aux couleurs du projet sous le titre
                bord = OxmlElement("w:pBdr")
                bas = OxmlElement("w:bottom")
                for k, v in (("val", "single"), ("sz", "18"), ("space", "4"), ("color", "FCD116")):
                    bas.set(qn(f"w:{k}"), v)
                bord.append(bas)
                p._element.get_or_add_pPr().append(bord)
            else:
                p = doc.add_paragraph(style=f"Heading {niveau - 1}")
                ecrire(p, texte)
            i += 1
        elif re.match(r"^\s*- \[[ x]\] ", l):
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Cm(0.6)
            p.paragraph_format.space_after = Pt(3)
            ecrire(p, ("☑ " if "[x]" in l[:8] else "☐ ") + re.sub(r"^\s*- \[[ x]\] ", "", l))
            i += 1
        elif re.match(r"^\s*- ", l):
            p = doc.add_paragraph(style="List Bullet")
            p.paragraph_format.space_after = Pt(3)
            ecrire(p, re.sub(r"^\s*- ", "", l))
            i += 1
        elif re.match(r"^\s*\d+\. ", l):
            p = doc.add_paragraph(style="List Number")
            p.paragraph_format.space_after = Pt(3)
            ecrire(p, re.sub(r"^\s*\d+\. ", "", l))
            i += 1
        else:
            ecrire(doc.add_paragraph(), l.strip())
            i += 1
    doc.core_properties.title = next((x[2:].strip() for x in lignes if x.startswith("# ")), "Alliance")
    doc.core_properties.author = "Alliance"
    doc.save(cible)


for source in sorted(glob.glob(os.path.join(RACINE, "livrables", "*.md"))):
    cible = source[:-3] + ".docx"
    convertir(source, cible)
    print("écrit :", os.path.relpath(cible, RACINE))
