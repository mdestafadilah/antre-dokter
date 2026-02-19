#!/bin/sh
set -e

echo "⏳ Menunggu database siap..."

# Tunggu PostgreSQL siap menerima koneksi
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" 2>/dev/null; do
  echo "   Database belum siap, coba lagi dalam 2 detik..."
  sleep 2
done

echo "✅ Database siap!"

# Jalankan migrasi Sequelize
echo "🔄 Menjalankan migrasi database..."
cd /app/server
npx sequelize-cli db:migrate

echo "🚀 Memulai server..."
exec "$@"
