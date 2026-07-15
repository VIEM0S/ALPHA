# Patch ALPHA — corrections + 3 nouvelles fonctionnalités

À extraire **directement à la racine du dépôt ALPHA** (les chemins reproduisent
l'arborescence exacte du projet — écrase les fichiers existants concernés,
crée les nouveaux).

## 1. Corrections de sécurité (audit précédent)

- **`app/api/users/create/route.ts`** — 🔴 P1 corrigé : vérifie maintenant
  `tenantId === callerTenantId`, comme `update`/`delete`/`toggle-status`.
  Empêchait un ADMIN d'un tenant de créer un utilisateur dans un autre tenant.
- **`app/api/cash-register/close/route.ts`** — 🟠 P2 corrigé : `openingBalance`,
  `openedBy`, `openedAt` sont maintenant relus depuis la RTDB via l'Admin SDK
  (source de vérité serveur) au lieu d'être acceptés tels quels depuis le
  corps de la requête. Bloque aussi une double clôture (`status !== 'OPEN'`).

## 2. Bons de commande fournisseurs (achats)

- **`app/api/purchase-orders/create/route.ts`** — crée un bon de commande
  (statut `DRAFT` ou `SENT`), référence auto-générée (`BC-2026-0001`...).
  N'impacte jamais le stock à la création.
- **`app/api/purchase-orders/receive/route.ts`** — réceptionne tout ou partie
  d'un bon de commande : incrémente le stock (transaction Firestore, même
  logique anti-race-condition que `checkout`), crée les mouvements de stock
  `IN`, met à jour `purchasePrice` du produit avec le dernier coût connu, et
  fait passer le bon en `PARTIALLY_RECEIVED` ou `RECEIVED`.
- Nouveau type `PurchaseOrder`/`PurchaseOrderItem` dans `lib/types/index.ts`.
- Nouvelle collection `purchase_orders` déclarée dans `lib/firebase/collections.ts`.

**Il manque encore** : la page UI `app/(dashboard)/purchase-orders/page.tsx`
(liste + formulaire de création + écran de réception) — je n'ai fait que le
backend pour rester dans un patch raisonnable à relire. Je peux te la
générer ensuite sur le modèle de `suppliers/page.tsx` si tu veux.
**Il manque aussi** : les règles `firestore.rules` pour la nouvelle collection
`purchase_orders` (lecture : `belongsToTenant` ; écriture : `isManager()`,
même pattern que `suppliers`) — à ajouter avant de déployer, sinon le
client Firestore ne pourra pas lire la liste des bons de commande.

## 3. Retours / remboursements clients

- **`app/api/sales/returns/create/route.ts`** — traite un retour sur une
  vente déjà finalisée : recalcule le remboursement à partir des vrais prix
  d'origine, vérifie qu'on ne rembourse pas plus que ce qui a été acheté
  (`returnedQuantity` existait déjà dans le type `SaleItem`, juste jamais
  utilisé), réintègre le stock seulement pour les articles marqués
  "restockable", passe la vente en `REFUNDED`/`PARTIALLY_REFUNDED`, et pose
  une alerte `REFUND` (le type `AlertType` avait aussi déjà cette valeur
  prévue mais non utilisée).
- Manager+ requis, comme l'annulation de vente.
- Nouveau type `SaleReturn`/`SaleReturnItem` dans `lib/types/index.ts`.
- Nouvelle collection `sale_returns` déclarée dans `lib/firebase/collections.ts`.

**Il manque** : le bouton "Retourner" sur `sales/page.tsx` (aujourd'hui le
bouton existant est juste un label d'annulation) et l'UI de sélection des
articles à retourner — backend prêt, à brancher.
**Il manque aussi** : les règles `firestore.rules` pour `sale_returns` (même
pattern que `credits` : lecture `belongsToTenant`, écriture bloquée côté
client car tout passe par cette route Admin SDK).

## 4. Export CSV

- **`lib/utils/export.ts`** — utilitaire générique sans dépendance externe
  (`exportToCsv`, `toCsvString`, `formatDateForCsv`). Séparateur `;` + BOM
  UTF-8 pour un import propre dans Excel avec les accents français.
- **`app/(dashboard)/sales/page.tsx`** — bouton "Exporter CSV" ajouté à côté
  du titre, exporte la liste actuellement filtrée (respecte les filtres
  statut/date déjà en place sur la page). Facile à copier-coller sur
  `inventory`, `credits`, `customers` etc. — le pattern est le même partout :
  ```ts
  exportToCsv('nom-fichier', tonTableauDejaFiltré, [
    { key: 'champ', label: 'En-tête colonne' },
    { key: 'date', label: 'Date', format: (v) => formatDateForCsv(v) },
  ]);
  ```

## Points de vigilance avant déploiement

1. Ajouter les règles `firestore.rules` manquantes (`purchase_orders`, `sale_returns`)
   listées ci-dessus — sans elles, la lecture côté client échouera silencieusement.
2. Le `.gitignore` actuel du dépôt exclut `*.json`, donc `package.json`/`tsconfig.json`
   ne sont pas versionnés — je n'ai pas pu lancer un vrai `tsc` sur le projet
   complet. J'ai vérifié la syntaxe fichier par fichier (cohérente avec le
   style des routes existantes comme `checkout/route.ts`), mais un `npm run
   build` local avant déploiement reste indispensable.
3. Tester la réception de commande et le retour client sur un tenant de test
   avant la prod — ce sont deux endpoints qui touchent au stock et à l'argent.
