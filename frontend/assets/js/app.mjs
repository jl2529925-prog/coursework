import { ApiClient, ApiError } from "./api.mjs";
import { demoData } from "./demo-data.mjs";
import { clamp, currencySymbol, money, periodLabel, readableDate } from "./format.mjs";
import { BrowserStore, mergePreferences } from "./storage.mjs";
import { formToTransaction, validateBudgetRows, validateTransaction } from "./validation.mjs";

const store = new BrowserStore();
const today = new Date();
const initialPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

const state = {
  view: "dashboard",
  period: initialPeriod,
  preferences: mergePreferences(store.read("preferences", {})),
  report: null,
  transactions: [],
  budget: null,
  categories: [],
};

let api = new ApiClient(state.preferences.apiBase);

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function currentPeriod() {
  const [year, month] = state.period.split("-").map(Number);
  return { year, month };
}

function setTheme() {
  document.documentElement.dataset.theme = state.preferences.theme;
}

function setConnection(mode, label) {
  const element = $("#connection-status");
  element.dataset.state = mode;
  element.lastElementChild.textContent = label;
}

function toast(message, mode = "success") {
  const element = document.createElement("div");
  element.className = `toast toast-${mode}`;
  element.textContent = message;
  $("#toast-region").append(element);
  setTimeout(() => element.remove(), 4200);
}

function showView(view) {
  state.view = view;
  $$('[data-view-panel]').forEach((panel) => {
    const visible = panel.dataset.viewPanel === view;
    panel.hidden = !visible;
    panel.classList.toggle("is-visible", visible);
  });
  $$(".nav-link").forEach((link) => {
    const active = link.dataset.view === view;
    link.classList.toggle("is-active", active);
    active ? link.setAttribute("aria-current", "page") : link.removeAttribute("aria-current");
  });
  const titles = {
    dashboard: ["Current position", `Your ${periodLabel(state.period).replace(/ \d{4}$/, "")} ledger`],
    transactions: ["Money movements", "Transaction register"],
    budgets: ["Guardrails", `Budget for ${periodLabel(state.period)}`],
    reports: ["Monthly close", `Report for ${periodLabel(state.period)}`],
  };
  $("#view-eyebrow").textContent = titles[view][0];
  $("#view-title").textContent = titles[view][1];
  if (view === "transactions") setTimeout(() => $("#transaction-search").focus(), 80);
}

function renderCategoryBars(target, rows = [], large = false) {
  if (!rows.length) {
    target.innerHTML = '<p class="empty-state">No expense data for this month.</p>';
    return;
  }
  const max = Math.max(...rows.map((row) => Number(row.amount)), 1);
  target.innerHTML = rows.map((row, index) => `
    <div class="category-row ${large ? "category-row-large" : ""}">
      <span class="category-rank">${String(index + 1).padStart(2, "0")}</span>
      <div class="category-name"><strong>${escapeHtml(row.category)}</strong><span class="bar-track"><i style="width:${clamp(Number(row.amount) / max * 100, 4, 100)}%"></i></span></div>
      <strong class="number">${money(row.amount, state.preferences.currency)}</strong>
    </div>`).join("");
}

function renderDashboard() {
  const report = state.report;
  const symbol = currencySymbol(state.preferences.currency);
  $("#balance-currency").textContent = symbol;
  $("#form-currency").textContent = symbol;
  if (!report) return;
  $("#balance-value").textContent = Number(report.balance).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  $("#income-value").textContent = money(report.income, state.preferences.currency);
  $("#expense-value").textContent = money(report.expense, state.preferences.currency);
  const maxFlow = Math.max(Number(report.income), Number(report.expense), 1);
  $("#income-bar").style.width = `${clamp(Number(report.income) / maxFlow * 100, 2, 100)}%`;
  $("#expense-bar").style.width = `${clamp(Number(report.expense) / maxFlow * 100, 2, 100)}%`;
  $("#balance-note").textContent = Number(report.balance) >= 0
    ? `${report.transaction_count} entries leave a positive monthly position.`
    : `Expenses exceed income by ${money(Math.abs(Number(report.balance)), state.preferences.currency)}.`;

  const budgeted = report.budget_status.filter((row) => row.limit !== null);
  const spent = budgeted.reduce((sum, row) => sum + Number(row.spent), 0);
  const limit = budgeted.reduce((sum, row) => sum + Number(row.limit), 0);
  const usage = limit ? spent / limit * 100 : 0;
  $("#pulse-ring").style.setProperty("--pulse", `${clamp(usage / 100 * 360, 0, 360)}deg`);
  $("#pulse-value").textContent = `${Math.round(usage)}%`;
  const over = budgeted.filter((row) => row.status === "over");
  const warning = budgeted.filter((row) => row.status === "warning");
  if (!budgeted.length) {
    $("#budget-health").textContent = "No budget";
    $("#budget-health").dataset.mode = "neutral";
    $("#pulse-headline").textContent = "Set a monthly budget";
    $("#pulse-detail").textContent = "A budget turns the ring into an early-warning signal.";
  } else if (over.length) {
    $("#budget-health").textContent = `${over.length} over limit`;
    $("#budget-health").dataset.mode = "over";
    $("#pulse-headline").textContent = `${over[0].category} needs attention`;
    $("#pulse-detail").textContent = `Total tracked spending is ${Math.round(usage)}% of the combined limits.`;
  } else {
    $("#budget-health").textContent = warning.length ? `${warning.length} near limit` : "On track";
    $("#budget-health").dataset.mode = warning.length ? "warning" : "ok";
    $("#pulse-headline").textContent = warning.length ? `${warning[0].category} is approaching its limit` : "Spending remains inside every limit";
    $("#pulse-detail").textContent = `${money(Math.max(limit - spent, 0), state.preferences.currency)} remains across budgeted categories.`;
  }

  renderCategoryBars($("#dashboard-categories"), report.expense_by_category.slice(0, 5));
  renderCategoryBars($("#report-category-bars"), report.expense_by_category, true);
}

function renderLatest() {
  const target = $("#latest-transactions");
  const items = state.transactions.slice(0, 6);
  if (!items.length) {
    target.innerHTML = '<li class="empty-state">No transactions in this period.</li>';
    return;
  }
  target.innerHTML = items.map((item) => `
    <li class="trail-item ${item.type}">
      <time datetime="${item.occurred_on}">${readableDate(item.occurred_on)}</time>
      <div><strong>${escapeHtml(item.category)}</strong><span>${escapeHtml(item.note || (item.type === "income" ? "Money in" : "Money out"))}</span></div>
      <strong class="number">${item.type === "income" ? "+" : "−"}${money(item.amount, state.preferences.currency)}</strong>
    </li>`).join("");
}

function filteredTransactions() {
  const type = $("#transaction-type-filter").value;
  const query = $("#transaction-search").value.trim().toLowerCase();
  return state.transactions.filter((item) => (!type || item.type === type) && (!query || `${item.category} ${item.note}`.toLowerCase().includes(query)));
}

function renderTransactionTable() {
  const items = filteredTransactions();
  $("#transaction-empty").hidden = items.length > 0;
  $("#transaction-table-body").innerHTML = items.map((item) => `
    <tr>
      <td><time datetime="${item.occurred_on}">${readableDate(item.occurred_on)}</time></td>
      <td><span class="direction ${item.type}">${item.type === "income" ? "In" : "Out"}</span></td>
      <td><strong>${escapeHtml(item.category)}</strong></td>
      <td class="muted">${escapeHtml(item.note || "—")}</td>
      <td class="number ${item.type}">${item.type === "income" ? "+" : "−"}${money(item.amount, state.preferences.currency)}</td>
      <td><button class="icon-button delete-transaction" type="button" data-id="${item.id}" aria-label="Delete ${escapeHtml(item.category)} transaction">×</button></td>
    </tr>`).join("");
}

function renderReport() {
  if (!state.report) return;
  $("#report-period-title").textContent = periodLabel(state.period);
  $("#report-income").textContent = money(state.report.income, state.preferences.currency);
  $("#report-expense").textContent = money(state.report.expense, state.preferences.currency);
  $("#report-balance").textContent = money(state.report.balance, state.preferences.currency);
  $("#report-count").textContent = state.report.transaction_count;
  const rows = state.report.budget_status;
  $("#budget-performance").innerHTML = rows.length ? rows.map((row) => {
    const usage = row.usage_percent === null ? 0 : clamp(row.usage_percent, 0, 140);
    return `<div class="performance-row" data-status="${row.status}">
      <div><strong>${escapeHtml(row.category)}</strong><span>${row.limit === null ? "No limit set" : `${money(row.spent, state.preferences.currency)} of ${money(row.limit, state.preferences.currency)}`}</span></div>
      <div class="performance-track"><i style="width:${clamp(usage, 2, 100)}%"></i></div>
      <strong>${row.usage_percent === null ? "—" : `${Math.round(row.usage_percent)}%`}</strong>
    </div>`;
  }).join("") : '<p class="empty-state">Add transactions or budgets to compare actuals with limits.</p>';
}

function addBudgetRow(category = "", limit = "") {
  const row = document.createElement("div");
  row.className = "budget-row";
  row.innerHTML = `<label><span>Category</span><input name="category" maxlength="40" value="${escapeAttribute(category)}" placeholder="e.g. Food" /><small></small></label>
    <label><span>Monthly limit</span><span class="money-input"><i>${currencySymbol(state.preferences.currency)}</i><input name="limit" inputmode="decimal" value="${escapeAttribute(limit)}" placeholder="0.00" /></span><small></small></label>
    <button class="icon-button remove-budget-row" type="button" aria-label="Remove budget row">×</button>`;
  $("#budget-rows").append(row);
}

function renderBudgetEditor() {
  const target = $("#budget-rows");
  target.innerHTML = "";
  const limits = state.budget?.limits ?? {};
  const draft = store.read(`budget-draft:${state.period}`, null);
  const rows = draft?.length ? draft : Object.entries(limits).map(([category, limit]) => ({ category, limit }));
  (rows.length ? rows : [{ category: "", limit: "" }]).forEach((row) => addBudgetRow(row.category, row.limit));
}

function renderCategories() {
  $("#category-options").innerHTML = state.categories.map((item) => `<option value="${escapeAttribute(item)}"></option>`).join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function escapeAttribute(value) { return escapeHtml(value); }

function applyTransactionDraft() {
  const draft = store.read("transaction-draft", null);
  const form = $("#transaction-form");
  form.elements.occurred_on.value = draft?.occurred_on || today.toISOString().slice(0, 10);
  form.elements.category.value = draft?.category || "";
  form.elements.amount.value = draft?.amount || "";
  form.elements.note.value = draft?.note || "";
  const type = draft?.type || "expense";
  const radio = form.querySelector(`input[name="type"][value="${type}"]`);
  if (radio) radio.checked = true;
}

function renderAll() {
  renderDashboard();
  renderLatest();
  renderTransactionTable();
  renderReport();
  renderCategories();
}

async function loadData({ quiet = false } = {}) {
  const { year, month } = currentPeriod();
  if (!quiet) setConnection("checking", "Syncing ledger");
  try {
    const [report, transactions, budget, categories] = await Promise.all([
      api.report(year, month),
      api.transactions(`year=${year}&month=${month}`),
      api.budget(year, month),
      api.categories(),
    ]);
    Object.assign(state, { report, transactions, budget, categories });
    store.write(`cache:${state.period}`, { report, transactions, budget, categories, savedAt: new Date().toISOString() });
    setConnection("online", "API connected");
    renderBudgetEditor();
    renderAll();
  } catch (error) {
    const cached = store.read(`cache:${state.period}`, null);
    if (cached) {
      Object.assign(state, cached);
      setConnection("cached", "Showing saved data");
      renderBudgetEditor();
      renderAll();
      toast("The API is offline. Showing the last saved data for this month.", "warning");
    } else {
      Object.assign(state, demoData);
      setConnection("cached", "Offline demo snapshot");
      renderBudgetEditor();
      renderAll();
      toast(`${error instanceof ApiError ? error.message : "Unable to load finance data."} Showing an offline demonstration snapshot.`, "warning");
    }
  }
}

function showFieldErrors(form, errors) {
  $$('[data-error-for]', form).forEach((slot) => {
    const message = errors[slot.dataset.errorFor] ?? "";
    slot.textContent = message;
    slot.closest(".field")?.classList.toggle("has-error", Boolean(message));
  });
}

async function submitTransaction(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = formToTransaction(new FormData(form));
  const result = validateTransaction(payload);
  showFieldErrors(form, result.errors);
  if (!result.valid) {
    $("#transaction-form-status").textContent = "Check the highlighted fields before saving.";
    form.querySelector(".has-error input, .has-error textarea")?.focus();
    return;
  }
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  $("#transaction-form-status").textContent = "Saving…";
  try {
    await api.createTransaction(payload);
    store.remove("transaction-draft");
    form.reset();
    applyTransactionDraft();
    $("#transaction-form-status").textContent = "Saved.";
    toast("Transaction saved to the text-file back end.");
    await loadData({ quiet: true });
  } catch (error) {
    $("#transaction-form-status").textContent = error.message;
    toast(error.message, "error");
  } finally {
    button.disabled = false;
  }
}

async function deleteTransaction(id) {
  if (!confirm("Delete this transaction? This cannot be undone.")) return;
  try {
    await api.deleteTransaction(id);
    toast("Transaction deleted.");
    await loadData({ quiet: true });
  } catch (error) {
    toast(error.message, "error");
  }
}

function budgetRowsFromForm() {
  return $$(".budget-row", $("#budget-rows")).map((row) => ({
    category: $('input[name="category"]', row).value,
    limit: $('input[name="limit"]', row).value,
  }));
}

async function submitBudget(event) {
  event.preventDefault();
  const rows = budgetRowsFromForm();
  const result = validateBudgetRows(rows);
  $$(".budget-row").forEach((row, index) => {
    const categoryError = result.errors[`category-${index}`] ?? "";
    const limitError = result.errors[`limit-${index}`] ?? "";
    const labels = $$('label', row);
    labels[0].querySelector("small").textContent = categoryError;
    labels[1].querySelector("small").textContent = limitError;
    labels[0].classList.toggle("has-error", Boolean(categoryError));
    labels[1].classList.toggle("has-error", Boolean(limitError));
  });
  if (!result.valid) {
    $("#budget-form-status").textContent = result.errors.form ?? "Check the highlighted budget rows.";
    return;
  }
  const { year, month } = currentPeriod();
  try {
    await api.saveBudget(year, month, result.limits);
    store.remove(`budget-draft:${state.period}`);
    $("#budget-form-status").textContent = "Budget saved.";
    toast("Monthly budget saved.");
    await loadData({ quiet: true });
  } catch (error) {
    $("#budget-form-status").textContent = error.message;
    toast(error.message, "error");
  }
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) showView(viewButton.dataset.view);
    const deleteButton = event.target.closest(".delete-transaction");
    if (deleteButton) deleteTransaction(deleteButton.dataset.id);
    const removeBudget = event.target.closest(".remove-budget-row");
    if (removeBudget) {
      removeBudget.closest(".budget-row").remove();
      if (!$$(".budget-row").length) addBudgetRow();
    }
  });

  $("#period-picker").addEventListener("change", async (event) => {
    state.period = event.target.value;
    showView(state.view);
    await loadData();
  });
  $("#quick-add").addEventListener("click", () => {
    showView("transactions");
    setTimeout(() => $("#entry-slip").scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  });
  $("#transaction-type-filter").addEventListener("change", renderTransactionTable);
  $("#transaction-search").addEventListener("input", renderTransactionTable);
  $("#transaction-form").addEventListener("submit", submitTransaction);
  $("#transaction-form").addEventListener("input", () => store.write("transaction-draft", formToTransaction(new FormData($("#transaction-form")))));
  $("#clear-draft").addEventListener("click", () => {
    store.remove("transaction-draft");
    $("#transaction-form").reset();
    applyTransactionDraft();
    showFieldErrors($("#transaction-form"), {});
  });
  $("#add-budget-row").addEventListener("click", () => addBudgetRow());
  $("#budget-form").addEventListener("submit", submitBudget);
  $("#budget-form").addEventListener("input", () => store.write(`budget-draft:${state.period}`, budgetRowsFromForm()));

  const dialog = $("#settings-dialog");
  $("#open-settings").addEventListener("click", () => {
    const form = $("#settings-form");
    form.elements.apiBase.value = state.preferences.apiBase;
    form.elements.currency.value = state.preferences.currency;
    form.elements.theme.value = state.preferences.theme;
    dialog.showModal();
  });
  $("#settings-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    state.preferences = mergePreferences(Object.fromEntries(data));
    store.write("preferences", state.preferences);
    api = new ApiClient(state.preferences.apiBase);
    setTheme();
    dialog.close();
    await loadData();
  });
}

async function init() {
  setTheme();
  $("#period-picker").value = state.period;
  applyTransactionDraft();
  bindEvents();
  showView("dashboard");
  await loadData();
}

init();
