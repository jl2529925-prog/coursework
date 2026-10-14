from __future__ import annotations

from typing import Mapping
from uuid import uuid4

from .domain import Transaction, apply_budget, clean_text, monthly_summary, parse_money, validate_period
from .repository import TextFileFinanceRepository


class NotFoundError(LookupError):
    pass


class FinanceService:
    def __init__(self, repository: TextFileFinanceRepository):
        self.repository = repository

    def list_transactions(self, filters: Mapping[str, str]) -> list[Transaction]:
        transactions = self.repository.list_transactions()
        if filters.get("year") or filters.get("month"):
            year, month = validate_period(filters.get("year"), filters.get("month"))
            transactions = [item for item in transactions if item.occurred_on.year == year and item.occurred_on.month == month]
        if filters.get("type"):
            transactions = [item for item in transactions if item.type == filters["type"].strip().lower()]
        if filters.get("category"):
            category = filters["category"].strip().casefold()
            transactions = [item for item in transactions if item.category.casefold() == category]
        return transactions

    def get_transaction(self, transaction_id: str) -> Transaction:
        for item in self.repository.list_transactions():
            if item.id == transaction_id:
                return item
        raise NotFoundError("Transaction was not found.")

    def create_transaction(self, payload: Mapping[str, object]) -> Transaction:
        allowed = {"occurred_on", "type", "category", "amount", "note"}
        unknown = set(payload) - allowed
        if unknown:
            raise ValueError(f"Unknown fields: {', '.join(sorted(unknown))}.")
        transaction = Transaction.from_payload(str(uuid4()), payload)
        transactions = self.repository.list_transactions()
        transactions.append(transaction)
        self.repository.save_transactions(transactions)
        return transaction

    def update_transaction(self, transaction_id: str, payload: Mapping[str, object]) -> Transaction:
        transactions = self.repository.list_transactions()
        updated = None
        result = []
        for item in transactions:
            if item.id == transaction_id:
                updated = item.update(payload)
                result.append(updated)
            else:
                result.append(item)
        if updated is None:
            raise NotFoundError("Transaction was not found.")
        self.repository.save_transactions(result)
        return updated

    def delete_transaction(self, transaction_id: str) -> None:
        transactions = self.repository.list_transactions()
        result = [item for item in transactions if item.id != transaction_id]
        if len(result) == len(transactions):
            raise NotFoundError("Transaction was not found.")
        self.repository.save_transactions(result)

    def get_budget(self, year: object, month: object) -> dict[str, object]:
        parsed_year, parsed_month = validate_period(year, month)
        key = f"{parsed_year:04d}-{parsed_month:02d}"
        limits = self.repository.load_budgets().get(key, {})
        return {"year": parsed_year, "month": parsed_month, "limits": limits}

    def set_budget(self, year: object, month: object, payload: Mapping[str, object]) -> dict[str, object]:
        parsed_year, parsed_month = validate_period(year, month)
        if set(payload) != {"limits"} or not isinstance(payload.get("limits"), dict):
            raise ValueError("Request body must contain one object field named limits.")
        cleaned: dict[str, str] = {}
        for raw_category, raw_limit in payload["limits"].items():
            category = clean_text(raw_category, "category", required=True, max_length=40)
            cleaned[category] = f"{parse_money(raw_limit, 'limit'):.2f}"
        key = f"{parsed_year:04d}-{parsed_month:02d}"
        budgets = self.repository.load_budgets()
        budgets[key] = dict(sorted(cleaned.items(), key=lambda item: item[0].lower()))
        self.repository.save_budgets(budgets)
        return {"year": parsed_year, "month": parsed_month, "limits": budgets[key]}

    def monthly_report(self, year: object, month: object) -> dict[str, object]:
        parsed_year, parsed_month = validate_period(year, month)
        summary = monthly_summary(self.repository.list_transactions(), parsed_year, parsed_month)
        budget = self.get_budget(parsed_year, parsed_month)
        return apply_budget(summary, budget["limits"])

    def categories(self) -> list[str]:
        defaults = {"Salary", "Freelance", "Food", "Transport", "Housing", "Study", "Health", "Entertainment", "Other"}
        defaults.update(item.category for item in self.repository.list_transactions())
        return sorted(defaults, key=str.lower)

