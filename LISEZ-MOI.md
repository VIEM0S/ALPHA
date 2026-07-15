# Patch ALPHA #03 — Annulation de vente migrée côté serveur

À extraire à la racine du dépôt, **après** les patches #01 et #02 (ce patch
remplace à nouveau `sales/page.tsx` et `firestore.rules` — c'est la version
la plus à jour des trois, elle inclut tout : export CSV, retours, ET
annulation serveur).

## Ce qui change

- **`app/api/sales/cancel/route.ts`** (nouveau) — reprend exactement la
  logique qui était dans `handleCancel` côté client, mais côté serveur :
  - Revérifie que la vente est bien `COMPLETED` avant d'annuler (bloque une
    double annulation, et bloque l'annulation d'une vente déjà partiellement
    retournée — sinon le stock déjà réintégré par un retour serait réintégré
    une deuxième fois).
  - Restaure le stock dans une transaction Firestore (lecture avant écriture,
    même pattern que `checkout`/`receive`/`returns`).
  - **Bonus fix au passage** : le code client d'origine cherchait la ligne
    d'inventaire par `productId` seul, sans filtrer par `storeId`. Sur un
    compte multi-magasins, une annulation aurait pu réintégrer le stock du
    mauvais magasin (le premier trouvé pour ce produit, peu importe lequel).
    La route serveur filtre maintenant par `storeId` de la vente, comme
    `returns/create`.

- **`firestore.rules`** — `sales.update` passe de `isManager()` à `false` :
  plus aucune écriture client sur `sales` n'est autorisée, tout passe
  désormais par les 3 routes serveur (`checkout`, `cancel`, `returns/create`).
  **Redéployer les règles après extraction.**

- **`app/(dashboard)/sales/page.tsx`** — `handleCancel` appelle maintenant
  `/api/sales/cancel` au lieu d'écrire directement dans Firestore. Les
  imports `where`, `addDoc`, `updateDoc`, `doc`, `serverTimestamp` de
  `firebase/firestore` ont été retirés car plus utilisés dans ce fichier.

## Cohérence obtenue

Les 4 opérations qui touchent au stock ou à l'argent sur une vente
(`checkout`, `cancel`, `receive` d'un bon de commande, `returns/create`)
passent maintenant toutes par une route serveur avec transaction Firestore
et recalcul/revérification côté Admin SDK. Plus aucune ne fait confiance à
un calcul fait côté client.

## À tester

Annuler une vente COMPLETED sur un compte avec plusieurs magasins actifs →
vérifier que le stock remonte bien dans le **bon** magasin (celui de la
vente), pas dans un autre magasin qui aurait le même produit en stock.
