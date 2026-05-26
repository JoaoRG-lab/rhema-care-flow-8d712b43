#!/usr/bin/env bash
# Promove um arquivo de sandbox/ para src/ via git mv.
# uso: scripts/promote.sh sandbox/experiments/foo.ts src/lib/foo.ts
set -euo pipefail
SRC="${1:?origem (sandbox/...) obrigatória}"
DST="${2:?destino (src/...) obrigatório}"

[[ "$SRC" == sandbox/* ]] || { echo "erro: origem deve estar em sandbox/"; exit 1; }
[[ "$DST" == src/* ]] || { echo "erro: destino deve estar em src/"; exit 1; }
[[ -f "$SRC" ]] || { echo "erro: $SRC não existe"; exit 1; }

mkdir -p "$(dirname "$DST")"
git mv "$SRC" "$DST"
echo "✓ promovido: $SRC → $DST"
echo "→ revise, commite e abra um PR."
