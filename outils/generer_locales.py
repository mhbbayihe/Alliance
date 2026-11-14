"""Génère extension/locales/*.json à partir du script de la page de test et de la table ci-dessous.

Usage : python outils/generer_locales.py <HackathonTest-xxxx.js> extension/locales

- fr et en viennent du code de la page (textes exacts).
- basaa vient de bassa.txt, les traductions du locuteur reçues le 14 novembre 2026 : une ligne
  « numéro - texte » par phrase de liste-traduction-basaa.txt. Voir la section BASAA plus bas
  pour les seules retouches faites (valeurs remises en variables, nom « Safinum Pay »).
- eton vient du document de travail fourni par l'utilisateur le 13 novembre 2026
  (SAFINUM_Pay_document_traduit_Eton.docx), table ETON_DOC plus bas. Une valeur None
  signifie « pas d'équivalent établi » : le texte reste alors dans la langue de la page.
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

# Éton : équivalents du document de travail du 13 novembre 2026, repris tels quels.
# Règles de reprise :
#  - un mot laissé entre crochets dans le document (pas d'équivalent éton établi) est gardé
#    en français, sans les crochets ;
#  - une ligne entièrement entre crochets, absente du document, ou donnée seulement comme
#    description ou résumé de la phrase -> None (le texte de la page n'est pas remplacé) ;
#  - les remarques du document (« à vérifier », « formulation à confirmer ») sont retirées.
ETON_DOC = {
"Environnement de test — données fictives, aucune transaction réelle.": "Test — mɔ̀ní fictif ; lóm mɔ̀ní réel : non",
"Protocole de test": "Test protocole",
"Retour au hackathon": "Mbous hackathon",
"Banque en ligne": "Ndabwani",
"Solde": "Mɔ̀ní à reste",
"Frais": "Táŋ",
"Bénéficiaire": "Waa bee mwani",
"Récapitulatif": "Dame ou ce",                      # à confirmer selon le document
"Confirmation": "Kenny",
"Votre compte": "Kɔ̀ntɛ́ wɛ̀",                         # « votre » à vérifier selon le document
"Compte courant": "Kɔ̀ntɛ́ courant",
"Solde disponible": "Mɔ̀ní à reste là",
"Sécurité": "Yen",
"Vérifiez toujours le nom et le numéro du bénéficiaire avant de confirmer un transfert.":
    "Yengan Doe numéro Amour. Ouais, Bemwani.",    # à confirmer selon le document
"Connexion sécurisée": "Connexion yo — Anitoun",   # à confirmer selon le document
"Bonjour, {prenom}": "Mbolo, {prenom}",
"Consultez votre solde et lancez un transfert en toute sécurité.": "Yen mɔ̀ní à reste ; lóm mɔ̀ní en sécurité",
"Numéro de compte : {numero_compte}": "Numéro kɔ̀ntɛ́ : {numero_compte}",
"Effectuer un transfert": "Lóm mɔ̀ní",
"Consulter les frais": "Yen táŋ",
"Transactions récentes": "Mwani Melouma",
"Salaire reçu": "Mɔ̀ní ou bè",
"Transfert reçu": "Mɔ̀ní reçu",
"Frais de transfert": "Táŋ lóm mɔ̀ní",
"Choisissez le type de transfert et le montant. Les frais sont calculés automatiquement.":
    "Choisir type lóm mɔ̀ní, mɔ̀ní. Táŋ : automatique",
"Type d'opération": "Type lóm mɔ̀ní",
"Compte Safinum": "Kɔ̀ntɛ́ Safinum",
"Mobile Money": "Mobile Money",
"Autre banque": "Nda money",
"Transfert instantané et gratuit": "Lóm mɔ̀ní vite ; táŋ aucun",
"Montant à envoyer": "Mɔ̀ní lóm",
"Total à débiter": "Mwani à PAM",
"Retour": "Mbous",
"Nom du bénéficiaire": "Nom Waa bee mwani",
"Motif du transfert": "Motif lóm mɔ̀ní",
"Vérifiez les informations avant de confirmer le transfert.": "Yen informations, bɛ́ confirmer lóm mɔ̀ní",
"Montant": "Mɔ̀ní",
"Total débité": "Mwani PAM",
"Confirmer le transfert": "Kenny lóm mɔ̀ní",
"Transfert effectué": "Lóm mɔ̀ní fait",
"Votre transfert a été envoyé avec succès.": "Mɔ̀ní wɛ̀ lóm fait, succès",
"Nouveau transfert": "Nouveau lóm mɔ̀ní",
}

# Éton : textes absents du document, composés par Claude le 13 novembre 2026 à la demande de
# l'utilisateur, à partir de l'index français-éton du dictionnaire (Van de Velde et Essele
# Essele, 2022) et du vocabulaire du document (Yen, Kenny, Waa bee mwani, lóm mɔ̀ní, Táŋ,
# Kɔ̀ntɛ́, Mɔ̀ní à reste, bɛ́). Style volontairement court, sans accords ni pronoms, car le
# dictionnaire ne donne que des mots isolés. NON VALIDÉS par un locuteur.
# Mots du dictionnaire utilisés : mbə́mí avertissement, ù-kálá attention, ŋm̀-kpámgí nouveau,
# á à/dans, nwàmɔ̀ numéro, d-ǒy nom, èè et/avec, kə̀ èè poursuivre, ì-tɔ̀m problème, ì-yóm service,
# jə́mnì être absent, və̀glà essayer, báglâ répéter, kálâdà papier, m̀-pyà lumière, pɛ̀d fermer,
# á pûpùd pour rien, màn finir, pɔ́ nouvelle/information, ŋ̀-ŋə́mdə́ correct, yɛ̀ɛ̀nì devoir,
# lòd dépasser, háb rien, ndwà message, kòŋgógô important, cɛ́nî changer, tìl écrire, ŋgə́ si,
# jə̀ vouloir, ŋ̀-kwǎl téléphone, yágnà payer, sɔ́b boutique, kɔ́m toujours, ndə̀m signe,
# m̀-pàŋ vrai, àyâá non, á mbúz derrière/après, swád être insuffisant, ású pour, ì-tə́ état,
# ŋ̀-kàbní succès, pám sortir, jə́blə̂ accepter.
# Mots restés en français faute d'entrée dans le dictionnaire : réseau, test, min., max.
ETON_DICO = {
"Alerte de sécurité": "Mbə́mí ùkálá",
"Alerte de sécurité : ce bénéficiaire n'a jamais été utilisé sur ce compte.":
    "Mbə́mí ùkálá : Waa bee mwani ŋm̀kpámgí á kɔ̀ntɛ́.",
"Alerte de sécurité : vérifiez le numéro du bénéficiaire avant de continuer.":
    "Mbə́mí ùkálá : yen nwàmɔ̀ Waa bee mwani, bɛ́ kə̀ èè.",
"Ce bénéficiaire n'a jamais été utilisé sur ce compte. Vérifiez le numéro avant de continuer.":
    "Waa bee mwani ŋm̀kpámgí á kɔ̀ntɛ́. Yen nwàmɔ̀, bɛ́ kə̀ èè.",
"Continuer": "Kə̀ èè",
"Erreur réseau : le service est temporairement indisponible. Réessayez.":
    "Ìtɔ̀m réseau : ìyóm jə́mnì. Və̀glà báglâ.",
"Facture électricité": "Kálâdà m̀pyà",
"Fermer": "Pɛ̀d",
"Frais de {taux} % (min. {min} FCFA, max. {max} FCFA)": "Táŋ {taux} % (min. {min} FCFA, max. {max} FCFA)",
"Gratuit": "Á pûpùd",
"J'ai vérifié le nom et le numéro du bénéficiaire.": "Yen dǒy èè nwàmɔ̀ Waa bee mwani : màn.",
"Je confirme que les informations ci-dessus sont correctes.": "Kenny : pɔ́ ŋ̀ŋə́mdə́.",
"Le montant doit être supérieur à zéro.": "Mɔ̀ní yɛ̀ɛ̀nì lòd háb.",
"Message important": "Ndwà kòŋgógô",
"Modifier": "Cɛ́nî",
"Note (optionnel)": "Tìl (ŋgə́ jə̀)",
"Numéro de téléphone": "Nwàmɔ̀ ŋ̀kwǎl",
"Opération": "Lóm mɔ̀ní",
"Paiement marchand": "Yágnà sɔ́b",
"Renseignez les informations du destinataire. Vérifiez toujours le numéro avant de valider.":
    "Tìl pɔ́ Waa bee mwani. Yen nwàmɔ̀ kɔ́m, bɛ́ kenny.",
"Référence": "Ndə̀m",
"Safinum Pay — environnement de démonstration. Ne saisissez aucune donnée personnelle réelle.":
    "Safinum Pay — test. Tìl pɔ́ m̀pàŋ : àyâá.",
"Solde après opération": "Mɔ̀ní à reste á mbúz lóm mɔ̀ní",
"Solde insuffisant pour effectuer ce transfert.": "Mɔ̀ní à reste swád ású lóm mɔ̀ní.",
"Statut": "Ìtə́",
"Succès": "Ŋ̀kàbní",
"Téléphone": "Ŋ̀kwǎl",
"Une erreur est survenue": "Ìtɔ̀m pám",
"Veuillez renseigner le nom et le numéro du bénéficiaire.": "Tìl dǒy èè nwàmɔ̀ Waa bee mwani.",
"Vous devez confirmer les informations avant de valider le transfert.": "Yɛ̀ɛ̀nì kenny pɔ́, bɛ́ jə́blə̂ lóm mɔ̀ní.",
}

basaa, eton = {}, {}
missing = sorted({f for f in fr.values() if norm(f) not in BASAA and f != "Safinum Pay"})
assert not missing, missing
for key, f in fr.items():
    if f == "Safinum Pay":
        basaa[key] = eton[key] = f
        continue
    basaa[key] = BASAA[norm(f)]
    eton[key] = ETON_DOC.get(f) or ETON_DICO.get(f)
assert not (set(ETON_DOC) | set(ETON_DICO)) - set(fr.values())
assert not set(ETON_DOC) & set(ETON_DICO)
provenance = {key: ("document" if f in ETON_DOC else "dictionnaire") for key, f in fr.items()}

# une variable présente dans la source doit l'être dans chaque langue
for key, f in fr.items():
    vars_ = set(re.findall(r"\{(\w+)\}", f))
    for name, table in (("en", en), ("basaa", basaa), ("eton", eton)):
        if table[key] is None:
            assert name == "eton", (name, key)
            continue
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
        {"code": "eton", "nom": "Eton", "fichier": "eton.json", "audio": "audio/eton.json", "etiquette": "à confirmer",
         "statut": "Document de travail du locuteur, complété par des équivalents composés à partir du dictionnaire éton-français, non validés.",
         "provenance": "eton-provenance.json"},
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
dump("eton-provenance.json", provenance)
print(len(fr), "cles par langue,", len(set(fr.values())), "textes francais uniques")
print("eton :", sum(v == "document" for v in provenance.values()), "cles du document,",
      sum(v == "dictionnaire" for v in provenance.values()), "du dictionnaire,", sum(v is None for v in eton.values()), "sans equivalent")
