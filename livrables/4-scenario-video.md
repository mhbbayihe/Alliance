# SafiLang — scénario de la vidéo de démonstration

Durée visée : 2 min 50 (maximum autorisé : 3 min). Capture d'écran d'Edge ou Chrome avec le son du système, voix off en français. Le scénario totalise environ 300 mots de voix off, soit un peu plus de 2 minutes à débit normal ; le reste du temps sert à laisser entendre les enregistrements éton.

## Avant de filmer

- [ ] Recharger l'extension dans `edge://extensions`, puis recharger la page de test.
- [ ] Fermer la bulle « extensions en mode développeur » avec la croix, sans cliquer sur « Désactiver ».
- [ ] Ouvrir `https://safinum.cm/hackathon-test`, langue de l'extension sur « Page d'origine ».
- [ ] Activer l'enregistrement du son du système (les enregistrements éton doivent s'entendre).
- [ ] Zoom du navigateur à 110 % ou 125 % pour que les textes soient lisibles dans la vidéo.
- [ ] Ne montrer comme validés que les textes relus par un locuteur.

## Déroulé

| Temps | À l'écran | Voix off |
|---|---|---|
| 0:00 – 0:20 | Page de test en français, sans rien toucher. Passer lentement la souris sur le solde, puis sur « Effectuer un transfert ». | « Au Cameroun, les services financiers numériques sont en français ou en anglais. Une personne qui lit mal ces langues ne peut pas vérifier seule un solde, des frais ou le nom d'un bénéficiaire. SafiLang lui donne ces informations dans sa langue, sans toucher au service. » |
| 0:20 – 0:40 | Cliquer sur le bouton « Langue » en bas à gauche, choisir « Eton ». Toute la page change. Montrer le solde 250 000 FCFA et le numéro de compte, restés identiques. | « SafiLang est une extension de navigateur. Je choisis l'éton : tous les textes changent immédiatement. Les montants, les noms et les numéros, eux, ne changent jamais : l'extension ne réécrit que les libellés qu'elle reconnaît. » |
| 0:40 – 1:00 | Survoler « Mɔ̀ní à reste là » : le haut-parleur apparaît. Cliquer, laisser l'enregistrement se jouer en entier. Faire de même sur « Lóm mɔ̀ní ». | « Pour ceux qui ne lisent pas, chaque texte peut s'écouter. C'est la voix d'un locuteur, enregistrée phrase par phrase. » *(se taire pendant les deux écoutes)* |
| 1:00 – 1:35 | Cliquer « Lóm mɔ̀ní ». Étape frais : choisir Mobile Money dans la liste, montrer la ligne de frais avec 1,5 %, 100 et 2 500 FCFA, puis le total. Cliquer « Kə̀ èè ». Étape bénéficiaire : montrer le nom et le numéro dans les champs. | « Je prépare un transfert. À l'étape des frais, la phrase est traduite mais le taux, le minimum et le maximum sont recopiés tels quels. À l'étape du bénéficiaire, le nom et le numéro saisis ne sont jamais modifiés. » |
| 1:35 – 2:00 | Cliquer « Kə̀ èè » sans cocher la case : l'alerte de sécurité apparaît en éton, avec son code SECURITY_001. Écouter l'alerte. Cocher la case, continuer jusqu'au récapitulatif, cocher, confirmer : reçu affiché. | « Si j'oublie de vérifier le bénéficiaire, l'alerte de sécurité du service s'affiche en éton, avec son code d'origine, et je peux l'écouter. Je vérifie, je confirme : le reçu reprend le montant, les frais et le bénéficiaire, à l'identique. » |
| 2:00 – 2:20 | Ouvrir le panneau jury (`?jury=1`) ou le journal d'intégrité de la page : étapes marquées « intact ». | « La page de test contrôle elle-même l'intégrité des valeurs à chaque étape : avec SafiLang, toutes les étapes restent intactes. Le code du service n'a pas été modifié, et l'extension n'envoie aucune donnée. » |
| 2:20 – 2:40 | Injecter un message inédit depuis le panneau jury. Montrer le message à l'écran : il est resté dans sa langue d'origine, inchangé, au milieu de la page traduite. | « Face à un message jamais vu, SafiLang ne devine pas. Il le laisse dans sa langue d'origine, intact. Dans un service financier, une traduction fausse est plus dangereuse qu'une absence de traduction. » |
| 2:40 – 2:50 | Revenir sur « Page d'origine » d'un clic : la page reprend son français exact. Écran de fin : SafiLang, nom de l'équipe. | « Éton et bàsàa, en texte et en voix. La même méthode s'applique à tout autre service et à toute autre langue nationale. SafiLang. » |

## Points à vérifier avant le montage

- **Panneau jury** : la séquence 2:00 – 2:40 utilise `?jury=1`, que l'équipe n'a pas encore essayé avec l'extension. Le tester avant de filmer ; s'il pose problème, montrer à la place le journal d'intégrité de la page.
- **Contenu inédit** : le scénario montre honnêtement le comportement actuel (message laissé tel quel). Si une réponse plus complète est développée d'ici le dépôt, réécrire la séquence 2:20 – 2:40.
- **Textes éton cités** : « Mɔ̀ní à reste là », « Lóm mɔ̀ní » et « Kə̀ èè » sont les libellés actuels de l'extension. Les remplacer dans ce scénario si le locuteur les corrige.
- **Enregistrements** : écouter à l'avance les fichiers joués dans la vidéo pour confirmer qu'ils disent bien la phrase affichée.
