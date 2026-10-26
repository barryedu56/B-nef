#!/bin/sh
# Boucle de sauvegarde : un dump compressé par jour vers 2 h (heure du
# serveur), les plus vieux que KEEP_DAYS jours sont supprimés.
set -eu
while true; do
  now=$(date +%H)
  if [ "$now" = "02" ]; then
    file="/backups/benef-$(date +%Y-%m-%d_%H%M).dump"
    pg_dump --format=custom --file="$file.tmp" && mv "$file.tmp" "$file"
    echo "Sauvegarde OK : $file"
    find /backups -name 'benef-*.dump' -mtime +"$KEEP_DAYS" -delete
    sleep 3600
  fi
  sleep 600
done
