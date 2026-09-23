OMR EPS - WEB APP v1

Cette version est un site statique : aucune base de données ni serveur applicatif n'est nécessaire.
Les photos sont traitées dans le navigateur avec OpenCV.js.

HEBERGEMENT GRATUIT RECOMMANDE
- GitHub Pages : dépôt public avec GitHub Free.
- Cloudflare Pages : offre gratuite possible.

FICHIERS A PUBLIER
index.html
manifest.webmanifest
sw.js

GITHUB PAGES
1. Créer un dépôt public, par exemple omr-eps.
2. Envoyer les 3 fichiers à la racine.
3. Settings > Pages > Deploy from a branch > main / root.
4. GitHub fournit ensuite une URL publique.

IMPORTANT
Cette v1 charge OpenCV.js et jsPDF depuis Internet. Une fois la page chargée, les photos restent traitées localement dans le navigateur.
La robustesse doit être testée sur de vraies fiches imprimées et photographiées.
