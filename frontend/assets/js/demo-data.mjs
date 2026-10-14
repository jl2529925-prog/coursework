export const demoData = Object.freeze({
  report: {
    year: 2026,
    month: 8,
    income: "6800.00",
    expense: "2082.30",
    balance: "4717.70",
    transaction_count: 6,
    expense_by_category: [
      { category: "Housing", amount: "1800.00" },
      { category: "Food", amount: "129.30" },
      { category: "Study", amount: "129.00" },
      { category: "Transport", amount: "24.00" },
    ],
    budget_status: [
      { category: "Entertainment", limit: "400.00", remaining: "400.00", spent: "0.00", status: "ok", usage_percent: 0 },
      { category: "Food", limit: "900.00", remaining: "770.70", spent: "129.30", status: "ok", usage_percent: 14.37 },
      { category: "Housing", limit: "1800.00", remaining: "0.00", spent: "1800.00", status: "warning", usage_percent: 100 },
      { category: "Study", limit: "500.00", remaining: "371.00", spent: "129.00", status: "ok", usage_percent: 25.8 },
      { category: "Transport", limit: "300.00", remaining: "276.00", spent: "24.00", status: "ok", usage_percent: 8 },
    ],
  },
  transactions: [
    { id: "demo-6", occurred_on: "2026-08-05", type: "expense", category: "Food", amount: "42.80", note: "Dinner" },
    { id: "demo-5", occurred_on: "2026-08-05", type: "expense", category: "Study", amount: "129.00", note: "Reference books" },
    { id: "demo-4", occurred_on: "2026-08-04", type: "expense", category: "Transport", amount: "24.00", note: "Metro card" },
    { id: "demo-3", occurred_on: "2026-08-03", type: "expense", category: "Food", amount: "86.50", note: "Groceries" },
    { id: "demo-2", occurred_on: "2026-08-02", type: "expense", category: "Housing", amount: "1800.00", note: "August rent" },
    { id: "demo-1", occurred_on: "2026-08-01", type: "income", category: "Salary", amount: "6800.00", note: "Monthly salary" },
  ],
  budget: { year: 2026, month: 8, limits: { Food: "900.00", Housing: "1800.00", Transport: "300.00", Study: "500.00", Entertainment: "400.00" } },
  categories: ["Salary", "Freelance", "Food", "Transport", "Housing", "Study", "Health", "Entertainment", "Other"],
});

