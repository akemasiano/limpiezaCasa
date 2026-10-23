# Hello PWA

Une petite application web en français : un bouton révèle **Hello World !**
et déclenche un feu d'artifice. Aucun framework, dépendance externe, compte
Apple développeur ou serveur applicatif n'est nécessaire.

## Publier gratuitement sur GitHub Pages

1. Créer un dépôt public sur GitHub si vous utilisez GitHub Free, puis y envoyer
   ce projet sur la branche `main` ou `master`.
2. Dans **Settings > Pages > Build and deployment > Source**, choisir
   **GitHub Actions**.
3. Dans **Actions**, lancer le workflow **Deploy PWA to GitHub Pages** si
   nécessaire. Les prochains envois sur `main` ou `master` déclencheront la publication.
4. Ouvrir l'adresse indiquée par le déploiement, généralement
   `https://PSEUDO.github.io/NOM-DU-DEPOT/`.

Le workflow publie uniquement les fichiers web, pas le projet Java/IntelliJ.
Les chemins relatifs permettent une publication dans un sous-répertoire.
Si votre branche principale porte encore un autre nom, adapter `branches` dans
`.github/workflows/pages.yml`.

## Installer sur iPhone

Ouvrir l'adresse HTTPS dans Safari, puis **Partager > Sur l'écran d'accueil**
(activer **Ouvrir comme app web** si cette option est proposée).
Ouvrir ensuite l'application depuis son icône, avec une connexion pour ce premier
lancement, et attendre **Prête à fonctionner hors ligne** avant de tester
en mode avion.

Les fichiers sont mis en cache par un service worker. L'application fonctionne
alors hors ligne, sans compte utilisateur ni collecte de données.
La suppression des données du site peut supprimer le cache et nécessiter un
nouveau chargement connecté. La conservation du cache dépend également d'iOS.
Si la préférence système de réduction des animations est activée, le message
apparaît sans feu d'artifice.

## Développement local et mises à jour

Servir ce dossier avec un serveur HTTP statique sur `localhost` et ouvrir son
adresse dans le navigateur. Par exemple, si Python est installé :

```sh
python -m http.server 8000
```

Ouvrir `http://localhost:8000`. Ne pas ouvrir directement `index.html` en
`file://` : le service worker nécessite HTTPS ou `localhost`.
Sur iPhone, une adresse HTTP du réseau local ne suffit pas pour le mode
hors ligne ; utiliser le site HTTPS publié pour ce test.

Lors d'une modification des fichiers web, incrémenter la version de
`CACHE_NAME` dans `sw.js` pour renouveler le cache. Après publication, ouvrir
l'application en ligne pour télécharger la mise à jour, puis fermer toutes
ses fenêtres et la rouvrir pour activer la nouvelle version.
