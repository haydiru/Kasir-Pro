-- Migrasi: tabel ActivityLog (jejak audit append-only)
--
-- Proyek ini memakai `prisma db push` (tanpa riwayat prisma/migrations), jadi file
-- ini dijalankan manual, cukup sekali:
--
--   npx prisma db execute --file prisma/sql/20261019_activity_log.sql
--
-- Aman dijalankan ulang (IF NOT EXISTS / CREATE OR REPLACE).
-- Kalau tabel sudah dibuat lewat `npx prisma db push`, bagian 1 & 2 dilewati dan
-- yang terpasang hanya proteksi append-only (bagian 3).

-- 1. Tabel
CREATE TABLE IF NOT EXISTS "ActivityLog" (
    "id" TEXT NOT NULL,
    "storeId" TEXT,
    "actorId" TEXT,
    "actorName" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- 2. Index
CREATE INDEX IF NOT EXISTS "ActivityLog_storeId_createdAt_idx" ON "ActivityLog"("storeId", "createdAt");
CREATE INDEX IF NOT EXISTS "ActivityLog_entityType_entityId_idx" ON "ActivityLog"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "ActivityLog_actorId_idx" ON "ActivityLog"("actorId");

-- 3. Append-only: tolak UPDATE / DELETE / TRUNCATE di level database,
--    sehingga log tidak bisa diubah walaupun ada bug atau celah di aplikasi.
CREATE OR REPLACE FUNCTION activity_log_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ActivityLog bersifat append-only: % tidak diizinkan', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS activity_log_no_update_delete ON "ActivityLog";
CREATE TRIGGER activity_log_no_update_delete
  BEFORE UPDATE OR DELETE ON "ActivityLog"
  FOR EACH ROW EXECUTE FUNCTION activity_log_block_mutation();

DROP TRIGGER IF EXISTS activity_log_no_truncate ON "ActivityLog";
CREATE TRIGGER activity_log_no_truncate
  BEFORE TRUNCATE ON "ActivityLog"
  FOR EACH STATEMENT EXECUTE FUNCTION activity_log_block_mutation();
