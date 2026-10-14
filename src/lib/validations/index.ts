import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Contas Bancárias
// ─────────────────────────────────────────────────────────────
export const accountSchema = z.object({
  name: z.string().min(1, "Informe o nome da conta"),
  type: z.enum(["CHECKING", "SAVINGS", "CREDIT_CARD", "INVESTMENT", "WALLET"]),
  balance: z.coerce.number().min(0, "Saldo não pode ser negativo"),
  creditLimit: z.coerce
    .number()
    .min(0, "Limite não pode ser negativo")
    .optional()
    .nullable(),
  closingDay: z.coerce
    .number()
    .int()
    .min(1, "Dia inválido")
    .max(31, "Dia inválido")
    .optional()
    .nullable(),
  dueDay: z.coerce
    .number()
    .int()
    .min(1, "Dia inválido")
    .max(31, "Dia inválido")
    .optional()
    .nullable(),
  color: z.string().min(1),
  icon: z.string().optional().nullable(),
});

export type AccountInput = z.infer<typeof accountSchema>;

// ─────────────────────────────────────────────────────────────
// Categorias
// ─────────────────────────────────────────────────────────────
export const categorySchema = z.object({
  name: z.string().min(1, "Informe o nome da categoria"),
  type: z.enum(["INCOME", "EXPENSE"]),
  color: z.string().min(1),
  icon: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
});

export type CategoryInput = z.infer<typeof categorySchema>;

// ─────────────────────────────────────────────────────────────
// Membros da Família
// ─────────────────────────────────────────────────────────────
export const familyMemberSchema = z.object({
  name: z.string().min(1, "Informe o nome do membro"),
  color: z.string().min(1),
});

export type FamilyMemberInput = z.infer<typeof familyMemberSchema>;

// ─────────────────────────────────────────────────────────────
// Transações
// ─────────────────────────────────────────────────────────────
export const transactionSchema = z.object({
  description: z.string().min(1, "Informe a descrição"),
  amount: z.coerce.number().positive("Valor deve ser maior que zero"),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  date: z.coerce.date({ message: "Data inválida" }),
  categoryId: z.string().optional().nullable(),
  bankAccountId: z.string().min(1, "Selecione a conta"),
  destinationAccountId: z.string().optional().nullable(),
  familyMemberId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  isRecurring: z.boolean().default(false),
  recurrenceRule: z.string().optional().nullable(),
  installments: z.coerce
    .number()
    .int()
    .min(2, "Mínimo 2 parcelas")
    .max(120, "Máximo 120 parcelas")
    .optional()
    .nullable(),
}).refine((data) => !(data.isRecurring && data.installments && data.installments > 1), {
  message: "Escolha parcelamento ou recorrência, não os dois.",
  path: ["isRecurring"],
});

export type TransactionInput = z.infer<typeof transactionSchema>;

/** Dia no formato yyyy-MM-dd. */
const isoDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

// ─────────────────────────────────────────────────────────────
// Pagamento de fatura de cartão
// ─────────────────────────────────────────────────────────────
export const invoicePaymentSchema = z.object({
  cardId: z.string().min(1, "Selecione o cartão"),
  sourceAccountId: z.string().min(1, "Selecione a conta"),
  amount: z.coerce.number().positive("Valor deve ser maior que zero"),
  // Dia do pagamento (yyyy-MM-dd). Mantido como texto para a action montar a
  // data no mesmo fuso usado no cálculo da janela de pagamento da fatura.
  date: isoDaySchema,
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

export type InvoicePaymentInput = z.infer<typeof invoicePaymentSchema>;

// ─────────────────────────────────────────────────────────────
// Importação de extrato (OFX) e regras de categorização
// ─────────────────────────────────────────────────────────────
const importRowSchema = z.object({
  fitId: z.string().min(1).max(255),
  date: isoDaySchema,
  amount: z.number().refine((v) => v !== 0, "Valor inválido"),
  description: z.string().trim().min(1).max(500),
});

export const importPreviewSchema = z.object({
  bankAccountId: z.string().min(1, "Selecione a conta"),
  rows: z
    .array(importRowSchema)
    .min(1, "Nenhum lançamento encontrado no arquivo.")
    .max(2000, "Arquivo com lançamentos demais (máximo 2000)."),
});

export type ImportPreviewInput = z.infer<typeof importPreviewSchema>;

export const importConfirmSchema = z.object({
  bankAccountId: z.string().min(1, "Selecione a conta"),
  rows: z
    .array(
      importRowSchema.extend({
        categoryId: z.string().nullable().optional(),
        rememberPattern: z.string().trim().max(100).nullable().optional(),
      })
    )
    .min(1, "Selecione ao menos um lançamento.")
    .max(2000),
});

export type ImportConfirmInput = z.infer<typeof importConfirmSchema>;

export const categorizationRuleSchema = z.object({
  pattern: z.string().trim().min(2, "Informe ao menos 2 caracteres").max(100),
  categoryId: z.string().min(1, "Selecione a categoria"),
});

export type CategorizationRuleInput = z.infer<typeof categorizationRuleSchema>;

// ─────────────────────────────────────────────────────────────
// Orçamentos
// ─────────────────────────────────────────────────────────────
export const budgetSchema = z.object({
  categoryId: z.string().min(1, "Selecione a categoria"),
  amount: z.coerce.number().positive("Valor deve ser maior que zero"),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

export type BudgetInput = z.infer<typeof budgetSchema>;

// ─────────────────────────────────────────────────────────────
// Investimentos
// ─────────────────────────────────────────────────────────────
export const investmentSchema = z.object({
  ticker: z.string().trim().optional().nullable(),
  name: z.string().min(1, "Informe o nome do ativo"),
  assetClass: z.enum(["FIXED_INCOME", "STOCKS", "REITS", "CRYPTO", "INTERNATIONAL", "OTHER"]),
  quantity: z.coerce.number().min(0, "Quantidade inválida"),
  avgPrice: z.coerce.number().min(0, "Preço médio inválido"),
  currentPrice: z.coerce.number().min(0).optional().nullable(),
  targetAlloc: z.coerce
    .number()
    .min(0, "Alocação inválida")
    .max(100, "Alocação máxima 100%")
    .optional()
    .nullable(),
});

export type InvestmentInput = z.infer<typeof investmentSchema>;

export const operationSchema = z.object({
  type: z.enum(["BUY", "SELL"]),
  quantity: z.coerce.number().positive("Quantidade inválida"),
  price: z.coerce.number().positive("Preço inválido"),
  fees: z.coerce.number().min(0, "Taxas inválidas").default(0),
  date: z.coerce.date({ message: "Data inválida" }),
  notes: z.string().optional().nullable(),
});

export type OperationInput = z.infer<typeof operationSchema>;

export const proventoSchema = z.object({
  type: z.string().min(1, "Informe o tipo de provento"),
  amount: z.coerce.number().positive("Valor inválido"),
  paymentDate: z.coerce.date({ message: "Data inválida" }),
  referenceDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type ProventoInput = z.infer<typeof proventoSchema>;
