import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

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

  // ─────────────────────────────────────────────────────────────
  // Usuário de demonstração
  // ─────────────────────────────────────────────────────────────
  console.log("👤 Criando usuário de demonstração...");

  const hashedPassword = await bcrypt.hash("demo1234", 12);

  const demoUser = await prisma.user.upsert({
    where: { email: "demo@finfamily.com.br" },
    update: {},
    create: {
      name: "Usuário Demo",
      email: "demo@finfamily.com.br",
      password: hashedPassword,
    },
  });

  console.log(`   ✅ Usuário criado: ${demoUser.email}\n`);

  // ─────────────────────────────────────────────────────────────
  // Membro da família demo
  // ─────────────────────────────────────────────────────────────
  await prisma.familyMember.upsert({
    where: { id: "demo_member_1" },
    update: {},
    create: {
      id: "demo_member_1",
      name: "Titular",
      color: "#6366f1",
      userId: demoUser.id,
    },
  });

  // ─────────────────────────────────────────────────────────────
  // Contas bancárias demo
  // ─────────────────────────────────────────────────────────────
  console.log("🏦 Criando contas bancárias demo...");

  const contaCorrente = await prisma.bankAccount.upsert({
    where: { id: "demo_account_1" },
    update: {},
    create: {
      id: "demo_account_1",
      name: "Nubank",
      type: "CHECKING",
      balance: 3500.00,
      color: "#8b5cf6",
      userId: demoUser.id,
    },
  });

  const cartaoCredito = await prisma.bankAccount.upsert({
    where: { id: "demo_account_2" },
    update: {},
    create: {
      id: "demo_account_2",
      name: "Cartão Nubank",
      type: "CREDIT_CARD",
      balance: 0,
      creditLimit: 5000.00,
      closingDay: 19,
      dueDay: 25,
      color: "#8b5cf6",
      userId: demoUser.id,
    },
  });

  console.log("   ✅ Contas criadas\n");

  // ─────────────────────────────────────────────────────────────
  // Transações de demonstração (últimos 2 meses)
  // ─────────────────────────────────────────────────────────────
  console.log("💳 Criando transações demo...");

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const demoTransactions = [
    // Receitas do mês atual
    {
      description: "Salário",
      amount: 5500.00,
      type: "INCOME" as const,
      date: new Date(currentYear, currentMonth, 5),
      categoryId: "sys_salário",
      bankAccountId: contaCorrente.id,
    },
    // Despesas do mês atual
    {
      description: "Supermercado",
      amount: 420.00,
      type: "EXPENSE" as const,
      date: new Date(currentYear, currentMonth, 8),
      categoryId: "sys_alimentação",
      bankAccountId: cartaoCredito.id,
    },
    {
      description: "Aluguel",
      amount: 1200.00,
      type: "EXPENSE" as const,
      date: new Date(currentYear, currentMonth, 5),
      categoryId: "sys_moradia",
      bankAccountId: contaCorrente.id,
      isRecurring: true,
    },
    {
      description: "Combustível",
      amount: 180.00,
      type: "EXPENSE" as const,
      date: new Date(currentYear, currentMonth, 10),
      categoryId: "sys_transporte",
      bankAccountId: cartaoCredito.id,
    },
    {
      description: "Netflix",
      amount: 39.90,
      type: "EXPENSE" as const,
      date: new Date(currentYear, currentMonth, 12),
      categoryId: "sys_assinaturas",
      bankAccountId: cartaoCredito.id,
      isRecurring: true,
    },
    {
      description: "Academia",
      amount: 89.90,
      type: "EXPENSE" as const,
      date: new Date(currentYear, currentMonth, 5),
      categoryId: "sys_saúde",
      bankAccountId: contaCorrente.id,
      isRecurring: true,
    },
  ];

  for (const tx of demoTransactions) {
    await prisma.transaction.create({
      data: {
        ...tx,
        userId: demoUser.id,
      },
    });
  }

  console.log(`   ✅ ${demoTransactions.length} transações criadas\n`);

  // ─────────────────────────────────────────────────────────────
  // Investimentos demo
  // ─────────────────────────────────────────────────────────────
  console.log("📈 Criando investimentos demo...");

  const investimentos = [
    {
      ticker: "MXRF11",
      name: "Maxi Renda FII",
      assetClass: "REITS" as const,
      quantity: 100,
      avgPrice: 10.20,
      currentPrice: 10.45,
      targetAlloc: 20,
    },
    {
      ticker: "PETR4",
      name: "Petrobras PN",
      assetClass: "STOCKS" as const,
      quantity: 50,
      avgPrice: 38.50,
      currentPrice: 41.20,
      targetAlloc: 30,
    },
    {
      ticker: "TESOURO SELIC 2027",
      name: "Tesouro Selic 2027",
      assetClass: "FIXED_INCOME" as const,
      quantity: 1,
      avgPrice: 15000.00,
      currentPrice: 15450.00,
      targetAlloc: 50,
    },
  ];

  for (const inv of investimentos) {
    await prisma.investment.create({
      data: {
        ...inv,
        userId: demoUser.id,
      },
    });
  }

  console.log(`   ✅ ${investimentos.length} investimentos criados\n`);

  // ─────────────────────────────────────────────────────────────
  // Orçamentos demo
  // ─────────────────────────────────────────────────────────────
  console.log("📊 Criando orçamentos demo...");

  const budgets = [
    { categoryId: "sys_alimentação", amount: 600.00 },
    { categoryId: "sys_moradia", amount: 1400.00 },
    { categoryId: "sys_transporte", amount: 300.00 },
    { categoryId: "sys_saúde", amount: 200.00 },
    { categoryId: "sys_lazer", amount: 250.00 },
    { categoryId: "sys_assinaturas", amount: 100.00 },
  ];

  for (const budget of budgets) {
    await prisma.budget.upsert({
      where: {
        categoryId_month_year_userId: {
          categoryId: budget.categoryId,
          month: currentMonth + 1,
          year: currentYear,
          userId: demoUser.id,
        },
      },
      update: {},
      create: {
        categoryId: budget.categoryId,
        amount: budget.amount,
        month: currentMonth + 1,
        year: currentYear,
        userId: demoUser.id,
      },
    });
  }

  console.log(`   ✅ ${budgets.length} orçamentos criados\n`);

  console.log("✨ Seed concluído com sucesso!");
  console.log("\n📧 Credenciais do usuário demo:");
  console.log("   Email: demo@finfamily.com.br");
  console.log("   Senha: demo1234\n");
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
