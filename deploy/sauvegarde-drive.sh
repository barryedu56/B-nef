#!/bin/sh
# Copie hors-site des sauvegardes vers Google Drive (rclone, remote « gdrive »),
# pour survivre à la perte du serveur lui-même. Lancé chaque nuit par cron
# (02:45, après les dumps de 02:00) :
#   45 2 * * * /root/B-nef/deploy/sauvegarde-drive.sh >> /var/log/sauvegarde-drive.log 2>&1
# Manuel, à tout moment : la même commande.
#
#   Bénef    : /root/B-nef/deploy/backups     -> gdrive:Benef-Backups
#   SolFerme : /root/SolFerme/deploy/backups  -> gdrive:SolFerme-Backups
# Rétention sur Drive : DRIVE_KEEP_DAYS jours (défaut 90).
set -u
KEEP="${DRIVE_KEEP_DAYS:-90}"
status=0

envoyer() {  # $1 = dossier local, $2 = dossier Drive, $3 = motif des fichiers
  [ -d "$1" ] || { echo "(absent : $1)"; return 0; }
  echo "[$(date '+%Y-%m-%d %H:%M')] $1 -> gdrive:$2"
  if rclone copy "$1" "gdrive:$2" --include "$3" --transfers 1; then
    rclone delete "gdrive:$2" --min-age "${KEEP}d" --include "$3" || true
    echo "  OK ($(rclone lsf "gdrive:$2" --include "$3" | wc -l) fichier(s) sur Drive)"
  else
    echo "  ECHEC de l'envoi vers Drive" >&2
    status=1
  fi
}

envoyer /root/B-nef/deploy/backups Benef-Backups 'benef-*.dump'
envoyer /root/SolFerme/deploy/backups SolFerme-Backups 'solferme_*.sql.gz'
exit $status
