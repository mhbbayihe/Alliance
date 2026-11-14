# Alliance — extension de traduction par équivalences

Extension Manifest V3 pour Chrome et Edge. Elle affiche une interface financière existante dans la langue choisie, sans modifier le code de la page : chaque texte reconnu est remplacé par son équivalent, lu dans des fichiers JSON livrés avec l'extension.

## Installation

1. Ouvrir `chrome://extensions` ou `edge://extensions`.
2. Activer le mode développeur.
3. Choisir « Charger l'extension non empaquetée » et sélectionner le dossier `extension`.
4. Ouvrir `https://safinum.cm/hackathon-test`.
5. Cliquer sur le bouton « Langue » en bas à gauche et choisir une langue. Le changement est immédiat, et la langue choisie est mémorisée.

Après une modification des fichiers, cliquer sur « Recharger » dans la page des extensions, puis recharger la page de test.

## Langues

| Langue | Fichier | État |
|---|---|---|
| Français | `locales/fr.json` | textes exacts de la page |
| English | `locales/en.json` | textes exacts de la page |
| Bàsàa | `locales/basaa.json` | traductions du locuteur (`bassa.txt`, 14 novembre 2026) |
| Éton | `locales/eton.json` | traductions du locuteur, copiées de son cahier (`liste-traduction-eton.txt`, 14 novembre 2026) |

Le bàsàa reprend les 72 traductions du locuteur, lues dans `bassa.txt` à la racine du projet. Seules retouches : le nom « Safinum Pay » rétabli (écrit « Safinum pay »), et, dans la description des frais, les chiffres recopiés depuis la page (le locuteur avait écrit « 15% » pour « 1,5 % »).

L'éton reprend les 72 lignes « Éton : » de `liste-traduction-eton.txt`, copie du cahier du locuteur ; les lignes où la copie est incertaine sont listées à la fin de ce fichier et restent à faire relire. Retouches : « Safinum Pay — » remis devant la phrase 13, prénom, numéro de compte et chiffres des frais recopiés depuis la page, « Mobile Money » écrit comme sur la page, et « telefon » gardé pour « Téléphone » (le cahier propose aussi « ŋ̀kual lɔŋní »).


## Comment ça marche

- `locales/index.json` liste les langues, les langues source (français et anglais) et les règles des variables.
- Chaque fichier de langue associe une clé à un texte. Toutes les langues ont les mêmes 82 clés. Une valeur `null` signifie « pas encore d'équivalent » : le texte reste dans la langue de la page.
- `engine.js` construit la correspondance « texte source → clé → texte cible ». Il reconnaît la page en français comme en anglais.
- `content.js` parcourt les nœuds texte de la page, remplace ceux qui sont reconnus, et observe la page pour traiter tout contenu ajouté ou modifié ensuite, sans rechargement.
- Un texte sans correspondance n'est jamais modifié. Le panneau ne montre que le choix de la langue, sans compteur ni liste.

### Phrases à variables

Une valeur écrite `{nom}` dans un fichier de langue marque une variable, par exemple `"Bonjour, {prenom}"` ou `"Frais de {taux} % (min. {min} FCFA, max. {max} FCFA)"`. Le texte autour est traduit ; la valeur est recopiée à l'identique. La forme autorisée de chaque variable est définie dans `locales/index.json`.

### Écoute en bàsàa et en éton

Les enregistrements du locuteur sont dans `audio/basaa/`, nommés « numéro - phrase française » ; les numéros sont ceux des 72 phrases de `liste-traduction-basaa.txt`. Un fichier déposé sous le seul nom « numéro.ext » est renommé par le script. `audio/basaa.json` associe chaque clé de l'interface à son fichier ; il est produit par `python outils/generer_audio.py`, à relancer après tout ajout ou renommage d'enregistrement. Quand plusieurs prises existent, celle dont le nom ne porte pas « (prise N) » est jouée. Deux enregistrements sont écartés de la lecture dans ce script (`A_VERIFIER`) : « Bonjour, Amina », reçu sans son, et la description des frais, à vérifier à l'écoute.

L'éton suit le même principe dans `audio/eton/` et `audio/eton.json`. Le locuteur a enregistré les phrases 1 à 49 ; les phrases 50 à 72 (fin du récapitulatif, reçu, messages d'erreur et alertes) s'affichent en éton mais n'ont pas d'écoute.

En bàsàa et en éton, un bouton haut-parleur apparaît à côté du texte survolé ou atteint au clavier s'il a un enregistrement ; un appui lance l'écoute, un second l'arrête. Le bouton est dessiné hors du contenu de la page. Un enregistrement qui prononce une valeur (le numéro de compte) n'est proposé que si la page affiche exactement cette valeur.

Le panneau propose aussi « Lire toute la page » : les enregistrements des textes de l'écran s'enchaînent dans l'ordre de la page, un cadre suit le texte en cours de lecture, et la page défile si besoin. Un second appui ou la touche Échap arrête la lecture. Les valeurs (montants, noms, numéros) n'ont pas d'enregistrement et ne sont pas lues. Le bouton n'apparaît que pour une langue qui a des enregistrements.

En français et en anglais, l'écoute et « Lire toute la page » passent par une voix de synthèse installée sur l'appareil ; les valeurs (montants, noms, numéros) sont alors lues aussi. Les voix en ligne du navigateur sont écartées, pour qu'aucun texte affiché ne soit envoyé à un serveur. Si l'appareil n'a pas de voix installée pour la langue, l'écoute n'est pas proposée (sous Windows : Paramètres > Heure et langue > Voix > Ajouter des voix).

Sur un écran tactile, où le survol n'existe pas, un appui maintenu une demi-seconde sur un texte le lit ; le clic qui suivrait au relâchement est annulé, pour ne pas activer le bouton qu'on voulait seulement écouter. Sous « Lire toute la page », « Répéter » rejoue le dernier texte entendu et « Voix normale / Voix lente » ralentit la lecture (enregistrements à 85 % de leur vitesse, ce qui rend la voix un peu plus grave). La vitesse choisie est mémorisée.

Pour que la voix ait le même rendu d'un texte à l'autre, `signal.js` mesure chaque enregistrement au moment de l'écoute : il repère où la voix commence et finit, écarte les silences de début et de fin, et règle le gain pour ramener la voix à −20 dBFS sans dépasser −1 dBFS en crête (gain plafonné à +18 dB). Les fichiers ne sont pas modifiés ; les pauses à l'intérieur d'un enregistrement, le bruit de fond et la saturation à l'enregistrement ne sont pas corrigés. `node outils/analyser_audio.js "<chemin du navigateur>"` affiche les mesures et les réglages de tous les fichiers.

### Ce qui n'est jamais modifié

Montants, devise, noms, numéros de compte et de téléphone, références, dates, codes d'erreur, valeurs des champs de saisie. L'extension ne lit ni n'envoie aucune donnée : pas de requête réseau, seule la langue choisie est enregistrée localement.

## Ajouter ou corriger une traduction

Modifier la valeur dans le fichier de la langue, sans changer la clé. Pour ajouter un texte, ajouter la même clé dans tous les fichiers de langue. Pour ajouter une langue, créer son fichier et l'inscrire dans `locales/index.json`.

Les fichiers actuels sont produits par `outils/generer_locales.py` ; relancer ce script écrase les modifications faites à la main. Pour corriger le bàsàa, modifier `bassa.txt` ; pour l'éton, les lignes « Éton : » de `liste-traduction-eton.txt` ; puis relancer le script.

## Vérification

- `node outils/tester_moteur.js` : correspondances de toutes les clés dans toutes les langues, valeurs conservées, textes inconnus intacts.
- `node outils/tester_navigateur.js "<chemin du navigateur>"` : parcours complet sur la page de test dans un navigateur sans fenêtre (changement de langue, cinq étapes, alertes, contenu ajouté, bascule FR/EN, journal d'intégrité de la page).

## Limites connues

- Un texte inédit, absent des fichiers, reste dans sa langue d'origine.
- Quand un même texte source correspond à deux clés (« Frais » comme étape et comme libellé), la première clé est utilisée.
- L'extension n'est active que sur `https://safinum.cm/hackathon-test`.

## Ancienne version

`service-worker.js` et l'autorisation `http://127.0.0.1:11434/*` du manifeste viennent d'un essai antérieur de traduction automatique locale (Ollama). Ils ne servent plus à l'affichage.

## Sources linguistiques

- *Dictionnaire français-basaa*, Dr Pierre Emmanuel Njock, 2005, licence non indiquée.
