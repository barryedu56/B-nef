#!/bin/sh
# Installe, sur TON PC (Ubuntu), une copie quotidienne des sauvegardes de la
# base Bénef : le serveur sauvegarde chaque nuit vers 2 h, ce PC récupère les
# fichiers chaque jour à 9 h (ou au démarrage suivant s'il était éteint) dans
# ~/Sauvegardes-Benef. Une notification s'affiche si la copie échoue.
#
#   Installer :    sh deploy/copie-sauvegardes-pc.sh
#   Désinstaller : sh deploy/copie-sauvegardes-pc.sh --retirer
#
# Utilise ta clé SSH (déverrouillée par le trousseau du bureau) : la copie ne
# se fait que lorsque ta session est ouverte.
set -eu
SERVEUR="${BENEF_SERVEUR:-root@49.13.173.243}"
UNITS="$HOME/.config/systemd/user"
SCRIPT="$HOME/.local/bin/benef-backup-pull.sh"

if [ "${1:-}" = "--retirer" ]; then
  systemctl --user disable --now benef-backup-pull.timer 2>/dev/null || true
  rm -f "$UNITS/benef-backup-pull.timer" "$UNITS/benef-backup-pull.service" "$SCRIPT"
  systemctl --user daemon-reload
  echo "Copie automatique retirée (le dossier ~/Sauvegardes-Benef est gardé)."
  exit 0
fi

mkdir -p "$HOME/.local/bin" "$UNITS" "$HOME/Sauvegardes-Benef"

cat > "$SCRIPT" <<EOF
#!/bin/sh
DEST="\$HOME/Sauvegardes-Benef"
LOG="\$DEST/copie.log"
mkdir -p "\$DEST"
if rsync -az --timeout=120 -e "ssh -o BatchMode=yes -o ConnectTimeout=30" \\
     $SERVEUR:/root/B-nef/deploy/backups/ "\$DEST/"; then
  echo "\$(date '+%F %T') OK : \$(ls "\$DEST"/*.dump 2>/dev/null | wc -l) sauvegarde(s) sur ce PC" >> "\$LOG"
else
  echo "\$(date '+%F %T') ÉCHEC de la copie" >> "\$LOG"
  notify-send -u critical "Bénef" "La copie des sauvegardes du serveur a échoué. Vérifie ta connexion." 2>/dev/null || true
  exit 1
fi
EOF
chmod +x "$SCRIPT"

cat > "$UNITS/benef-backup-pull.service" <<'EOF'
[Unit]
Description=Copie des sauvegardes Bénef du serveur vers ce PC
After=network-online.target

[Service]
Type=oneshot
# Agent SSH du bureau (trousseau GNOME) : la clé est déjà déverrouillée.
Environment=SSH_AUTH_SOCK=%t/keyring/ssh
ExecStart=%h/.local/bin/benef-backup-pull.sh
EOF

cat > "$UNITS/benef-backup-pull.timer" <<'EOF'
[Unit]
Description=Copie quotidienne des sauvegardes Bénef

[Timer]
OnCalendar=*-*-* 09:00
Persistent=true
RandomizedDelaySec=15min

[Install]
WantedBy=timers.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now benef-backup-pull.timer
echo "Premier essai de copie…"
if systemctl --user start benef-backup-pull.service; then
  tail -1 "$HOME/Sauvegardes-Benef/copie.log"
  echo "Installé : copie chaque jour à 9 h dans ~/Sauvegardes-Benef."
else
  echo "Le premier essai a échoué : vérifie que tu peux te connecter avec « ssh $SERVEUR »."
fi
