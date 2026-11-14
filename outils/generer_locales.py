"""Génère extension/locales/*.json à partir du script de la page de test et de la table ci-dessous.

Usage : python outils/generer_locales.py <HackathonTest-xxxx.js> extension/locales

- fr et en viennent du code de la page (textes exacts).
- basaa vient de bassa.txt, les traductions du locuteur reçues le 14 novembre 2026 : une ligne
  « numéro - texte » par phrase de liste-traduction-basaa.txt. Voir la section BASAA plus bas
  pour les seules retouches faites (valeurs remises en variables, nom « Safinum Pay »).
- eton vient de liste-traduction-eton.txt, la copie du cahier du locuteur (14 novembre 2026) :
  lignes « Éton : » sous chaque phrase, mêmes numéros que la liste bàsàa. Voir la section ETON.
"""
import json, os, re, sys, unicodedata

js_path, out_dir = sys.argv[1:3]
s = open(js_path, encoding="utf-8").read()
STR = r'"((?:[^"\\]|\\.)*)"'
un = lambda v: json.loads('"' + v + '"')

a = s.find('brand:"Safinum Pay"')
b = s.find('}});function mt()')
ui = s[a:b]
pairs = {}
for m in re.finditer(r'(\w+):r\?' + STR + ':' + STR, ui):
    pairs.setdefault(m.group(1), []).append((un(m.group(2)), un(m.group(3))))
labels, dates = pairs.pop("label"), pairs.pop("date")
steps = labels[:4] + [("Confirmation", "Confirmation")]
tx = labels[4:]
ops = [tuple(un(x) for x in t) for t in re.findall(
    r'labelFr:' + STR + ',labelEn:' + STR + ',descriptionFr:' + STR + ',descriptionEn:' + STR, s)]
errs = [tuple(un(x) for x in t) for t in re.findall(r'code:' + STR + ',messageFr:' + STR + ',messageEn:' + STR, s)]
assert len(steps) == 5 and len(tx) == 4 and len(ops) == 3 and len(errs) == 7

fr, en = {}, {}
def add(key, f, e):
    fr[key], en[key] = f, e
for i, (f, e) in enumerate(steps, 1):
    add(f"steps.{i}", f, e)
for key, vals in pairs.items():
    f, e = vals[0]
    if key == "hello":
        f, e = f + ", {prenom}", e + ", {prenom}"
    elif key == "accountNumberLabel":
        f, e = f + " : {numero_compte}", e + " : {numero_compte}"
    add(key, f, e)
for i, (f, e) in enumerate(tx, 1):
    add(f"transactions.{i}", f, e)
for oid, (lf, le, df, de) in zip(["safinum", "mobile_money", "other_bank"], ops):
    add(f"operation.{oid}.label", lf, le)
add("operation.safinum.description", ops[0][2], ops[0][3])
add("operation.fee_description", "Frais de {taux} % (min. {min} FCFA, max. {max} FCFA)",
    "{taux}% fee (min. {min} FCFA, max. {max} FCFA)")
for code, f, e in errs:
    add(f"error.{code}", f, e)

# ---------- BASAA : traductions du locuteur (bassa.txt) ----------
RACINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
norm = lambda t: re.sub(r"\s+", " ", unicodedata.normalize("NFC", t).replace("’", "'")).strip()

# numéro -> phrase française de la liste envoyée au traducteur
liste, numero = {}, None
for ligne in open(os.path.join(RACINE, "liste-traduction-basaa.txt"), encoding="utf-8"):
    m = re.match(r"^(\d+)\. \(", ligne)
    if m:
        numero = int(m.group(1))
    m = re.match(r"^\s+Français : (.*)$", ligne)
    if m and numero:
        liste[numero] = norm(m.group(1))

# numéro -> texte bàsàa ; une ligne sans numéro continue la précédente
reponses, numero = {}, None
for ligne in open(os.path.join(RACINE, "bassa.txt"), encoding="utf-8-sig"):
    m = re.match(r"^\s*(\d+)\s*-\s*(.*)$", ligne)
    if m:
        numero = int(m.group(1))
        reponses[numero] = m.group(2)
    elif numero and ligne.strip():
        reponses[numero] += " " + ligne
reponses = {n: norm(t) for n, t in reponses.items()}
assert sorted(reponses) == sorted(liste) == list(range(1, 73)), "bassa.txt doit avoir les 72 phrases"

# Retouches, toutes pour respecter « ne jamais modifier un nom ou une valeur » :
#  - 13 : le locuteur a écrit « Safinum pay » ; le nom de l'application est rétabli ;
#  - 25, 26 : le prénom et le numéro de compte redeviennent des variables, recopiées depuis la page ;
#  - 40 : idem pour le taux et les bornes. Le locuteur a écrit « 15% », « fcfa 100 » et « fcfa 2.500 »
#    pour « 1,5 % », « 100 FCFA » et « 2 500 FCFA » : son ordre des mots est gardé (FCFA avant le
#    nombre), les chiffres viennent de la page et « FCFA » reste en capitales.
assert "Safinum pay" in reponses[13] and "Amina" in reponses[25] and "CM 001 2345 6789 01" in reponses[26]
assert reponses[40] == "Disii di mapémés 15% (ndég yosô fcfa 100 ; ngandag yosô fcfa 2.500)", reponses[40]
reponses[13] = reponses[13].replace("Safinum pay", "Safinum Pay")
BASAA = {liste[n]: reponses[n] for n in liste}
BASAA["Bonjour, {prenom}"] = reponses[25].replace("Amina", "{prenom}")
BASAA["Numéro de compte : {numero_compte}"] = reponses[26].replace("CM 001 2345 6789 01", "{numero_compte}")
BASAA["Frais de {taux} % (min. {min} FCFA, max. {max} FCFA)"] = \
    "Disii di mapémés {taux} % (ndég yosô FCFA {min} ; ngandag yosô FCFA {max})"

# ---------- ETON : traductions du locuteur (liste-traduction-eton.txt) ----------
eton_fr, eton_rep, numero = {}, {}, None
for ligne in open(os.path.join(RACINE, "liste-traduction-eton.txt"), encoding="utf-8-sig"):
    ligne = unicodedata.normalize("NFC", ligne)
    m = re.match(r"^\s*(\d+)\. Français : (.*)$", ligne)
    if m:
        numero = int(m.group(1))
        eton_fr[numero] = norm(m.group(2))
        continue
    m = re.match(r"^\s+Éton : (.*)$", ligne)
    if m and numero:
        # « [?] » marque une ligne où la copie du cahier est incertaine : ce n'est pas du texte
        eton_rep[numero] = norm(m.group(1).replace("[?]", ""))
        numero = None
assert sorted(eton_rep) == list(range(1, 73)), "liste-traduction-eton.txt doit avoir les 72 phrases"
assert all(eton_rep.values()), [n for n, t in eton_rep.items() if not t]
# mêmes numéros que la liste bàsàa (la 13 est donnée sans « Safinum Pay — » dans la liste éton)
for n in liste:
    assert eton_fr[n].startswith(liste[n]) or (n == 13 and liste[n].lower().endswith(eton_fr[n].lower())), (n, eton_fr[n])

# Retouches, de même nature que pour le bàsàa :
#  - 13 : la liste éton ne portait pas le nom de l'application ; « Safinum Pay — » est remis devant ;
#  - 25, 26, 40 : prénom, numéro de compte, taux et bornes redeviennent des variables. Le cahier ne
#    donne que le libellé pour la 26 (« nɔ̀mbá a cɔntə ») : le numéro est recopié après « : » ;
#  - 37 : « Mobile money » → « Mobile Money », nom du service tel que la page l'écrit ;
#  - 51 : le cahier propose « telefon / ŋ̀kual lɔŋní » ; la première proposition est gardée.
assert "Amina" in eton_rep[25] and eton_rep[26] == "nɔ̀mbá a cɔntə" and eton_rep[37] == "Mobile money"
assert eton_rep[40] == "tàŋ i 1,5 % (àsí 100 FCFA, adɔp 2 500 FCFA)", eton_rep[40]
assert eton_rep[51] == "telefon / ŋ̀kual lɔŋní", eton_rep[51]
eton_rep[13] = "Safinum Pay — " + eton_rep[13]
eton_rep[37] = "Mobile Money"
eton_rep[51] = "telefon"
ETON = {liste[n]: eton_rep[n] for n in liste}
ETON["Bonjour, {prenom}"] = eton_rep[25].replace("Amina", "{prenom}")
ETON["Numéro de compte : {numero_compte}"] = eton_rep[26] + " : {numero_compte}"
ETON["Frais de {taux} % (min. {min} FCFA, max. {max} FCFA)"] = "tàŋ i {taux} % (àsí {min} FCFA, adɔp {max} FCFA)"

basaa, eton = {}, {}
for table, source in ((basaa, BASAA), (eton, ETON)):
    missing = sorted({f for f in fr.values() if norm(f) not in source and f != "Safinum Pay"})
    assert not missing, missing
    for key, f in fr.items():
        table[key] = f if f == "Safinum Pay" else source[norm(f)]

# une variable présente dans la source doit l'être dans chaque langue
for key, f in fr.items():
    vars_ = set(re.findall(r"\{(\w+)\}", f))
    for name, table in (("en", en), ("basaa", basaa), ("eton", eton)):
        assert set(re.findall(r"\{(\w+)\}", table[key])) == vars_, (name, key)
        assert table[key].strip(), (name, key)

index = {
    "schemaVersion": 1,
    "description": "Liste des langues et règles de correspondance. Chaque langue est un fichier clé → texte ; toutes les langues ont exactement les mêmes clés. Une valeur null signifie : pas encore d'équivalent, le texte de la page n'est pas remplacé.",
    "languesSource": ["fr", "en"],
    "langues": [
        {"code": "fr", "nom": "Français", "fichier": "fr.json", "voix": "fr-FR", "statut": "source"},
        {"code": "en", "nom": "English", "fichier": "en.json", "voix": "en-US", "statut": "source"},
        {"code": "basaa", "nom": "Bàsàa", "fichier": "basaa.json", "audio": "audio/basaa.json",
         "statut": "Traductions fournies par le locuteur bàsàa le 14 novembre 2026."},
        {"code": "eton", "nom": "Éton", "fichier": "eton.json", "audio": "audio/eton.json",
         "statut": "Traductions du locuteur éton, copiées de son cahier le 14 novembre 2026."},
    ],
    "variables": {
        "prenom": "\\p{Lu}[\\p{L}'’-]*(?: \\p{Lu}[\\p{L}'’-]*){0,3}",
        "numero_compte": "[A-Z0-9][A-Z0-9 ]{3,40}",
        "taux": "[0-9]+(?:[.,][0-9]+)?",
        "min": "[0-9][0-9 \\u00A0\\u202F.,]*",
        "max": "[0-9][0-9 \\u00A0\\u202F.,]*",
    },
    "attributsTraduits": ["aria-label", "title", "placeholder", "alt"],
}
os.makedirs(out_dir, exist_ok=True)
def dump(name, obj):
    with open(os.path.join(out_dir, name), "w", encoding="utf-8", newline="\n") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write("\n")
dump("index.json", index)
for name, table in (("fr", fr), ("en", en), ("basaa", basaa), ("eton", eton)):
    dump(name + ".json", table)
print(len(fr), "cles par langue,", len(set(fr.values())), "textes francais uniques")
