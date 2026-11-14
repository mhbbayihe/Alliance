# Alliance — description de la solution

**SAFINUM Innovate Challenge — épreuve de présélection**
Équipe : [nom de l'équipe] — Représentant : [nom, téléphone, courriel]

## Le problème

Les applications bancaires, de paiement et de microfinance du Cameroun sont proposées en français ou en anglais. Une personne qui lit mal ces langues ne peut pas vérifier seule un solde, des frais ou le nom d'un bénéficiaire avant d'envoyer de l'argent. Elle dépend d'un tiers, ou renonce au service.

## La solution

Alliance est une extension de navigateur (Chrome et Edge). Elle affiche et fait entendre un service financier existant en bàsàa, **sans modifier le service** : ni son code, ni ses serveurs, ni ses données.

- **Lire** : chaque texte reconnu de l'interface (titres, boutons, instructions, messages d'erreur, alertes de sécurité) est remplacé par son équivalent bàsàa. Le changement est immédiat et suit l'utilisateur d'écran en écran.
- **Écouter** : un bouton haut-parleur apparaît à côté du texte survolé et fait entendre la phrase enregistrée par un locuteur. Un bouton « Lire toute la page » enchaîne les enregistrements de l'écran, comme une lecture à voix haute. Sur un écran tactile, un appui long sur un texte le lit ; la voix peut être ralentie et le dernier texte répété. L'écoute s'adresse aux personnes qui ne lisent pas, y compris dans leur propre langue.
- **Ne rien inventer** : les textes viennent de fichiers d'équivalences préparés à l'avance, pas d'une traduction automatique. Un texte inconnu est laissé tel quel, jamais deviné.
- **Protéger les valeurs** : les montants, les frais, les noms, les numéros, les références et les codes d'erreur ne sont jamais réécrits.

## Langue

**Bàsàa**, en texte et en voix : 72 phrases traduites puis enregistrées par un locuteur.

L'extension permet aussi d'afficher la page en français ou en anglais, avec une lecture par la voix de synthèse de l'appareil. L'état exact de validation est donné dans le document « Langues et validation linguistique ».

## Ce que le prototype démontre sur l'environnement de test

| Capacité attendue | État |
|---|---|
| Adaptation linguistique de l'interface | Oui : tous les textes fixes de la page de test ont un équivalent bàsàa (82 clés). |
| Parcours financier | Oui : solde, frais, bénéficiaire, récapitulatif, reçu, sans rechargement. |
| Préservation des informations financières | Oui : le contrôle d'intégrité de la page de test marque les cinq étapes « intact ». |
| Fonctionnement indépendant | Oui : aucune modification de la page ; l'extension lit et réécrit seulement l'affichage. |
| Contenu inédit | Partiel : un message déjà connu est traduit dès qu'il apparaît ; un message jamais vu reste dans sa langue d'origine, sans être modifié. |

## Pourquoi cette approche

Dans un service financier, une traduction fausse est plus dangereuse que pas de traduction. Alliance fait donc le choix d'équivalences fournies par des locuteurs plutôt que d'un modèle génératif : chaque phrase affichée ou entendue peut être relue, corrigée et signée par une personne compétente, et la même méthode peut être reprise pour un autre service ou une autre langue nationale.
