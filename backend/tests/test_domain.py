from __future__ import annotations

import unittest
from datetime import date
from decimal import Decimal

from personal_finance_api.domain import (
    Transaction,
    apply_budget,
    monthly_summary,
    normalize_type,
    parse_date,
    parse_money,
    validate_period,
)


class DomainTests(unittest.TestCase):
    def test_parse_date_accepts_iso_date(self):
        self.assertEqual(parse_date("2026-08-05"), date(2026, 8, 5))

    def test_parse_date_rejects_invalid_calendar_date(self):
        with self.assertRaisesRegex(ValueError, "valid date"):
            parse_date("2026-02-30")

    def test_parse_money_rounds_half_up(self):
        self.assertEqual(parse_money("1,234.565"), Decimal("1234.57"))

    def test_parse_money_rejects_zero(self):
        with self.assertRaisesRegex(ValueError, "greater than zero"):
            parse_money("0")

    def test_parse_money_rejects_nan(self):
        with self.assertRaises(ValueError):
            parse_money("NaN")

    def test_normalize_type_supports_chinese_alias(self):
        self.assertEqual(normalize_type("收入"), "income")

    def test_normalize_type_rejects_unknown_value(self):
        with self.assertRaises(ValueError):
            normalize_type("transfer")

    def test_validate_period_checks_month_boundary(self):
        self.assertEqual(validate_period("2026", "12"), (2026, 12))
        with self.assertRaises(ValueError):
            validate_period(2026, 13)

    def test_monthly_summary_filters_and_groups(self):
        items = [
            Transaction("1", date(2026, 8, 1), "income", "Salary", Decimal("1000.00")),
            Transaction("2", date(2026, 8, 2), "expense", "Food", Decimal("120.00")),
            Transaction("3", date(2026, 8, 3), "expense", "Food", Decimal("30.00")),
            Transaction("4", date(2026, 7, 1), "expense", "Food", Decimal("999.00")),
        ]
        result = monthly_summary(items, 2026, 8)
        self.assertEqual(result["income"], "1000.00")
        self.assertEqual(result["expense"], "150.00")
        self.assertEqual(result["balance"], "850.00")
        self.assertEqual(result["transaction_count"], 3)
        self.assertEqual(result["expense_by_category"][0], {"category": "Food", "amount": "150.00"})

    def test_apply_budget_marks_warning_and_over(self):
        summary = {"expense_by_category": [{"category": "Food", "amount": "90.00"}, {"category": "Study", "amount": "120.00"}]}
        result = apply_budget(summary, {"Food": "100.00", "Study": "100.00"})
        statuses = {row["category"]: row["status"] for row in result["budget_status"]}
        self.assertEqual(statuses, {"Food": "warning", "Study": "over"})


if __name__ == "__main__":
    unittest.main()

