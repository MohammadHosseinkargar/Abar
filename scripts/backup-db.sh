#!/bin/bash
# Abar 3D - Database Backup Script
# Usage: ./backup-db.sh

BACKUP_DIR="/var/www/abar/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sql"

mkdir -p "$BACKUP_DIR"

echo "Starting backup to $BACKUP_FILE..."

# Assuming the container is named 'abar-db' as per standard docker-compose
docker exec abar-db pg_dump -U postgres abar_db > "$BACKUP_FILE"

# Compress
gzip "$BACKUP_FILE"

# Keep only last 7 days
find "$BACKUP_DIR" -name "db_backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed successfully."
