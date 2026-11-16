#!/bin/bash
# Arranca Studies4Kids en macOS. Lo ejecuta el servicio "com.studies4kids.app" al iniciar sesion.
# Tambien se puede lanzar a mano para probar:  bash scripts/iniciar.sh 3000
PUERTO="${1:-3000}"
PROYECTO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROYECTO" || exit 1

# Un servicio no hereda las rutas de la terminal: se anaden las carpetas habituales de Node.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
export NEXT_TELEMETRY_DISABLED=1
export NODE_ENV=production

DATOS="${DATA_DIR:-$PROYECTO/data}"
REGISTROS="$DATOS/logs"
REGISTRO="$REGISTROS/app.log"
mkdir -p "$REGISTROS"

# El registro no crece sin limite: al pasar de 5 MB se guarda como app.anterior.log y se empieza otro.
if [ -f "$REGISTRO" ]; then
  TAMANO="$(wc -c < "$REGISTRO" | tr -d ' ')"
  if [ "${TAMANO:-0}" -gt 5242880 ]; then mv -f "$REGISTRO" "$REGISTROS/app.anterior.log"; fi
fi
exec >> "$REGISTRO" 2>&1

echo ""
echo "===== Arranque: $(date '+%Y-%m-%d %H:%M:%S') (puerto $PUERTO) ====="

if [ ! -f "$PROYECTO/.next/BUILD_ID" ]; then
  echo "ERROR: la app no esta compilada. Ejecuta instalar.command."
  exit 1
fi
if ! command -v node > /dev/null 2>&1; then
  echo "ERROR: no encuentro Node.js. Ejecuta instalar.command."
  exit 1
fi

# S4K_SIN_SUSPENSION=1 (lo pone el instalador si lo pides): evita que el Mac se suspenda solo mientras
# la app esta en marcha y el equipo esta enchufado. No impide la suspension al cerrar la tapa de un portatil.
if [ "$S4K_SIN_SUSPENSION" = "1" ] && command -v caffeinate > /dev/null 2>&1; then
  exec caffeinate -s node node_modules/next/dist/bin/next start -H 0.0.0.0 -p "$PUERTO"
fi
exec node node_modules/next/dist/bin/next start -H 0.0.0.0 -p "$PUERTO"
