from __future__ import annotations

import csv
import json
import os
import tempfile
import threading
from pathlib import Path
from typing import Iterable

from .domain import Transaction, parse_date, parse_money, normalize_type


TRANSACTION_FIELDS = ["id", "occurred_on", "type", "category", "amount", "note"]


class TextFileFinanceRepository:
    """CSV/JSON repository with atomic rewrites and injectable data directory."""

    def __init__(self, data_dir: Path):
        self.data_dir = Path(data_dir)
        self.transactions_file = self.data_dir / "transactions.csv"
        self.budgets_file = self.data_dir / "budgets.json"
        self._lock = threading.RLock()
        self._ensure_files()

    def _ensure_files(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        if not self.transactions_file.exists():
            self._write_transactions([])
        if not self.budgets_file.exists():
            self._atomic_write_text(self.budgets_file, json.dumps({"budgets": {}}, indent=2))

    @staticmethod
    def _atomic_write_text(path: Path, content: str) -> None:
        handle, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
        try:
            with os.fdopen(handle, "w", encoding="utf-8", newline="") as stream:
                stream.write(content)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temp_name, path)
        finally:
            if os.path.exists(temp_name):
                os.unlink(temp_name)

    def _write_transactions(self, transactions: Iterable[Transaction]) -> None:
        handle, temp_name = tempfile.mkstemp(prefix=".transactions.", suffix=".tmp", dir=self.data_dir)
        try:
            with os.fdopen(handle, "w", encoding="utf-8", newline="") as stream:
                writer = csv.DictWriter(stream, fieldnames=TRANSACTION_FIELDS)
                writer.writeheader()
                for transaction in transactions:
                    writer.writerow(transaction.to_dict())
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temp_name, self.transactions_file)
        finally:
            if os.path.exists(temp_name):
                os.unlink(temp_name)

    def list_transactions(self) -> list[Transaction]:
        with self._lock:
            with self.transactions_file.open("r", encoding="utf-8", newline="") as stream:
                rows = list(csv.DictReader(stream))
        transactions = [
            Transaction(
                id=row["id"],
                occurred_on=parse_date(row["occurred_on"]),
                type=normalize_type(row["type"]),
                category=row["category"],
                amount=parse_money(row["amount"]),
                note=row.get("note", ""),
            )
            for row in rows
            if row.get("id")
        ]
        return sorted(transactions, key=lambda item: (item.occurred_on, item.id), reverse=True)

    def save_transactions(self, transactions: Iterable[Transaction]) -> None:
        with self._lock:
            self._write_transactions(transactions)

    def load_budgets(self) -> dict[str, dict[str, str]]:
        with self._lock:
            payload = json.loads(self.budgets_file.read_text(encoding="utf-8"))
        budgets = payload.get("budgets", {})
        return budgets if isinstance(budgets, dict) else {}

    def save_budgets(self, budgets: dict[str, dict[str, str]]) -> None:
        with self._lock:
            self._atomic_write_text(
                self.budgets_file,
                json.dumps({"budgets": budgets}, ensure_ascii=False, indent=2) + "\n",
            )

