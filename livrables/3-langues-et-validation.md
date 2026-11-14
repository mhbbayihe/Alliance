# Alliance — langues prises en charge et validation linguistique

**SAFINUM Innovate Challenge — épreuve de présélection**
Équipe : [nom de l'équipe] — État au 14 novembre 2026

## 1. Langues nationales prises en charge

| Langue | Texte | Voix | État de validation |
|---|---|---|---|
| **Éton** | 82 textes sur 82 | 69 textes sur 82 | Partiel : voir section 3. |
| **Bàsàa** | 82 textes sur 82 | 80 textes sur 82 | Traduit par un locuteur : voir section 4. |

L'extension reconnaît la page en français et en anglais, ses deux langues source.

## 2. Méthode de validation

Le principe : **aucune phrase n'est produite au moment de l'utilisation**. Chaque texte affiché ou entendu vient d'un fichier préparé à l'avance, qu'un locuteur peut relire ligne par ligne.

1. **Inventaire** : les 72 phrases de l'environnement de test ont été extraites du code de la page, avec leur contexte (bouton, titre, message d'erreur, alerte).
2. **Liste de travail pour le locuteur** : les phrases sont numérotées et accompagnées de consignes : traduire le sens et non mot à mot ; garder le même mot pour le même terme (transfert, solde, frais, bénéficiaire, montant, compte) ; ne traduire ni les noms, ni les chiffres, ni « FCFA » ; **ne pas deviner** et écrire « ? » en cas de doute.
3. **Phrases à risque signalées** : les 28 phrases qui touchent à l'argent ou à la sécurité portent la mention [IMPORTANT] ; le sens doit y être exact.
4. **Enregistrement** : le locuteur dit chaque phrase ; les fichiers sont nommés d'après le numéro de la liste.
5. **Suivi de l'état** : chaque phrase a un statut (`needs_translation`, `translated`, `approved`) et un champ pour le nom du validateur. Pour l'éton, un fichier de provenance indique l'origine de chaque texte (document du locuteur ou dictionnaire).
6. **Transparence à l'écran** : une langue non entièrement validée porte une étiquette visible dans le panneau (« brouillon », « à confirmer »).
7. **Garde-fous automatiques** : des tests vérifient que les valeurs (montants, noms, numéros, codes) ressortent à l'identique et qu'un texte inconnu n'est jamais modifié.

## 3. Éton — état détaillé

- **Locuteur** : [nom du locuteur éton, lien avec la langue].
- **51 textes** viennent du document de travail fourni par le locuteur le 13 novembre 2026. Ce document se présente lui-même comme une ébauche, issue d'équivalents communiqués oralement. Quand il laisse un mot en français (« courant », « reste », « fictif », « type », « nouveau »), ce mot est gardé.
- **31 textes** ont été composés par l'équipe à partir du *Dictionnaire éton-français* (Van de Velde et Essele Essele, 2022), avec l'aide d'un assistant IA. Ce sont des suites de mots sans accords, **non validées**. Elles comprennent les sept messages d'erreur et d'alerte, les deux cases à cocher de confirmation et l'avertissement « nouveau bénéficiaire ».
- **Enregistrements** : 78 fichiers du locuteur, reçus le 14 novembre 2026, couvrant 62 des 72 phrases. Le rattachement de chaque fichier à sa phrase a été fait d'après le nom du fichier, pas encore par une écoute de contrôle.
- **Sans enregistrement** : « Solde » et « Frais », le bandeau de test, « Votre compte », « Nom du bénéficiaire », le pied de page, les deux descriptions de frais, et deux messages d'erreur (bénéficiaire à renseigner ; bénéficiaire jamais utilisé).

Reste à faire avant la démonstration :

1. Relecture par le locuteur des 31 textes composés depuis le dictionnaire, en priorité les messages de sécurité.
2. Confirmation de quatre formulations que le document donne comme incertaines, dont le conseil de sécurité.
3. Écoute de contrôle de chaque enregistrement face à sa phrase, et choix d'une prise quand il y en a plusieurs.
4. Alignement du texte affiché sur ce que dit le locuteur.
5. Enregistrement des dix phrases manquantes et reprise des onze prises saturées.

## 4. Bàsàa — état détaillé

- **Traducteur** : [nom du locuteur bàsàa]. Il a traduit les 72 phrases de la liste ; ses traductions, reçues le 14 novembre 2026, sont reprises telles quelles dans l'extension.
- **Retouches faites par l'équipe**, toutes pour préserver les noms et les valeurs : le nom « Safinum Pay » rétabli (écrit « Safinum pay »), et, dans la description des frais, les chiffres recopiés depuis la page (le locuteur avait écrit « 15% » pour « 1,5 % »). Dans « Bonjour, Amina » et le numéro de compte, la valeur est recopiée depuis la page.
- **Orthographe** : le locuteur écrit avec ô, é et ñ, sans les lettres ɓ, ŋ, ɛ, ɔ ni les tons. Elle est gardée telle quelle.

Points à faire confirmer par le locuteur avant la démonstration :

1. « Alerte de sécurité » est rendu par « Biyihne inyu matat » comme titre, mais par « Bibéhne inyu matat » au début des deux messages d'alerte.
2. « Compte » s'écrit de trois façons : « Kônto », « Konto », « kôntô ».
3. Les boutons « Fermer » (« Homa liyibne li biyihne ») et « Modifier » (« Lihéñha biyihne ») sont longs pour des boutons : vérifier qu'il s'agit bien du libellé et non de l'explication donnée en note.
4. Une seconde relecture des 28 phrases marquées [IMPORTANT] par une autre personne compétente.

- **Enregistrements** : 72 fichiers du locuteur, un par phrase, reçus le 14 novembre 2026. Deux ne sont pas joués par l'extension : « Bonjour, Amina » (fichier reçu sans son) et la description des frais, qui prononce des chiffres et doit être écoutée avant d'être activée.

Reste à faire : réenregistrer « Bonjour, Amina », vérifier à l'écoute la description des frais, puis une écoute de contrôle de chaque enregistrement face à sa phrase.

## 5. Engagement

Aucun texte ne sera présenté au jury comme validé s'il ne vient pas d'un locuteur. Tant qu'une phrase à risque n'est pas validée, l'équipe peut la laisser en français : le fichier de langue accepte une valeur vide, et l'extension laisse alors le texte de la page intact.
