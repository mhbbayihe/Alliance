# Produit extension/audio/<langue>.json : pour chaque clé de l'interface, l'enregistrement à jouer.
# Usage : python outils/generer_audio.py
#
# Les enregistrements d'une langue sont dans extension/audio/<langue>/, nommés
# « NN - phrase française.ext », NN étant le numéro de la phrase dans liste-traduction-basaa.txt
# (la même liste de 72 phrases sert à toutes les langues). Un fichier nommé seulement « NN.ext »
# est renommé au passage. Le fichier sans « (prise N) » est celui qui est joué : pour choisir une
# autre prise, renommer les fichiers puis relancer ce script.
import json
import os
import re
import unicodedata

RACINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
LISTE = os.path.join(RACINE, "liste-traduction-basaa.txt")
AUDIO = os.path.join(RACINE, "extension", "audio")
FORMATS = (".aac", ".ogg", ".mp3", ".m4a", ".opus", ".wav")

LANGUES = {
    "basaa": "Enregistrements bàsàa du locuteur",
}

# Phrases dont l'enregistrement n'est pas joué tant qu'il n'a pas été écouté et confirmé.
# bàsàa 40 (description des frais) : le locuteur a écrit « 15% » pour « 1,5 % » dans bassa.txt ;
# s'il a lu son texte, l'audio annonce de mauvais frais. Retirer 40 d'ici une fois l'audio vérifié.
# bàsàa 25 (« Bonjour, Amina ») : le fichier reçu dure 1 s et ne contient aucun son ; à réenregistrer.
A_VERIFIER = {"basaa": {25, 40}}


def norm(texte):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", texte).replace("’", "'")).strip()


def libelle(phrase):
    t = re.sub(r'[\\/:*?"<>|]', "", phrase)
    t = re.sub(r"\s+", " ", t).strip(" .")
    if len(t) > 60:
        t = t[:60].rsplit(" ", 1)[0].rstrip(" ,;(.") + "…"
    return t


# 1. Numéro -> phrase française de la liste.
phrases, numero = {}, None
with open(LISTE, encoding="utf-8") as f:
    for ligne in f:
        m = re.match(r"^(\d+)\. \(", ligne)
        if m:
            numero = int(m.group(1))
        m = re.match(r"^\s+Français : (.*)$", ligne)
        if m and numero:
            phrases[numero] = norm(m.group(1))

with open(os.path.join(RACINE, "extension", "locales", "fr.json"), encoding="utf-8") as f:
    fr = json.load(f)

# 2. Clé de l'interface -> (numéro de la liste, valeurs prononcées), par le texte français.
correspondance, hors_liste = {}, []
for cle, texte in fr.items():
    variables = re.findall(r"\{(\w+)\}", texte)
    for n, phrase in phrases.items():
        if not variables:
            if norm(texte) == phrase:
                correspondance[cle] = (n, None)
                break
        else:
            motif = "".join(f"(?P<{p[1:-1]}>.+?)" if p.startswith("{") else re.escape(p)
                            for p in re.split(r"(\{\w+\})", norm(texte)))
            m = re.fullmatch(motif, phrase)
            if m:
                correspondance[cle] = (n, m.groupdict())
                break
    else:
        hors_liste.append(cle)
assert not hors_liste, hors_liste

for langue, description in LANGUES.items():
    dossier = os.path.join(AUDIO, langue)
    if not os.path.isdir(dossier):
        continue
    # 3. Fichiers « NN.ext » : renommés avec la phrase française.
    for nom in sorted(os.listdir(dossier)):
        m = re.match(r"^(\d+)(\.\w+)$", nom)
        if m and m.group(2).lower() in FORMATS and int(m.group(1)) in phrases:
            n = int(m.group(1))
            os.rename(os.path.join(dossier, nom), os.path.join(dossier, f"{n:02d} - {libelle(phrases[n])}{m.group(2).lower()}"))

    # 4. Numéro -> fichiers (la prise sans suffixe d'abord).
    prises, non_classes = {}, []
    for nom in sorted(os.listdir(dossier)):
        if not nom.lower().endswith(FORMATS):
            continue
        m = re.match(r"^(\d+) - .*?(?: \(prise (\d+)\))?\.\w+$", unicodedata.normalize("NFC", nom))
        if m:
            prises.setdefault(int(m.group(1)), []).append((int(m.group(2) or 1), nom))
        else:
            non_classes.append(nom)
    prises = {n: [nom for _, nom in sorted(liste)] for n, liste in prises.items()}

    cles, sans_audio, a_verifier = {}, [], []
    for cle, (n, valeurs) in correspondance.items():
        if n in A_VERIFIER.get(langue, ()):
            a_verifier.append({"cle": cle, "numero": n, "francais": phrases[n], "fichier": prises.get(n, [None])[0]})
        elif n not in prises:
            sans_audio.append({"cle": cle, "numero": n, "francais": phrases[n]})
        else:
            entree = {"numero": n, "fichier": prises[n][0]}
            if valeurs:
                # L'enregistrement prononce ces valeurs : il n'est joué que si la page affiche les mêmes.
                entree["valeurs"] = valeurs
            cles[cle] = entree

    resultat = {
        "schemaVersion": 1,
        "description": f"{description}, par clé de l'interface. Produit par outils/generer_audio.py : ne pas modifier à la main.",
        "langue": langue,
        "dossier": f"audio/{langue}",
        "cles": cles,
        "autresPrises": {str(n): liste[1:] for n, liste in sorted(prises.items()) if len(liste) > 1},
        "sansAudio": sans_audio,
        "aVerifierAvantLecture": a_verifier,
        "fichiersNonClasses": non_classes,
    }
    with open(os.path.join(AUDIO, f"{langue}.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(resultat, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"{langue} : {len(cles)} cle(s) avec audio sur {len(fr)} ; {len(sans_audio)} sans audio ; "
          f"{len(a_verifier)} a verifier ; {len(non_classes)} fichier(s) non classe(s)")
    for s in sans_audio:
        print(f"  sans audio : {s['numero']:>2} {s['cle']}")
