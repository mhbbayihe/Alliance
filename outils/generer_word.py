# Convertit les livrables Markdown (livrables/*.md) en documents Word (livrables/*.docx).
# Usage : python outils/generer_word.py [dossier de sortie]   (demande la bibliothèque python-docx)
# Les .md restent la source : corriger le .md puis relancer ce script.
#
# Mise en page demandée par l'utilisateur (14 novembre 2026) : une seule couleur (noir), une seule
# police, grands titres en 14, petits titres et texte en 12, tableaux sobres et rares.
import glob
import os
import re
import sys

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

RACINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
NOIR = RGBColor(0, 0, 0)
POLICE = "Times New Roman"
GRAND, PETIT = 14, 12

# gras, code, lien ou adresse entre chevrons, italique
INLINE = re.compile(r"(\*\*.+?\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|<https?://[^>]+>|\*[^*\s][^*]*\*)")


def police(run, taille=PETIT, gras=None, italique=None):
    run.font.name = POLICE
    rfonts = run._element.get_or_add_rPr().get_or_add_rFonts()
    for attribut in ("w:ascii", "w:hAnsi", "w:eastAsia", "w:cs"):
        rfonts.set(qn(attribut), POLICE)
    run.font.size = Pt(taille)
    run.font.color.rgb = NOIR
    if gras is not None:
        run.bold = gras
    if italique is not None:
        run.italic = italique


def ecrire(paragraphe, texte, taille=PETIT, gras=None):
    """Ajoute un texte Markdown en ligne (gras, italique, noms de fichiers, liens) à un paragraphe."""
    for morceau in INLINE.split(texte):
        if not morceau:
            continue
        if morceau.startswith("**"):
            police(paragraphe.add_run(morceau[2:-2]), taille, True)
        elif morceau.startswith("`"):
            # nom de fichier ou commande : même police, sans mise en forme particulière
            police(paragraphe.add_run(morceau[1:-1]), taille, gras)
        elif morceau.startswith("["):
            libelle, cible = re.match(r"\[([^\]]+)\]\(([^)]+)\)", morceau).groups()
            police(paragraphe.add_run(libelle if not cible.startswith("http") else f"{libelle} ({cible})"), taille, gras)
        elif morceau.startswith("<http"):
            police(paragraphe.add_run(morceau[1:-1]), taille, gras)
        elif morceau.startswith("*"):
            police(paragraphe.add_run(morceau[1:-1]), taille, gras, True)
        else:
            police(paragraphe.add_run(morceau), taille, gras)


def paragraphe(doc, avant=0, apres=6, alignement=WD_ALIGN_PARAGRAPH.JUSTIFY, retrait=0, premiere=0, lie=False):
    p = doc.add_paragraph()
    f = p.paragraph_format
    f.space_before, f.space_after = Pt(avant), Pt(apres)
    f.alignment = alignement
    f.left_indent, f.first_line_indent = Cm(retrait), Cm(premiere)
    f.keep_with_next = lie
    return p


def tableau(doc, lignes):
    cellules = [[c.strip() for c in l.strip().strip("|").split("|")] for l in lignes]
    entete, corps = cellules[0], cellules[2:]
    n = len(entete)
    table = doc.add_table(rows=1, cols=n)
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    # largeurs proportionnelles à la longueur des textes, bornées, sur 16 cm utiles
    poids = [max(10, min(50, max(len(r[i]) if i < len(r) else 0 for r in [entete] + corps))) for i in range(n)]
    largeurs = [Cm(16 * p / sum(poids)) for p in poids]
    for r, ligne in enumerate([entete] + corps):
        cells = table.rows[0].cells if r == 0 else table.add_row().cells
        for i in range(n):
            cells[i].width = largeurs[i]
            p = cells[i].paragraphs[0]
            p.paragraph_format.space_before = p.paragraph_format.space_after = Pt(2)
            ecrire(p, ligne[i] if i < len(ligne) else "", PETIT, True if r == 0 else None)
    # la ligne d'en-tête se répète en haut de chaque page
    rep = OxmlElement("w:tblHeader")
    rep.set(qn("w:val"), "true")
    table.rows[0]._tr.get_or_add_trPr().append(rep)
    paragraphe(doc, apres=4)


def numero_de_page(p):
    run = p.add_run()
    police(run, 10)
    for genre, texte in (("begin", None), (None, "PAGE"), ("end", None)):
        if genre:
            e = OxmlElement("w:fldChar")
            e.set(qn("w:fldCharType"), genre)
        else:
            e = OxmlElement("w:instrText")
            e.set(qn("xml:space"), "preserve")
            e.text = texte
        run._element.append(e)


def convertir(source, cible):
    doc = Document()
    section = doc.sections[0]
    section.page_width, section.page_height = Cm(21), Cm(29.7)
    section.left_margin = section.right_margin = Cm(2.5)
    section.top_margin = section.bottom_margin = Cm(2.5)
    normal = doc.styles["Normal"]
    normal.font.name, normal.font.size, normal.font.color.rgb = POLICE, Pt(PETIT), NOIR
    for attribut in ("w:ascii", "w:hAnsi", "w:eastAsia", "w:cs"):
        normal.element.get_or_add_rPr().get_or_add_rFonts().set(qn(attribut), POLICE)
    normal.paragraph_format.line_spacing = 1.15

    pied = section.footer.paragraphs[0]
    pied.alignment = WD_ALIGN_PARAGRAPH.CENTER
    police(pied.add_run("Alliance, SAFINUM Innovate Challenge, page "), 10)
    numero_de_page(pied)

    lignes = open(source, encoding="utf-8").read().split("\n")
    i, entete = 0, False
    while i < len(lignes):
        l = lignes[i]
        if not l.strip():
            entete = False
            i += 1
        elif l.startswith("|"):
            bloc = []
            while i < len(lignes) and lignes[i].startswith("|"):
                bloc.append(lignes[i])
                i += 1
            tableau(doc, bloc)
        elif re.match(r"^#{1,3} ", l):
            niveau = len(l.split(" ")[0])
            texte = l[niveau + 1:].strip()
            if niveau == 1:
                # titre du document : 14, gras, centré ; les lignes qui suivent forment l'en-tête
                ecrire(paragraphe(doc, apres=6, alignement=WD_ALIGN_PARAGRAPH.CENTER), texte, GRAND, True)
                entete = True
                i += 1
                while i < len(lignes) and not lignes[i].strip():
                    i += 1
                while i < len(lignes) and lignes[i].strip() and not lignes[i].startswith("#"):
                    ecrire(paragraphe(doc, apres=0, alignement=WD_ALIGN_PARAGRAPH.CENTER), lignes[i].strip())
                    i += 1
                paragraphe(doc, apres=6)
                continue
            if niveau == 2:
                ecrire(paragraphe(doc, avant=14, apres=6, alignement=WD_ALIGN_PARAGRAPH.LEFT, lie=True), texte, GRAND, True)
            else:
                ecrire(paragraphe(doc, avant=10, apres=4, alignement=WD_ALIGN_PARAGRAPH.LEFT, lie=True), texte, PETIT, True)
            i += 1
        elif re.match(r"^\s*- ", l):
            p = paragraphe(doc, apres=3, retrait=1.0, premiere=-0.5)
            ecrire(p, "•\t" + re.sub(r"^\s*- ", "", l))
            p.paragraph_format.tab_stops.add_tab_stop(Cm(1.0))
            i += 1
        elif re.match(r"^\s*\d+\. ", l):
            # numéro écrit en clair : chaque liste repart de 1
            m = re.match(r"^\s*(\d+)\. (.*)$", l)
            p = paragraphe(doc, apres=3, retrait=1.0, premiere=-0.6)
            ecrire(p, f"{m.group(1)}.\t{m.group(2)}")
            p.paragraph_format.tab_stops.add_tab_stop(Cm(1.0))
            i += 1
        else:
            ecrire(paragraphe(doc), l.strip())
            i += 1
    doc.core_properties.title = next((x[2:].strip() for x in lignes if x.startswith("# ")), "Alliance")
    doc.core_properties.author = "Alliance"
    doc.save(cible)


for source in sorted(glob.glob(os.path.join(RACINE, "livrables", "*.md"))):
    # dossier de sortie facultatif en argument (utile quand les .docx sont ouverts dans Word)
    cible = os.path.join(sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(source), os.path.basename(source)[:-3] + ".docx")
    convertir(source, cible)
    print("écrit :", os.path.relpath(cible, RACINE))
