# STL Scolaire Laval

Application Angular mobile-first qui aide un élève à trouver la ligne scolaire STL de retour passant le plus près de son adresse à Laval.

## Ce que fait le site

- choix parmi 8 écoles;
- autocomplétion et géocodage d’une adresse limitée à Laval;
- comparaison locale avec les tracés géographiques des 50 lignes de retour;
- jusqu’à 3 résultats lorsqu’un même secteur est desservi par plusieurs lignes;
- numéro d’emplacement dans la cour lorsque le plan le précise;
- carte Leaflet/OpenStreetMap interactive;
- accès aux 50 PDF de tracés gauche-droite et aux 8 plans de cour, classés par école;
- résultats de référence garantis pour `Collège Letendre + 363 rue Cayer → 75C, emplacement 3` et `Collège Laval + 1163 place d’Aiguillon → 84C, emplacements 2 et 3`.

## Démarrer le projet

Prérequis : Node.js 22.12 ou plus récent.

```bash
npm install --legacy-peer-deps
npm start
```

Le site sera disponible sur `http://localhost:4200`.

## Vérifier

```bash
npm test
npm run build:cloudflare
```

## Déployer gratuitement sur Cloudflare Pages

Le projet est une application statique, sans SSR. Le fichier `wrangler.jsonc`, les redirections SPA et les en-têtes sont déjà prêts.

```bash
npm run deploy:cloudflare
```

Au premier déploiement, Wrangler demandera de se connecter à un compte Cloudflare et de choisir ou créer le projet Pages `stl-scolaire-laval`.

Avec l’intégration Git Cloudflare Pages :

- commande de build : `npm run build:cloudflare`
- dossier de sortie : `dist/cloudflare/browser`

## Données et confidentialité

Les documents intégrés correspondent à l’année scolaire 2026–2027, mise à jour STL d’août 2026. Les tracés sont dans `public/data/routes.geojson`; les PDF sont sous `public/documents`.

L’adresse entrée n’est pas enregistrée par l’application. Elle est envoyée au service public ArcGIS World Geocoding avec `forStorage=false` uniquement pour obtenir ses coordonnées. Le calcul de proximité avec les lignes est ensuite effectué directement dans le navigateur.

Sources : portail STL Omnibus et expérience cartographique ArcGIS STL fournis pour ce projet.
