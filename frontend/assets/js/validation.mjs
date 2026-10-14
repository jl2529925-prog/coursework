const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONEY = /^\d+(?:\.\d{1,2})?$/;

export function validateTransaction(input) {
  const errors = {};
  const date = String(input.occurred_on ?? "").trim();
  const parts = date.split("-").map(Number);
  const parsedDate = ISO_DATE.test(date) ? new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])) : null;
  const exactDate = parsedDate
    && parsedDate.getUTCFullYear() === parts[0]
    && parsedDate.getUTCMonth() === parts[1] - 1
    && parsedDate.getUTCDate() === parts[2];
  if (!exactDate) {
    errors.occurred_on = "Choose a valid calendar date.";
  }

  if (!["income", "expense"].includes(input.type)) {
    errors.type = "Choose money in or money out.";
  }

  const category = String(input.category ?? "").trim();
  if (!category) errors.category = "Enter a category.";
  else if (category.length > 40) errors.category = "Keep the category within 40 characters.";

  const amountText = String(input.amount ?? "").trim().replaceAll(",", "");
  if (!MONEY.test(amountText) || Number(amountText) <= 0) {
    errors.amount = "Enter an amount greater than zero with up to 2 decimals.";
  }

  const note = String(input.note ?? "").trim();
  if (note.length > 160) errors.note = "Keep the note within 160 characters.";

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateBudgetRows(rows) {
  const errors = {};
  const limits = {};
  rows.forEach((row, index) => {
    const category = String(row.category ?? "").trim();
    const limit = String(row.limit ?? "").trim().replaceAll(",", "");
    if (!category && !limit) return;
    if (!category) errors[`category-${index}`] = "Category is required.";
    if (category.length > 40) errors[`category-${index}`] = "Use 40 characters or fewer.";
    if (!MONEY.test(limit) || Number(limit) <= 0) errors[`limit-${index}`] = "Use a positive amount with up to 2 decimals.";
    if (category && Object.hasOwn(limits, category)) errors[`category-${index}`] = "Each category can appear only once.";
    if (category && MONEY.test(limit) && Number(limit) > 0) limits[category] = Number(limit).toFixed(2);
  });
  if (Object.keys(limits).length === 0) errors.form = "Add at least one complete budget row.";
  return { valid: Object.keys(errors).length === 0, errors, limits };
}

export function formToTransaction(formData) {
  return {
    occurred_on: String(formData.get("occurred_on") ?? "").trim(),
    type: String(formData.get("type") ?? "").trim(),
    category: String(formData.get("category") ?? "").trim(),
    amount: String(formData.get("amount") ?? "").trim(),
    note: String(formData.get("note") ?? "").trim(),
  };
}
