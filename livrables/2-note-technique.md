# SafiLang — note technique

**SAFINUM Innovate Challenge — épreuve de présélection**
Version du prototype : 0.9.0 — Équipe : [nom de l'équipe]

## 1. Architecture

SafiLang est une extension de navigateur Manifest V3 pour Chrome et Edge. Tout s'exécute dans le navigateur de l'utilisateur ; il n'y a ni serveur, ni compte, ni appel réseau.

```
Page du service financier (inchangée)
        │  nœuds texte et libellés affichés
        ▼
content.js ── observe la page, remplace l'affichage, dessine le panneau et le haut-parleur
   │      │
   │      └── signal.js ── mesure un enregistrement : silences, niveau sonore
   ▼
engine.js ── texte source → clé → texte dans la langue choisie
   ▲
locales/*.json (textes par langue)      audio/<langue>.json + audio/<langue>/ (voix des locuteurs)
```

| Composant | Rôle |
|---|---|
| `locales/index.json` | Liste des langues, langues source (français, anglais), forme autorisée des variables. |
| `locales/<langue>.json` | Une table clé → texte par langue. Les 82 clés sont les mêmes partout. Une valeur `null` veut dire « pas d'équivalent » : le texte de la page n'est pas touché. |
| `engine.js` | Moteur de correspondance, sans accès à la page ni au réseau. Reconnaît un texte source en français ou en anglais, renvoie le texte cible. Gère les phrases à variables. |
| `content.js` | Parcourt les nœuds texte et quatre attributs de libellé (`aria-label`, `title`, `placeholder`, `alt`), remplace ceux que le moteur reconnaît, observe les changements de la page, mémorise la langue choisie. |
| `audio/eton.json`, `audio/basaa.json` | Tables clé → fichier audio, produites par un script à partir des noms de fichiers. |
| `signal.js` | Analyse de signal faite à l'écoute : repère le début et la fin de la voix, écarte les silences, ramène la voix à −20 dBFS sans dépasser −1 dBFS en crête. Les fichiers ne sont pas modifiés. |

### Phrases à variables

Certains textes mêlent un libellé et une valeur dans le même nœud, par exemple « Frais de 1,5 % (min. 100 FCFA, max. 2 500 FCFA) ». Le fichier de langue contient alors un gabarit, `Frais de {taux} % (min. {min} FCFA, max. {max} FCFA)`. Le moteur traduit le libellé et recopie chaque valeur à l'identique ; s'il ne retrouve pas toutes les valeurs dans le résultat, il ne remplace rien.

## 2. Intégration au service cible

- **Aucune modification du service** : l'extension est installée dans le navigateur. Le code, les serveurs et les données du service ne changent pas.
- **Affichage seulement** : l'extension réécrit le texte affiché de nœuds reconnus. Elle n'écrit jamais dans un champ de saisie, ne clique sur rien, ne saute aucune étape, n'intercepte aucune requête.
- **Suivi du parcours** : la page de test change d'étape sans rechargement. Un observateur de mutations traite tout contenu ajouté ou modifié, y compris les messages d'erreur, les alertes et la bascule français/anglais de la page.
- **Interface propre isolée** : le panneau de langue et le bouton d'écoute sont dessinés dans un Shadow DOM hors du contenu de la page ; ils n'ajoutent aucun texte dans les éléments que la page contrôle.
- **Adapter à un autre service** : ajouter son adresse dans `manifest.json` et fournir ses fichiers d'équivalences. Le moteur et le script de page ne changent pas.
- **Ajouter une langue** : créer un fichier `locales/<langue>.json`, l'inscrire dans `index.json`, et, pour la voix, déposer les enregistrements puis relancer `outils/generer_audio.py`.

## 3. Sécurité et préservation des informations financières

- **Valeurs jamais réécrites** : montants, devise, noms, numéros de compte et de téléphone, références, dates, codes d'erreur, valeurs saisies. Un texte qui n'est pas dans les fichiers n'est pas modifié.
- **Aucune collecte** : rien de ce qui est affiché n'est lu pour être stocké ou transmis. La seule donnée enregistrée, localement, est la langue choisie.
- **Aucun appel réseau** : textes et enregistrements sont livrés avec l'extension. En français et en anglais, la lecture à voix haute utilise une voix de synthèse installée sur l'appareil ; les voix en ligne du navigateur sont écartées.
- **Audio lié aux valeurs** : un enregistrement qui prononce une valeur (« Bonjour, Amina », le numéro de compte) n'est proposé que si la page affiche exactement cette valeur.
- **Autorisations** : `storage` (mémoriser la langue). Le manifeste déclare encore l'adresse locale `http://127.0.0.1:11434/*` et un service worker hérités d'un essai antérieur ; ils ne sont plus utilisés à l'affichage (voir limites).

## 4. Vérification

| Test | Ce qu'il vérifie | Résultat au 14 novembre 2026 |
|---|---|---|
| `node outils/tester_moteur.js` | 656 correspondances (82 clés × 4 langues × 2 langues source), valeurs conservées dans les gabarits, textes inconnus et valeurs protégées intacts, fichiers audio présents, analyse de signal sur des sons de synthèse. | 0 échec |
| `node outils/tester_navigateur.js "<navigateur>"` | Sur la page de test officielle, dans Edge sans fenêtre : changement de langue, parcours des cinq étapes, alerte de sécurité, contenu ajouté après chargement, bascule FR/EN, langue mémorisée, lecture d'un enregistrement éton, journal d'intégrité de la page. | 0 échec ; cinq étapes « intact » |
| `node outils/analyser_audio.js "<navigateur>"` | Mesures des 150 enregistrements (78 éton, 72 bàsàa) : durée, silences, niveau, crête, bruit, saturation. | Écart de niveau entre fichiers ramené de 14 dB à 2,4 dB en éton, de 7 dB à 0,4 dB en bàsàa |

Non testé : le panneau jury de la page (`?jury=1`) et sa mesure de couverture, Chrome, un lecteur d'écran, un écran tactile.

## 5. Dépendances et composants tiers

| Composant | Usage | Licence ou statut |
|---|---|---|
| Chrome ou Edge (Manifest V3) | Exécution de l'extension. | — |
| Aucune bibliothèque JavaScript | L'extension est écrite sans dépendance. | — |
| Node.js 22 ou plus récent | Scripts de test seulement. | — |
| Python 3, bibliothèque `pymupdf` | Scripts de préparation seulement (génération des fichiers de langue, décodage du dictionnaire bàsàa). | — |
| *Dictionnaire éton-français*, M. Van de Velde et K. Essele Essele, Éditions CLÉ, 2022 | Source des équivalents éton composés hors document du locuteur. | CC BY-NC-SA 4.0 : attribution, usage non commercial, partage à l'identique. |
| *Dictionnaire français-basaa*, Dr P. E. Njock, 2005 | Consulté pendant le prototypage ; les textes bàsàa actuels viennent du locuteur, pas du dictionnaire. | Licence non indiquée : à clarifier avant toute diffusion. |
| Claude (Anthropic), assistant de programmation | Aide à l'écriture du code, des scripts et de la documentation ; composition des compléments éton à partir du dictionnaire. | Outil d'assistance ; n'est pas embarqué dans l'extension. |
| Ollama et le modèle Aya Expanse | Essai antérieur de traduction automatique locale, abandonné. Ne sert plus à l'affichage. | — |

Contribution propre de l'équipe : la conception de l'approche par équivalences validées, le moteur de correspondance et ses gabarits à variables, le script de page, l'écoute avec analyse de signal, la collecte des traductions et des enregistrements auprès des locuteurs, les outils de test.

## 6. Limites connues

- **Contenu inédit** : un message absent des fichiers reste dans sa langue d'origine. L'extension ne le traduit pas et ne le modifie pas. C'est un choix de sécurité (ne rien inventer), mais l'exigence n'est couverte qu'en partie.
- **Qualité linguistique** : le bàsàa vient d'un locuteur mais n'a pas eu de seconde relecture ; une partie de l'éton n'est pas validée (voir « Langues et validation linguistique »).
- **Audio** : 69 clés sur 82 ont un enregistrement éton, 80 sur 82 en bàsàa. En bàsàa, deux enregistrements ne sont pas joués : « Bonjour, Amina » (fichier muet, à réenregistrer) et la description des frais (chiffres prononcés à vérifier). Le rattachement fichier → phrase a été fait d'après les noms de fichiers. Onze enregistrements éton sont saturés à la prise de son ; l'analyse de signal égalise le volume mais ne corrige ni la saturation ni le bruit de fond.
- **Voix française et anglaise** : elles dépendent des voix installées sur l'appareil ; sans voix locale pour la langue, l'écoute n'est pas proposée.
- **Texte et voix** : le texte éton affiché n'a pas été comparé mot à mot aux enregistrements.
- **Clés homonymes** : quand un même texte source sert deux clés (« Frais » comme étape et comme libellé), la première clé est utilisée.
- **Périmètre** : l'extension n'est active que sur l'adresse de la page de test ; navigateurs de bureau Chrome et Edge uniquement, pas d'application mobile.
- **Écoute au toucher** : le haut-parleur apparaît au survol ou au clavier ; sur écran tactile, toucher un bouton de la page l'active en même temps.
- **Reste d'un essai antérieur** : une autorisation locale et un service worker inutilisés figurent encore dans le manifeste, à retirer.
