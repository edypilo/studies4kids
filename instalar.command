#!/bin/bash
# Instala o actualiza Studies4Kids en un Mac.
# Abre Terminal, escribe "bash " (con el espacio), arrastra este archivo a la ventana y pulsa Intro.
bash "$(cd "$(dirname "$0")" && pwd)/scripts/instalar-macos.sh" "$@"
ESTADO=$?
echo ""
read -r -p "Pulsa Intro para cerrar " _
exit $ESTADO
