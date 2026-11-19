/*
  Warnings:

  - A unique constraint covering the columns `[clientId]` on the table `Inspection` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Inspection" ADD COLUMN     "clientId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Inspection_clientId_key" ON "Inspection"("clientId");
