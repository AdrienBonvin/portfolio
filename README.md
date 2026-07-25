# Portfolio — Adrien Bonvin

Mon portfolio personnel, pensé comme un voyage spatial : une scène 3D néon dans laquelle la caméra avance au fil du scroll, d'objet céleste en objet céleste — planète à anneaux, trou noir, supernova, galaxie, et des constellations interactives en guise de liens de contact.

## Stack

- [React](https://react.dev) + [TypeScript](https://www.typescriptlang.org) + [Vite](https://vite.dev)
- [React Three Fiber](https://r3f.docs.pmnd.rs) / [drei](https://drei.docs.pmnd.rs) / postprocessing pour la scène 3D
- [Tailwind CSS v4](https://tailwindcss.com)

## Quelques détails sympas

- Caméra pilotée par le scroll, synchronisée sur les vraies positions des sections
- Effet warp quand on scrolle vite, comètes au clic, curseur néon custom
- Liens de contact dessinés en constellations (au survol, elles se remplissent)
- FR/EN selon la langue du navigateur, avec toggle manuel
- Expérience mobile dédiée : les objets célestes ont chacun leur écran plein cadre, interactions au tap

## Lancer en local

```bash
npm install
npm run dev
```

## Déploiement

Firebase Hosting, projet `adrien-bonvin-portfolio`. Tout merge sur `main` déploie en
production via GitHub Actions ; chaque pull request reçoit une URL de preview
temporaire en commentaire.

Le workflow attend un secret de repo `FIREBASE_SERVICE_ACCOUNT_ADRIEN_BONVIN_PORTFOLIO`
contenant la clé JSON d'un service account ayant le rôle *Firebase Hosting Admin*.
`firebase init hosting:github` le crée et le pousse tout seul.

À la main, si besoin :

```bash
npm run build && firebase deploy --only hosting
```
