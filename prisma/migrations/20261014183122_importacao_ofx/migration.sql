-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "externalId" TEXT;

-- CreateTable
CREATE TABLE "categorization_rules" (
    "id" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorization_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "categorization_rules_userId_idx" ON "categorization_rules"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "categorization_rules_userId_pattern_categoryId_key" ON "categorization_rules"("userId", "pattern", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_bankAccountId_externalId_key" ON "transactions"("bankAccountId", "externalId");

-- AddForeignKey
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

