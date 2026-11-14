# Alliance

Extension de navigateur (Chrome et Edge) qui affiche et fait entendre un service financier numérique en langues nationales camerounaises, **sans modifier le service**. Prototype réalisé pour l'épreuve de présélection du SAFINUM Innovate Challenge.

- **Langue nationale** : bàsàa, en texte et en voix (traductions et enregistrements d'un locuteur).
- **Langues source** : français et anglais, avec lecture par la voix de synthèse de l'appareil.
- **Principe** : chaque texte reconnu est remplacé par un équivalent préparé à l'avance ; rien n'est traduit automatiquement. Un texte inconnu est laissé tel quel.
- **Valeurs protégées** : montants, frais, noms, numéros, références et codes d'erreur ne sont jamais réécrits.
- **Aucune donnée transmise** : tout s'exécute dans le navigateur, sans serveur ni appel réseau.

## Essayer

1. Télécharger ce dépôt.
2. Ouvrir `chrome://extensions` ou `edge://extensions` et activer le mode développeur.
3. Cliquer sur « Charger l'extension non empaquetée » et choisir le dossier `extension`.
4. Ouvrir <https://safinum.cm/hackathon-test>.
5. Cliquer sur « Langue » en bas à gauche, choisir Bàsàa.
6. Survoler un texte et cliquer sur le haut-parleur pour l'écouter, ou cliquer sur « Lire toute la page ».

## Contenu du dépôt

| Dossier ou fichier | Contenu |
|---|---|
| [extension/](extension/) | L'extension : code, fichiers de langue, enregistrements audio. Voir [extension/README.md](extension/README.md). |
| [livrables/](livrables/) | Description de la solution, note technique, langues et validation linguistique, scénario de la vidéo. |
| [outils/](outils/) | Scripts de génération des fichiers de langue et des tables audio, tests, analyse des enregistrements. |
| [liste-traduction-basaa.txt](liste-traduction-basaa.txt) | Les 72 phrases de l'interface, numérotées, remises aux locuteurs. |
| [bassa.txt](bassa.txt) | Les traductions bàsàa du locuteur. |
| [phrases-interface.json](phrases-interface.json) | Inventaire des textes de la page de test et suivi des traductions. |

## Tests

```
node outils/tester_moteur.js
node outils/tester_navigateur.js "<chemin de msedge.exe ou chrome.exe>"
```

Le second test parcourt la page de test officielle dans un navigateur sans fenêtre. Demande Node 22 ou plus récent.

`outils/generer_locales.py` a besoin d'une copie du script de la page de test, qui n'est pas publiée ici.

## État et limites

L'état de validation et les limites connues sont décrits sans détour dans [livrables/3-langues-et-validation.md](livrables/3-langues-et-validation.md) et [livrables/2-note-technique.md](livrables/2-note-technique.md). En résumé : le bàsàa vient d'un locuteur mais n'a pas eu de seconde relecture, deux enregistrements ne sont pas encore joués, et un message inédit n'est pas traduit.

## Sources et composants tiers

- *Dictionnaire français-basaa*, Dr Pierre Emmanuel Njock, 2005 : consulté pendant le prototypage, non reproduit dans ce dépôt.
- Claude (Anthropic) : assistance à l'écriture du code et de la documentation.
- Les enregistrements audio sont la voix d'un locuteur bàsàa ; ils ne peuvent pas être réutilisés sans son accord.
