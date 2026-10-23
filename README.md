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
Les fichiers Java et IntelliJ ne sont pas publiés.

## Installer et utiliser hors ligne

Sur iPhone : ouvrir le site HTTPS dans Safari, puis **Partager > Sur l’écran
d’accueil** (activer **Ouvrir comme app web** si proposé).
Sur Android : utiliser **Installer l’application** dans le menu du navigateur.
Ouvrir l’application une première fois avec une connexion et attendre
**Prête à fonctionner hors ligne** avant de passer en mode avion.
Le cache et le stockage restent soumis aux politiques de conservation du
navigateur et du système.

## Développement

Servir le dossier avec un serveur HTTP statique sur `localhost`, par exemple :

```sh
python -m http.server 8000
```

Ouvrir `http://localhost:8000`. Le service worker nécessite HTTPS ou localhost,
pas une ouverture directe de `index.html` ni une adresse HTTP du réseau local.

Les tests de calcul et de validation utilisent uniquement le runner intégré de
Node.js (version 18 ou supérieure) :

```sh
node --test
```

Après toute modification des fichiers web, incrémenter `CACHE_NAME` dans `sw.js`.
Après publication, ouvrir l’application en ligne pour télécharger la mise à jour,
puis fermer toutes ses fenêtres et la rouvrir pour activer la nouvelle version.
La mise à jour du cache ne supprime pas les données de ménage.
