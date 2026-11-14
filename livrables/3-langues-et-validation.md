# Alliance — langue prise en charge et validation linguistique

**SAFINUM Innovate Challenge — épreuve de présélection**
Équipe : [nom de l'équipe] — État au 14 novembre 2026

## 1. Langue nationale prise en charge

| Langue | Texte | Voix | État de validation |
|---|---|---|---|
| **Bàsàa** | 82 textes sur 82 | 80 textes sur 82 | Traduit et enregistré par un locuteur : voir section 3. |

L'extension reconnaît la page en français et en anglais, ses deux langues source.

## 2. Méthode de validation

Le principe : **aucune phrase n'est produite au moment de l'utilisation**. Chaque texte affiché ou entendu vient d'un fichier préparé à l'avance, qu'un locuteur peut relire ligne par ligne.

1. **Inventaire** : les 72 phrases de l'environnement de test ont été extraites du code de la page, avec leur contexte (bouton, titre, message d'erreur, alerte).
2. **Liste de travail pour le locuteur** : les phrases sont numérotées et accompagnées de consignes : traduire le sens et non mot à mot ; garder le même mot pour le même terme (transfert, solde, frais, bénéficiaire, montant, compte) ; ne traduire ni les noms, ni les chiffres, ni « FCFA » ; **ne pas deviner** et écrire « ? » en cas de doute.
3. **Phrases à risque signalées** : les 28 phrases qui touchent à l'argent ou à la sécurité portent la mention [IMPORTANT] ; le sens doit y être exact.
4. **Enregistrement** : le locuteur dit chaque phrase ; les fichiers sont nommés d'après le numéro de la liste.
5. **Suivi de l'état** : chaque phrase a un statut (`needs_translation`, `translated`, `approved`) et un champ pour le nom du validateur.
6. **Contrôle des enregistrements** : une analyse de signal mesure chaque fichier (durée, silences, niveau, saturation). Elle a repéré un fichier sans son, qui a été écarté.
7. **Garde-fous automatiques** : des tests vérifient que les valeurs (montants, noms, numéros, codes) ressortent à l'identique et qu'un texte inconnu n'est jamais modifié.

## 3. Bàsàa — état détaillé

- **Locuteur** : [nom du locuteur bàsàa, lien avec la langue]. Il a traduit les 72 phrases de la liste ; ses traductions, reçues le 14 novembre 2026, sont reprises telles quelles dans l'extension.
- **Retouches faites par l'équipe**, toutes pour préserver les noms et les valeurs : le nom « Safinum Pay » rétabli (écrit « Safinum pay »), et, dans la description des frais, les chiffres recopiés depuis la page (le locuteur avait écrit « 15% » pour « 1,5 % »). Dans « Bonjour, Amina » et le numéro de compte, la valeur est recopiée depuis la page.
- **Orthographe** : le locuteur écrit avec ô, é et ñ, sans les lettres ɓ, ŋ, ɛ, ɔ ni les tons. Elle est gardée telle quelle.
- **Enregistrements** : 72 fichiers du locuteur, un par phrase, reçus le 14 novembre 2026. Deux ne sont pas joués par l'extension : « Bonjour, Amina » (fichier reçu sans son) et la description des frais, qui prononce des chiffres et doit être écoutée avant d'être activée.

Points à faire confirmer par le locuteur avant la démonstration :

1. « Alerte de sécurité » est rendu par « Biyihne inyu matat » comme titre, mais par « Bibéhne inyu matat » au début des deux messages d'alerte.
2. « Compte » s'écrit de trois façons : « Kônto », « Konto », « kôntô ».
3. Les boutons « Fermer » (« Homa liyibne li biyihne ») et « Modifier » (« Lihéñha biyihne ») sont longs pour des boutons : vérifier qu'il s'agit bien du libellé et non de l'explication donnée en note.
4. Une seconde relecture des 28 phrases marquées [IMPORTANT] par une autre personne compétente.

Reste à faire : réenregistrer « Bonjour, Amina », vérifier à l'écoute la description des frais, puis une écoute de contrôle de chaque enregistrement face à sa phrase.

## 4. Engagement

Aucun texte ne sera présenté au jury comme validé s'il ne vient pas d'un locuteur. Tant qu'une phrase à risque n'est pas confirmée, l'équipe peut la laisser en français : le fichier de langue accepte une valeur vide, et l'extension laisse alors le texte de la page intact.
