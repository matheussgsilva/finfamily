-- CreateTable
CREATE TABLE "allocation_targets" (
    "id" TEXT NOT NULL,
    "assetClass" "AssetClass" NOT NULL,
    "percent" DECIMAL(5,2) NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allocation_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "allocation_targets_userId_assetClass_key" ON "allocation_targets"("userId", "assetClass");

-- AddForeignKey
ALTER TABLE "allocation_targets" ADD CONSTRAINT "allocation_targets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────
-- Conversão dos dados: antes, "targetAlloc" era a meta de cada ativo em % da
-- carteira inteira e a meta da classe era a soma delas. Agora a meta da classe
-- fica em allocation_targets e "targetAlloc" vira o peso do ativo dentro da
-- própria classe. As contas abaixo preservam a alocação que o app já mostrava.
-- ─────────────────────────────────────────────────────────────

-- 1) Meta da classe = soma das metas dos ativos dessa classe.
INSERT INTO "allocation_targets" ("id", "assetClass", "percent", "userId", "createdAt", "updatedAt")
SELECT
    md5(random()::text || clock_timestamp()::text || i."userId" || i."assetClass"::text),
    i."assetClass",
    LEAST(SUM(i."targetAlloc"), 999.99),
    i."userId",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "investments" i
WHERE i."targetAlloc" IS NOT NULL AND i."targetAlloc" > 0
GROUP BY i."userId", i."assetClass";

-- 2) Peso do ativo dentro da classe = meta do ativo / meta da classe.
UPDATE "investments" i
SET "targetAlloc" = ROUND(i."targetAlloc" / t."total" * 100, 2)
FROM (
    SELECT "userId", "assetClass", SUM("targetAlloc") AS "total"
    FROM "investments"
    WHERE "targetAlloc" IS NOT NULL AND "targetAlloc" > 0
    GROUP BY "userId", "assetClass"
) t
WHERE i."userId" = t."userId"
  AND i."assetClass" = t."assetClass"
  AND i."targetAlloc" IS NOT NULL;
