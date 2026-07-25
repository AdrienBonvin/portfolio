# Portfolio — conventions de travail

## Déployer à chaque push

Du code poussé sur ce repo va en production, sans attendre qu'on le demande :

1. pousser la branche de travail ;
2. ouvrir la pull request — le workflow `Deploy preview on pull request` publie une
   URL de preview en commentaire ;
3. merger sur `main` — c'est le merge qui déclenche le déploiement Firebase Hosting
   (`Deploy to Firebase Hosting on merge`), rien d'autre ;
4. attendre que ce workflow soit vert avant d'annoncer que c'est déployé. Un push
   sur une branche ne déploie rien.

Le build lance `tsc -b && vite build` : une erreur de type fait échouer le déploiement,
donc `npm run build` doit passer en local avant de pousser.
