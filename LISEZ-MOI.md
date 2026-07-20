# Patch ALPHA #04 — Retour à l'accueil depuis les pages d'authentification

À extraire à la racine du dépôt. Corrige exactement ce que tu as repéré sur
la capture : aucune des pages `/login`, `/forgot-password`, `/setup`
n'offrait de moyen de revenir à la page d'accueil (`/`) — le logo/titre
n'était pas cliquable, et il n'y avait aucun autre lien de sortie.

## Ce qui change (3 fichiers)

- **`app/(auth)/login/page.tsx`**
- **`app/(auth)/forgot-password/page.tsx`**
- **`app/(onboarding)/setup/page.tsx`**

Sur chaque page :
- Un lien texte **"← Retour à l'accueil"** en haut, au-dessus de la carte —
  visible et sans ambiguïté, et qui fonctionne même si le formulaire est en
  train de charger (ce n'est pas un bouton désactivé pendant
  `isLoading`, contrairement au bouton "Se connecter").
- Le logo + titre "Yerkoy ERP" redeviennent aussi cliquables vers `/`.

Sur **`setup`** spécifiquement (formulaire en plusieurs étapes) : cliquer
"Retour à l'accueil" déclenche une confirmation ("Quitter la configuration ?
Les informations déjà saisies seront perdues.") **seulement si** l'utilisateur
a déjà commencé à remplir le formulaire (nom d'entreprise, email, prénom...).
Sur `login` et `forgot-password`, pas de confirmation nécessaire — rien à
perdre.

## Ce que ça règle concrètement

Le scénario que tu décrivais : quelqu'un clique "Se connecter" par erreur
depuis l'accueil, ou est sur `/login` et veut plutôt créer un nouveau compte
(un autre que celui pré-rempli), ou est juste bloqué sur "Connexion en
cours..." et veut sortir — il y a maintenant toujours un chemin de retour
visible en haut de chaque écran.
