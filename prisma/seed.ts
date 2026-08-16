import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Iniciando seed do banco de dados...\n");

  // ─────────────────────────────────────────────────────────────
  // Categorias padrão do sistema (userId = null)
  // ─────────────────────────────────────────────────────────────
  console.log("📁 Criando categorias do sistema...");

  const systemCategories = [
    // === DESPESAS ===
    { name: "Alimentação", type: "EXPENSE", icon: "UtensilsCrossed", color: "#f97316" },
    { name: "Moradia", type: "EXPENSE", icon: "Home", color: "#3b82f6" },
    { name: "Transporte", type: "EXPENSE", icon: "Car", color: "#6366f1" },
    { name: "Saúde", type: "EXPENSE", icon: "Heart", color: "#ef4444" },
    { name: "Educação", type: "EXPENSE", icon: "BookOpen", color: "#8b5cf6" },
    { name: "Lazer", type: "EXPENSE", icon: "Smile", color: "#ec4899" },
    { name: "Vestuário", type: "EXPENSE", icon: "ShoppingBag", color: "#f43f5e" },
    { name: "Tecnologia", type: "EXPENSE", icon: "Smartphone", color: "#06b6d4" },
    { name: "Assinaturas", type: "EXPENSE", icon: "RefreshCw", color: "#14b8a6" },
    { name: "Pets", type: "EXPENSE", icon: "PawPrint", color: "#eab308" },
    { name: "Impostos", type: "EXPENSE", icon: "FileText", color: "#64748b" },
    { name: "Investimentos", type: "EXPENSE", icon: "TrendingUp", color: "#22c55e" },
    { name: "Doações", type: "EXPENSE", icon: "Gift", color: "#a855f7" },
    { name: "Outros gastos", type: "EXPENSE", icon: "MoreHorizontal", color: "#94a3b8" },
    // === RECEITAS ===
    { name: "Salário", type: "INCOME", icon: "Briefcase", color: "#22c55e" },
    { name: "Freelance", type: "INCOME", icon: "Laptop", color: "#10b981" },
    { name: "Investimentos", type: "INCOME", icon: "TrendingUp", color: "#3b82f6" },
    { name: "Aluguel Recebido", type: "INCOME", icon: "Building2", color: "#f97316" },
    { name: "Venda", type: "INCOME", icon: "Tag", color: "#eab308" },
    { name: "Bonificação", type: "INCOME", icon: "Award", color: "#8b5cf6" },
    { name: "Outras receitas", type: "INCOME", icon: "Plus", color: "#94a3b8" },
  ];

  for (const cat of systemCategories) {
    await prisma.category.upsert({
      where: {
        id: `sys_${cat.name.toLowerCase().replace(/\s+/g, "_")}`,
      },
      update: {},
      create: {
        id: `sys_${cat.name.toLowerCase().replace(/\s+/g, "_")}`,
        name: cat.name,
        type: cat.type as "INCOME" | "EXPENSE",
        icon: cat.icon,
        color: cat.color,
        userId: null,
      },
    });
  }

  console.log(`   ✅ ${systemCategories.length} categorias criadas\n`);

}
main()
  .catch((e) => {
    console.error("❌ Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
