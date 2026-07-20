#!/usr/bin/env bash
#
# rename-to-yerkoy.sh
# Renomme le projet "Yerkoy" en "Yerkoy ERP" dans tout le repo.
#
# USAGE:
#   ./rename-to-yerkoy.sh            -> dry-run (affiche ce qui serait changé, ne touche rien)
#   ./rename-to-yerkoy.sh --apply    -> applique réellement les changements
#   ./rename-to-yerkoy.sh --apply --rename-dirs   -> applique + renomme aussi les dossiers/fichiers contenant "alpha"
#
# Lancer ce script DEPUIS LA RACINE du repo (là où se trouve .git et package.json).

set -euo pipefail

APPLY=false
RENAME_DIRS=false
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=true ;;
    --rename-dirs) RENAME_DIRS=true ;;
  esac
done

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

echo -e "${BLUE}=== Renommage Yerkoy -> Yerkoy ERP ===${NC}"
if [ "$APPLY" = false ]; then
  echo -e "${YELLOW}Mode DRY-RUN (aucun fichier ne sera modifié). Relance avec --apply pour appliquer.${NC}"
fi
echo ""

# --- 0. Sécurité : vérifier qu'on est bien dans un repo git ---
if [ ! -d ".git" ]; then
  echo -e "${RED}Erreur : pas de dossier .git ici. Lance ce script depuis la racine du repo.${NC}"
  exit 1
fi

if [ "$APPLY" = true ]; then
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo -e "${RED}Erreur : tu as des changements non commités. Commit ou stash avant de lancer --apply.${NC}"
    exit 1
  fi
  BRANCH="rename/yerkoy-erp"
  echo -e "${BLUE}Création de la branche ${BRANCH}...${NC}"
  git checkout -b "$BRANCH" 2>/dev/null || git checkout "$BRANCH"
fi

# --- 1. Dossiers/fichiers à exclure de la recherche ---
EXCLUDE_DIRS=(-path "*/node_modules/*" -o -path "*/.git/*" -o -path "*/.next/*" -o -path "*/dist/*" -o -path "*/build/*" -o -path "*/.firebase/*")

# --- 2. Variantes de casse à remplacer ---
# Ordre important : du plus spécifique au plus générique.
declare -A REPLACEMENTS=(
  ["Yerkoy ERP"]="Yerkoy ERP"
  ["Yerkoy ERP"]="Yerkoy ERP"
  ["Yerkoy"]="Yerkoy"
  ["Yerkoy"]="Yerkoy"
  ["YERKOY"]="YERKOY"
  ["YERKOY"]="YERKOY"
  ["YERKOY"]="YERKOY"
  ["yerkoy"]="yerkoy"
  ["yerkoy-erp"]="yerkoy-erp"
  ["yerkoy_erp"]="yerkoy_erp"
)

# --- 3. Trouver les fichiers concernés (texte uniquement) ---
echo -e "${BLUE}Recherche des fichiers contenant une variante de 'Yerkoy'...${NC}"
MATCHES=$(grep -riIl --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next \
  --exclude-dir=dist --exclude-dir=build --exclude-dir=.firebase \
  -E "yerkoy|pro[-_ ]alpha" . 2>/dev/null || true)

if [ -z "$MATCHES" ]; then
  echo -e "${YELLOW}Aucune occurrence trouvée dans le contenu des fichiers.${NC}"
else
  COUNT=$(echo "$MATCHES" | wc -l)
  echo -e "${GREEN}${COUNT} fichier(s) trouvé(s) :${NC}"
  echo "$MATCHES" | sed 's/^/  - /'
fi
echo ""

# --- 4. Appliquer (ou simuler) les remplacements ---
if [ -n "$MATCHES" ]; then
  echo -e "${BLUE}Remplacement du texte...${NC}"
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    for old in "${!REPLACEMENTS[@]}"; do
      new="${REPLACEMENTS[$old]}"
      if [ "$APPLY" = true ]; then
        # sed -i portable (Linux)
        sed -i "s/${old}/${new}/g" "$file"
      else
        HITS=$(grep -o "$old" "$file" | wc -l)
        if [ "$HITS" -gt 0 ]; then
          echo -e "  ${YELLOW}$file${NC} : ${HITS}x '${old}' -> '${new}'"
        fi
      fi
    done
  done <<< "$MATCHES"
fi
echo ""

# --- 5. package.json : champ "name" spécifiquement en kebab-case propre ---
if [ -f "package.json" ]; then
  echo -e "${BLUE}Mise à jour de package.json (champ name)...${NC}"
  if [ "$APPLY" = true ]; then
    node -e "
      const fs = require('fs');
      const p = JSON.parse(fs.readFileSync('package.json','utf8'));
      p.name = 'yerkoy-erp';
      fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n');
    " 2>/dev/null || sed -i 's/"name": *".*"/"name": "yerkoy-erp"/' package.json
    echo -e "  ${GREEN}name -> yerkoy-erp${NC}"
  else
    echo -e "  ${YELLOW}name -> yerkoy-erp (dry-run)${NC}"
  fi
fi
echo ""

# --- 6. Renommage des dossiers/fichiers contenant "alpha" (optionnel) ---
if [ "$RENAME_DIRS" = true ]; then
  echo -e "${BLUE}Recherche des dossiers/fichiers dont le nom contient 'alpha'...${NC}"
  PATH_MATCHES=$(find . -iname "*alpha*" \
    -not -path "*/node_modules/*" -not -path "*/.git/*" \
    -not -path "*/.next/*" -not -path "*/dist/*" -not -path "*/build/*" \
    | sort -r)  # -r pour renommer les fichiers avant les dossiers parents

  if [ -z "$PATH_MATCHES" ]; then
    echo -e "${YELLOW}Aucun fichier/dossier trouvé.${NC}"
  else
    while IFS= read -r path; do
      [ -z "$path" ] && continue
      dir=$(dirname "$path")
      base=$(basename "$path")
      newbase=$(echo "$base" | sed -E 's/Yerkoy/Yerkoy/g; s/yerkoy/yerkoy/g; s/YERKOY/YERKOY/g; s/Alpha/Yerkoy/g; s/alpha/yerkoy/g; s/ALPHA/YERKOY/g')
      if [ "$base" != "$newbase" ]; then
        newpath="$dir/$newbase"
        if [ "$APPLY" = true ]; then
          git mv "$path" "$newpath" 2>/dev/null || mv "$path" "$newpath"
          echo -e "  ${GREEN}$path -> $newpath${NC}"
        else
          echo -e "  ${YELLOW}$path -> $newpath (dry-run)${NC}"
        fi
      fi
    done <<< "$PATH_MATCHES"
  fi
  echo ""
fi

# --- 7. Commit ---
if [ "$APPLY" = true ]; then
  git add -A
  git commit -m "chore: rename project from Yerkoy to Yerkoy ERP" || echo -e "${YELLOW}Rien à commit.${NC}"
  echo -e "${GREEN}Terminé. Branche : $(git branch --show-current)${NC}"
  echo ""
  echo -e "${BLUE}Étapes restantes à faire manuellement :${NC}"
  echo "  1. Vérifie le diff : git diff main...$(git branch --show-current)"
  echo "  2. Renomme le repo sur GitHub : Settings -> repository name -> yerkoy-erp"
  echo "     (GitHub redirige automatiquement l'ancienne URL, mais mets à jour tes remotes locaux :"
  echo "      git remote set-url origin git@github.com:VIEM0S/yerkoy-erp.git)"
  echo "  3. Vérifie les variables d'env Firebase (project id, storage bucket) si elles contiennent 'yerkoy'."
  echo "  4. Vérifie les titres/meta dans les fichiers HTML/layout (balises <title>, manifest.json, favicon)."
  echo "  5. Merge la branche $(git branch --show-current) dans main quand tu es satisfait."
else
  echo -e "${YELLOW}Dry-run terminé. Relance avec --apply pour appliquer réellement.${NC}"
  echo -e "${YELLOW}Ajoute --rename-dirs pour aussi renommer les dossiers/fichiers contenant 'alpha'.${NC}"
fi
