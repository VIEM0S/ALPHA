# Patch ALPHA #02 — UI achats fournisseurs + retours + navigation + règles Firestore

À extraire à la racine du dépôt, **après** avoir déjà appliqué le patch #01
(`ALPHA-patch-01-achats-retours-export.zip`). Ce patch dépend du backend créé
dans le patch #01 (`/api/purchase-orders/*`, `/api/sales/returns/create`).

## Contenu

- **`firestore.rules`** — remplace le fichier existant. Ajoute les règles
  pour `purchase_orders` et `sale_returns` (lecture : membres du tenant ;
  écriture : `false` côté client — tout passe par les routes API Admin SDK,
  même logique que `sales`). **Pense à redéployer les règles**
  (`firebase deploy --only firestore:rules`), sinon les nouvelles pages
  afficheront une erreur de permission en lecture.

- **`app/(dashboard)/purchase-orders/page.tsx`** — nouvelle page complète :
  liste des bons de commande avec filtre par statut, création (choix
  fournisseur + lignes produit/quantité/coût, brouillon ou envoi direct),
  et réception (avec support de la réception partielle, une ligne à la fois).
  Export CSV inclus.

- **`app/(dashboard)/sales/page.tsx`** — remplace la version du patch #01 (elle
  inclut déjà le bouton export CSV **et** ajoute maintenant un vrai flux de
  retour : bouton "Retourner des articles" dans le panneau détail d'une
  vente complétée, avec sélection quantité/produit, case "remettre en stock"
  par article (pour les articles défectueux), motif obligatoire, et mode de
  remboursement.

- **`components/layout/sidebar-nav.tsx`** — ajoute "Bons de commande" dans le
  menu Stock (visible OWNER/ADMIN/MANAGER, cohérent avec le rôle requis par
  la route API).

## Point relevé au passage (hors scope de ce patch)

En regardant `handleCancel` dans `sales/page.tsx` pour brancher le retour à
côté, j'ai remarqué que l'annulation de vente fait ses écritures
(changement de statut + restauration de stock) **directement depuis le
client** via le SDK Firestore, protégée uniquement par `firestore.rules`
(`isManager()`), contrairement à `checkout` et maintenant aux retours qui
passent par une route serveur avec recalcul. Ce n'est pas une faille ouverte
— il faut déjà être Manager+ authentifié pour que les règles l'autorisent —
mais la logique de restauration de stock (quantité à réintégrer) est alors
calculée et déclenchée par le client plutôt que revérifiée côté serveur,
contrairement à toutes les autres écritures sensibles du projet. Si tu veux,
je peux migrer `handleCancel` vers une route `/api/sales/cancel` sur le
modèle de `returns/create` pour rester cohérent partout — dis-moi si ça
t'intéresse, je ne l'ai pas fait ici pour ne pas élargir le patch.

## Pour tester

1. Extraire ce zip à la racine, redéployer `firestore.rules`.
2. Créer un bon de commande (Stock → Bons de commande → Nouveau), l'envoyer,
   puis le réceptionner (même partiellement) → vérifier que le stock et le
   `purchasePrice` du produit se mettent à jour, et qu'un mouvement `IN`
   apparaît dans Stock → Mouvements.
3. Sur une vente complétée (Ventes → clic sur une ligne), cliquer
   "Retourner des articles", retourner une partie de la quantité, vérifier
   que le stock remonte (si "remettre en stock" coché), qu'une alerte
   `REFUND` apparaît, et que le statut de la vente passe à
   PARTIALLY_REFUNDED ou REFUNDED selon le cas.
