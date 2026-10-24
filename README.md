# Casa — Le ménage à votre rythme

PWA en français pour suivre le ménage de la maison, sans framework, serveur,
compte ni dépendance externe. Compatible avec GitHub Pages et installable sur
iPhone et Android. Casa est une application indépendante, sans affiliation à Qleany.

## Suivre son ménage

Ajouter une tâche avec une pièce, une fréquence en jours de présence et,
facultativement, la date du dernier ménage. Sans date, la tâche est immédiatement
à faire. Le bouton **C’est fait** enregistre la date du jour et relance son compteur.
**Modifier** permet de corriger la date, de changer la pièce ou de supprimer la
tâche. Les exemples sont facultatifs et modifiables. Les filtres permettent de
voir une pièce ou uniquement les tâches à faire.

Les données sont enregistrées dans le stockage local du navigateur de cet
appareil. Elles persistent après fermeture et fonctionnent hors ligne, mais ne
sont pas synchronisées entre appareils ou navigateurs. Supprimer les données
du site supprime aussi le suivi. Un échec de lecture bloque les modifications
pour ne pas écraser les données existantes ; un échec d’écriture est affiché
et n’est jamais présenté comme un enregistrement réussi.

## Interface sur téléphone

Trois vues distinctes évitent de charger l’accueil : **Maison** affiche uniquement
le résumé, les tâches et leurs filtres ; **Absences** regroupe les pauses et leur
historique ; **Données** regroupe les sauvegardes, la restauration, la protection
du stockage et l’aide à l’installation. Un rappel apparaît sur Maison pendant
une absence active. La navigation conserve les données et les filtres ; les liens
directs (`#maison`, `#absences`, `#donnees`) et le retour du navigateur fonctionnent.
Sur téléphone, une barre en bas permet de changer de vue ou d’ajouter une tâche.
Sur ordinateur, la navigation apparaît en haut. Les tâches s’affichent
sur une seule colonne et les contrôles offrent une zone tactile d’au moins
48 pixels. Les formulaires s’ouvrent en panneau bas défilable ; les champs
restent à 16 pixels pour éviter le zoom automatique de saisie sur iPhone.
L’interface tient compte des zones de sécurité de l’écran.

## Protéger ses données et changer d’iPhone

La section **Protéger mes données** propose trois actions, sans compte :

- **Protéger le stockage local** appelle `navigator.storage.persist()` après
  un clic, si disponible. Le statut indique si la protection est accordée,
  refusée, indisponible ou impossible à vérifier. Elle n’est jamais garantie :
  le navigateur décide, et elle ne protège pas d’un effacement volontaire.
- **Sauvegarder dans un fichier** produit un fichier JSON versionné contenant
  toutes les tâches, pièces, fréquences, dates de dernier ménage et absences.
  Si le partage de fichiers est disponible, choisir **Enregistrer dans Fichiers**
  puis iCloud Drive dans la feuille de partage iOS. Sinon, récupérer le fichier
  dans les téléchargements. Vérifier sa présence : Casa ne peut pas vérifier
  que le fichier a effectivement été conservé. Un partage annulé est signalé.
- **Restaurer une sauvegarde** lit et valide entièrement un fichier Casa
  (10 Mo maximum), puis demande confirmation avec sa date et son contenu.
  La restauration **remplace** les données actuelles, sans fusion. Une annulation,
  un fichier invalide ou une erreur d’écriture ne remplace pas les données.
  Une sauvegarde valide peut aussi remplacer un stockage illisible après
  confirmation explicite ; les autres modifications restent bloquées.

Sur iPhone, installer Casa sur l’écran d’accueil et l’utiliser depuis son icône,
hors navigation privée. Le stockage peut différer entre Safari et l’application
installée : exporter puis restaurer permet de transférer le suivi si nécessaire.
Conserver une copie hors du stockage de Casa, idéalement dans iCloud Drive, et la
renouveler après les changements importants. Avant un changement d’iPhone,
exporter sur l’ancien puis restaurer le fichier sur le nouveau.
Les sauvegardes contiennent les noms des pièces et les dates d’absence :
les conserver dans un emplacement privé. Aucun fichier n’est envoyé à un serveur
par Casa ; un partage ou un enregistrement dans iCloud Drive dépend du choix de
l’utilisateur. Il n’y a pas de sauvegarde ni de synchronisation automatique.

## Vacances : deux façons de mettre en pause

- **Je pars aujourd’hui** suspend le suivi jusqu’au clic sur **Je suis de retour**.
- **Programmer une absence** définit un départ et un retour ; la pause et la
  reprise sont calculées automatiquement, même sans ouvrir l’application.

Le jour du départ est exclu du décompte ; le jour du retour compte normalement.
Les calculs utilisent des dates calendaires locales, pas des durées de 24 heures,
pour éviter les décalages liés aux changements d’heure.
Par exemple, un ménage effectué le 1er, un départ le 4 et un retour le 11 donnent
**3 jours de présence écoulés** le 11, et non 10. Les retards déjà présents au
départ sont conservés, pas effacés. Les absences qui se chevauchent ne sont
déduites qu’une fois.

Le retour manuel termine **toutes les absences en cours** aujourd’hui, y compris
une absence programmée ; il conserve les absences futures. Partir et revenir le
même jour annule simplement cette pause. Le bouton de validation du ménage est
désactivé pendant une absence ; une date de ménage peut toujours être corrigée
dans le formulaire de modification. Les absences passées sont conservées pour
les calculs. Les supprimer recalcule les compteurs, et demande confirmation.
On peut aussi saisir une absence passée pour corriger le suivi.

## Publier sur GitHub Pages

Le workflow `.github/workflows/pages.yml` publie les fichiers web uniquement
lors d’un envoi sur `main` ou `master`. Dans **Settings > Pages > Build and
deployment > Source**, choisir **GitHub Actions** (déjà configuré si la démo
fonctionne). Le workflow peut aussi être lancé manuellement depuis **Actions**.

Adresse attendue : `https://akemasiano.github.io/limpiezaCasa/`.
Tous les chemins sont relatifs pour fonctionner dans ce sous-répertoire.
Les fichiers de développement et de configuration ne sont pas publiés.

## Installer et utiliser hors ligne

Sur iPhone : ouvrir le site HTTPS dans Safari, puis **Partager > Sur l’écran
d’accueil** (activer **Ouvrir comme app web** si proposé).
Sur Android : utiliser **Installer l’application** dans le menu du navigateur.
Ouvrir l’application une première fois avec une connexion et attendre
**Prête à fonctionner hors ligne** avant de passer en mode avion.
Le cache et le stockage restent soumis aux politiques de conservation du
navigateur et du système.

## Développement

Utiliser **Node.js 24 LTS**, également utilisé par le workflow GitHub Pages.
La version est indiquée dans `.nvmrc` et `package.json`.
Node.js sert aux tests et aux vérifications de développement : la PWA reste
statique, sans serveur Node.js en production et sans dépendance externe.
Les configurations locales IntelliJ (`.idea/`, `*.iml`) sont ignorées par Git ;
aucun projet Java n’est nécessaire.

Servir le dossier avec un serveur HTTP statique sur `localhost`, par exemple :

```sh
python -m http.server 8000
```

Ouvrir `http://localhost:8000`. Le service worker nécessite HTTPS ou localhost,
pas une ouverture directe de `index.html` ni une adresse HTTP du réseau local.

Les tests de calcul et de validation utilisent uniquement le runner intégré de
Node.js. Aucune installation de dépendances n’est nécessaire :

```sh
npm test
npm run check
```

Après toute modification des fichiers web, incrémenter `CACHE_NAME` dans `sw.js`.
Le déploiement GitHub Pages attribue aussi un nom de cache unique à chaque commit.
Casa recherche une mise à jour à l’ouverture, au retour dans l’application et au
retour de la connexion. Dans **Données**, **Rechercher une mise à jour** permet
de lancer cette vérification manuellement. Les fichiers de la nouvelle version
sont téléchargés sans réutiliser le cache HTTP.

Lorsqu’une version est prête, **Mettre à jour** l’active et recharge Casa.
Les autres fenêtres proposent un rechargement sans interrompre leurs formulaires.
Les anciens caches de Casa sont supprimés à l’activation ; les tâches et absences
dans le stockage local ne sont jamais effacées. Hors ligne ou en cas d’échec de
téléchargement, la version déjà installée reste utilisable.
Une ancienne version ne disposant pas encore de ces boutons doit être fermée
dans toutes ses fenêtres puis rouverte une première fois après le déploiement.
