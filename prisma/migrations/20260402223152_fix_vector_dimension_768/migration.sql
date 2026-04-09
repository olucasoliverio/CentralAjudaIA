-- Fix vector dimension: drop and recreate embedding column as vector(768)
-- (pgvector does not support ALTER COLUMN TYPE for changing vector dimensions)
-- Existing chunk data will be cleared and re-synced by the SyncService.

DELETE FROM "chunks";

ALTER TABLE "chunks" DROP COLUMN IF EXISTS "embedding";
ALTER TABLE "chunks" ADD COLUMN "embedding" vector(768);