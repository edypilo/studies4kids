#!/bin/bash
# Instala (o actualiza) Studies4Kids en un Mac y lo deja arrancando solo al iniciar sesion.
# Uso: abre Terminal, escribe "bash " (con el espacio), arrastra el archivo instalar.command a la ventana y pulsa Intro.
# Para otro puerto anade al final:  --puerto 8080
# Se puede volver a ejecutar las veces que haga falta: sirve tambien para actualizar la app.
# AVISO: este instalador todavia no se ha probado en un Mac real.

PUERTO=3000
while [ $# -gt 0 ]; do
  case "$1" in
    --puerto|-p) PUERTO="$2"; shift 2 ;;
    *) echo "Opcion desconocida: $1"; exit 1 ;;
  esac
done

PROYECTO="$(cd "$(dirname "$0")/.." && pwd)"
ETIQUETA="com.studies4kids.app"
PLIST="$HOME/Library/LaunchAgents/$ETIQUETA.plist"
PREFIJO="$HOME/.studies4kids"
DOMINIO="gui/$(id -u)"

paso()  { printf '\n\033[36m== %s\033[0m\n' "$1"; }
bien()  { printf '   \033[32mOK:\033[0m %s\n' "$1"; }
aviso() { printf '   \033[33mAVISO:\033[0m %s\n' "$1"; }
fallar() { printf '\n\033[31mERROR:\033[0m %s\n' "$1"; exit 1; }
preguntar() {
  local respuesta
  read -r -p "$1 (S/N) " respuesta
  case "$respuesta" in [sS]*) return 0 ;; *) return 1 ;; esac
}

echo "Instalacion de Studies4Kids (macOS)"
echo "Carpeta: $PROYECTO"

# ---------------------------------------------------------------- Comprobaciones previas
paso "Comprobando el equipo"
[ "$(uname -s)" = "Darwin" ] || fallar "Este instalador es para macOS. En Windows usa instalar.cmd."
[ "$(id -u)" -ne 0 ] || fallar "No lo ejecutes con sudo: la app y la sesion de ChatGPT pertenecen a tu usuario."
case "$PUERTO" in ''|*[!0-9]*) fallar "El puerto debe ser un numero." ;; esac
[ -f "$PROYECTO/package.json" ] || fallar "No encuentro package.json. Ejecuta el instalador desde la carpeta de la app."

# macOS protege Escritorio, Documentos, Descargas e iCloud: un servicio en segundo plano no puede leerlas.
case "$PROYECTO" in
  "$HOME/Desktop"*|"$HOME/Documents"*|"$HOME/Downloads"*|"$HOME/Library/Mobile Documents"*)
    fallar "La app esta en una carpeta protegida por macOS (Escritorio, Documentos, Descargas o iCloud). Muevela a otra, por ejemplo $HOME/Studies4Kids, y vuelve a ejecutar esto." ;;
esac
case "$PROYECTO" in *'<'*|*'>'*|*'&'*) fallar "La ruta de la carpeta tiene caracteres raros (< > &). Usa una ruta sencilla." ;; esac
bien "Usuario: $(id -un)"

# ---------------------------------------------------------------- Parar la app si ya estaba
if launchctl print "$DOMINIO/$ETIQUETA" > /dev/null 2>&1; then
  paso "Parando la app para actualizarla"
  launchctl bootout "$DOMINIO/$ETIQUETA" > /dev/null 2>&1
  sleep 2
fi
OCUPADO="$(lsof -nP -iTCP:"$PUERTO" -sTCP:LISTEN -t 2> /dev/null | head -n 1)"
if [ -n "$OCUPADO" ]; then
  NOMBRE="$(ps -p "$OCUPADO" -o comm= 2> /dev/null)"
  case "$NOMBRE" in
    *node*) kill "$OCUPADO" 2> /dev/null; sleep 1; bien "App anterior detenida" ;;
    *) fallar "El puerto $PUERTO lo esta usando otro programa ($NOMBRE). Cierralo o instala con otro puerto: --puerto 8080" ;;
  esac
fi

# ---------------------------------------------------------------- Node.js
paso "Node.js"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node > /dev/null 2>&1; then
  if command -v brew > /dev/null 2>&1; then
    echo "   Instalando Node.js con Homebrew (puede tardar unos minutos)..."
    brew install node || fallar "No se pudo instalar Node.js."
  else
    open "https://nodejs.org/es/download" > /dev/null 2>&1
    fallar "Falta Node.js. Instala la version LTS para macOS desde https://nodejs.org (se ha abierto la pagina) y vuelve a ejecutar esto."
  fi
fi
VERSION="$(node -v)"
MAYOR="$(echo "$VERSION" | sed 's/^v\([0-9]*\).*/\1/')"
[ "${MAYOR:-0}" -ge 24 ] || fallar "Node.js $VERSION es demasiado antiguo: hace falta la version 24 o posterior. Actualizalo desde https://nodejs.org"
bien "Node.js $VERSION"
CARPETA_NODE="$(dirname "$(command -v node)")"

# ---------------------------------------------------------------- Codex (conexion con ChatGPT)
paso "Codex CLI (la conexion con la cuenta de ChatGPT)"
CODEX="$(command -v codex 2> /dev/null)"
if [ -z "$CODEX" ] && [ -x "$PREFIJO/bin/codex" ]; then CODEX="$PREFIJO/bin/codex"; fi
if [ -z "$CODEX" ]; then
  echo "   Instalando Codex..."
  # Se instala dentro de tu carpeta de usuario para no necesitar la contrasena de administrador.
  mkdir -p "$PREFIJO"
  npm install -g --prefix "$PREFIJO" @openai/codex || fallar "No se pudo instalar Codex."
  CODEX="$PREFIJO/bin/codex"
  [ -x "$CODEX" ] || fallar "No se pudo instalar Codex."
fi
bien "$("$CODEX" --version 2> /dev/null) ($CODEX)"

# ---------------------------------------------------------------- Dependencias y compilacion
paso "Instalando las piezas de la app (varios minutos la primera vez)"
cd "$PROYECTO" || fallar "No puedo entrar en la carpeta de la app."
npm ci || fallar 'Fallo "npm ci". Revisa la conexion a internet y vuelve a intentarlo.'
bien "Dependencias instaladas"

paso "Compilando la app"
export NEXT_TELEMETRY_DISABLED=1
npm run build || fallar "Fallo la compilacion."
bien "App compilada"

# ---------------------------------------------------------------- Datos
paso "Datos"
if [ -f "$PROYECTO/data/studies4kids.db" ]; then
  bien "Se han encontrado datos existentes: se conservan."
else
  bien "Instalacion nueva: al abrir la app te pedira el PIN de padres y los perfiles de tus hijos."
  aviso 'Si lo que querias era traer los datos de otro equipo, copia su carpeta "data" aqui y vuelve a ejecutar esto.'
fi

# ---------------------------------------------------------------- Que no se duerma
paso "Suspension del equipo"
SIN_SUSPENSION=0
if preguntar "   Evitar que el Mac se suspenda solo mientras la app esta en marcha y enchufado? Recomendado"; then
  SIN_SUSPENSION=1
  bien "El Mac no se suspendera solo estando enchufado (la pantalla si puede apagarse)"
fi

# ---------------------------------------------------------------- Arranque automatico
paso "Arranque automatico al iniciar sesion"
mkdir -p "$HOME/Library/LaunchAgents" "$PROYECTO/data/logs"
cat > "$PLIST" << FIN
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$ETIQUETA</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$PROYECTO/scripts/iniciar.sh</string>
    <string>$PUERTO</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$PROYECTO</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$CARPETA_NODE:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>CODEX_BIN</key>
    <string>$CODEX</string>
    <key>S4K_SIN_SUSPENSION</key>
    <string>$SIN_SUSPENSION</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>15</integer>
  <key>ProcessType</key>
  <string>Interactive</string>
</dict>
</plist>
FIN
plutil -lint "$PLIST" > /dev/null 2>&1 || fallar "El archivo del servicio no es valido: $PLIST"
launchctl bootstrap "$DOMINIO" "$PLIST" || fallar "No se pudo registrar el servicio. Prueba a cerrar sesion en el Mac, volver a entrar y repetir."
bien "Servicio '$ETIQUETA' creado"

# ---------------------------------------------------------------- Arrancar y comprobar
paso "Arrancando la app"
FUNCIONA=0
INTENTO=0
while [ "$INTENTO" -lt 30 ]; do
  sleep 2
  if [ "$(curl -s -o /dev/null -m 5 -w '%{http_code}' -L "http://localhost:$PUERTO/")" = "200" ]; then FUNCIONA=1; break; fi
  INTENTO=$((INTENTO + 1))
done
if [ "$FUNCIONA" = "1" ]; then
  bien "La app responde"
else
  aviso "La app no ha respondido en un minuto. Mira el registro: $PROYECTO/data/logs/app.log"
fi

# ---------------------------------------------------------------- Sesion de ChatGPT
paso "Sesion de ChatGPT"
if "$CODEX" login status > /dev/null 2>&1; then
  bien "Codex ya tiene la sesion de ChatGPT iniciada"
else
  aviso "Codex no tiene sesion. Se va a abrir el navegador para que inicies sesion con tu cuenta de ChatGPT."
  read -r -p "   Pulsa Intro para continuar " _
  "$CODEX" login
  if "$CODEX" login status > /dev/null 2>&1; then
    bien "Sesion iniciada"
  else
    aviso "No se ha iniciado sesion. Puedes hacerlo despues desde Terminal con: \"$CODEX\" login"
  fi
fi

# ---------------------------------------------------------------- Resumen
echo ""
echo "================================================================"
if [ "$FUNCIONA" = "1" ]; then echo " Studies4Kids esta instalada y en marcha."; else echo " Instalacion terminada, pero la app no responde todavia."; fi
echo " Direcciones para abrirla desde los dispositivos de casa:"
ifconfig | awk '/inet / && $2 !~ /^127\./ && $2 !~ /^169\.254\./ { print $2 }' | while read -r IP; do
  echo "    http://$IP:$PUERTO"
done
echo " Reserva esa IP en el router para que no cambie."
echo " Si macOS pregunta si \"node\" puede aceptar conexiones entrantes, pulsa Permitir."
echo " La app arranca al iniciar sesion en el Mac: para que funcione sola tras un apagon,"
echo " activa el inicio de sesion automatico en Ajustes del Sistema > Usuarios y grupos."
echo " Ultimo paso: abre la app. Si es una instalacion nueva, crea el PIN de padres y los"
echo " perfiles de tus hijos. Despues, en el panel de padres, pulsa \"Probar conexion\"."
echo "================================================================"
