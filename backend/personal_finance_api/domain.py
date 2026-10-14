from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import date, datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Iterable, Literal, Mapping


TransactionType = Literal["income", "expense"]
MONEY_UNIT = Decimal("0.01")


def parse_date(value: object, field: str = "occurred_on") -> date:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} is required and must use YYYY-MM-DD format.")
    try:
        return datetime.strptime(value.strip(), "%Y-%m-%d").date()
    except ValueError as exc:
        raise ValueError(f"{field} must be a valid date in YYYY-MM-DD format.") from exc


def parse_money(value: object, field: str = "amount") -> Decimal:
    if isinstance(value, bool) or value is None:
        raise ValueError(f"{field} is required and must be a number greater than zero.")
    raw = str(value).strip().replace(",", "")
    try:
        amount = Decimal(raw)
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"{field} must be a valid number.") from exc
    if not amount.is_finite() or amount <= 0:
        raise ValueError(f"{field} must be greater than zero.")
    return amount.quantize(MONEY_UNIT, rounding=ROUND_HALF_UP)


def normalize_type(value: object) -> TransactionType:
    if not isinstance(value, str):
        raise ValueError("type must be either income or expense.")
    normalized = value.strip().lower()
    if normalized in {"income", "in", "i", "收入"}:
        return "income"
    if normalized in {"expense", "out", "o", "支出"}:
        return "expense"
    raise ValueError("type must be either income or expense.")


def clean_text(value: object, field: str, *, required: bool, max_length: int) -> str:
    if value is None:
        value = ""
    if not isinstance(value, str):
        raise ValueError(f"{field} must be text.")
    cleaned = " ".join(value.strip().split())
    if required and not cleaned:
        raise ValueError(f"{field} is required.")
    if len(cleaned) > max_length:
        raise ValueError(f"{field} must not exceed {max_length} characters.")
    return cleaned


def validate_period(year: object, month: object) -> tuple[int, int]:
    try:
        parsed_year = int(year)
        parsed_month = int(month)
    except (TypeError, ValueError) as exc:
        raise ValueError("year and month must be integers.") from exc
    if not 2000 <= parsed_year <= 2100:
        raise ValueError("year must be between 2000 and 2100.")
    if not 1 <= parsed_month <= 12:
        raise ValueError("month must be between 1 and 12.")
    return parsed_year, parsed_month


@dataclass(frozen=True, slots=True)
class Transaction:
    id: str
    occurred_on: date
    type: TransactionType
    category: str
    amount: Decimal
    note: str = ""

    @classmethod
    def from_payload(cls, transaction_id: str, payload: Mapping[str, object]) -> "Transaction":
        return cls(
            id=transaction_id,
            occurred_on=parse_date(payload.get("occurred_on")),
            type=normalize_type(payload.get("type")),
            category=clean_text(payload.get("category"), "category", required=True, max_length=40),
            amount=parse_money(payload.get("amount")),
            note=clean_text(payload.get("note", ""), "note", required=False, max_length=160),
        )

    def update(self, payload: Mapping[str, object]) -> "Transaction":
        allowed = {"occurred_on", "type", "category", "amount", "note"}
        unknown = set(payload) - allowed
        if unknown:
            raise ValueError(f"Unknown fields: {', '.join(sorted(unknown))}.")
        if not payload:
            raise ValueError("At least one editable field is required.")
        values = {
            "occurred_on": parse_date(payload["occurred_on"]) if "occurred_on" in payload else self.occurred_on,
            "type": normalize_type(payload["type"]) if "type" in payload else self.type,
            "category": clean_text(payload["category"], "category", required=True, max_length=40) if "category" in payload else self.category,
            "amount": parse_money(payload["amount"]) if "amount" in payload else self.amount,
            "note": clean_text(payload["note"], "note", required=False, max_length=160) if "note" in payload else self.note,
        }
        return replace(self, **values)

    def to_dict(self) -> dict[str, str]:
        return {
            "id": self.id,
            "occurred_on": self.occurred_on.isoformat(),
            "type": self.type,
            "category": self.category,
            "amount": f"{self.amount:.2f}",
            "note": self.note,
        }


def monthly_summary(transactions: Iterable[Transaction], year: int, month: int) -> dict[str, object]:
    income = Decimal("0")
    expense = Decimal("0")
    by_category: dict[str, Decimal] = {}
    count = 0
    for transaction in transactions:
        if transaction.occurred_on.year != year or transaction.occurred_on.month != month:
            continue
        count += 1
        if transaction.type == "income":
            income += transaction.amount
        else:
            expense += transaction.amount
            by_category[transaction.category] = by_category.get(transaction.category, Decimal("0")) + transaction.amount
    balance = income - expense
    category_rows = [
        {"category": category, "amount": f"{amount.quantize(MONEY_UNIT):.2f}"}
        for category, amount in sorted(by_category.items(), key=lambda item: (-item[1], item[0].lower()))
    ]
    return {
        "year": year,
        "month": month,
        "income": f"{income.quantize(MONEY_UNIT):.2f}",
        "expense": f"{expense.quantize(MONEY_UNIT):.2f}",
        "balance": f"{balance.quantize(MONEY_UNIT):.2f}",
        "transaction_count": count,
        "expense_by_category": category_rows,
    }


def apply_budget(summary: dict[str, object], limits: Mapping[str, str]) -> dict[str, object]:
    rows = []
    spent_by_category = {
        row["category"]: Decimal(str(row["amount"]))
        for row in summary.get("expense_by_category", [])
    }
    all_categories = sorted(set(limits) | set(spent_by_category), key=str.lower)
    for category in all_categories:
        spent = spent_by_category.get(category, Decimal("0")).quantize(MONEY_UNIT)
        limit = Decimal(str(limits[category])).quantize(MONEY_UNIT) if category in limits else None
        remaining = (limit - spent).quantize(MONEY_UNIT) if limit is not None else None
        usage = float((spent / limit * 100).quantize(MONEY_UNIT)) if limit and limit > 0 else None
        rows.append(
            {
                "category": category,
                "spent": f"{spent:.2f}",
                "limit": f"{limit:.2f}" if limit is not None else None,
                "remaining": f"{remaining:.2f}" if remaining is not None else None,
                "usage_percent": usage,
                "status": "over" if remaining is not None and remaining < 0 else ("warning" if usage is not None and usage >= 80 else "ok"),
            }
        )
    result = dict(summary)
    result["budget_status"] = rows
    return result

