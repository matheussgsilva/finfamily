"use server";

import {
  getAccountBalances,
  getAccounts,
  getBudgetsWithProgress,
  getCategories,
  getDashboardKPIs,
  getExpenseByCategory,
  getExpenseCategories,
  getFamilyMembers,
  getIncomeCategories,
  getInvestmentDetail,
  getMonthlyCashFlow,
  getNetWorthSeries,
  getTransactions,
} from "@/lib/queries";
import { getRequiredUserId } from "@/lib/session";
import type { TransactionFilters } from "@/types";

export async function queryAccounts() {
  const userId = await getRequiredUserId();
  return getAccounts(userId);
}

export async function queryAccountBalances() {
  const userId = await getRequiredUserId();
  return getAccountBalances(userId);
}

export async function queryCategories() {
  const userId = await getRequiredUserId();
  return getCategories(userId);
}

export async function queryExpenseCategories() {
  const userId = await getRequiredUserId();
  return getExpenseCategories(userId);
}

export async function queryIncomeCategories() {
  const userId = await getRequiredUserId();
  return getIncomeCategories(userId);
}

export async function queryFamilyMembers() {
  const userId = await getRequiredUserId();
  return getFamilyMembers(userId);
}

export async function queryTransactions(filters: TransactionFilters = {}) {
  const userId = await getRequiredUserId();
  return getTransactions(userId, filters);
}

export async function queryBudgets(month: number, year: number) {
  const userId = await getRequiredUserId();
  return getBudgetsWithProgress(userId, month, year);
}

export async function queryDashboardKPIs() {
  const userId = await getRequiredUserId();
  return getDashboardKPIs(userId);
}

export async function queryExpenseByCategory(month: number, year: number) {
  const userId = await getRequiredUserId();
  return getExpenseByCategory(userId, month, year);
}

export async function queryMonthlyCashFlow(monthsBack = 6) {
  const userId = await getRequiredUserId();
  return getMonthlyCashFlow(userId, monthsBack);
}

export async function queryNetWorth(range: "1M" | "6M" | "1Y" | "ALL") {
  const userId = await getRequiredUserId();
  return getNetWorthSeries(userId, range);
}

export async function queryInvestmentDetail(investmentId: string) {
  const userId = await getRequiredUserId();
  return getInvestmentDetail(userId, investmentId);
}
