-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "deletedAt" TIMESTAMP(3);
