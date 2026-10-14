from __future__ import annotations

import csv
import json
import tempfile
import unittest
from pathlib import Path

from personal_finance_api import create_app


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        data_dir = Path(self.temp_dir.name)
        with (data_dir / "transactions.csv").open("w", encoding="utf-8", newline="") as stream:
            writer = csv.writer(stream)
            writer.writerow(["id", "occurred_on", "type", "category", "amount", "note"])
            writer.writerow(["tx-1", "2026-08-01", "income", "Salary", "5000.00", "Pay"])
            writer.writerow(["tx-2", "2026-08-02", "expense", "Food", "120.00", "Groceries"])
        (data_dir / "budgets.json").write_text(
            json.dumps({"budgets": {"2026-08": {"Food": "100.00"}}}), encoding="utf-8"
        )
        self.app = create_app({"TESTING": True, "DATA_DIR": self.temp_dir.name})
        self.client = self.app.test_client()

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_health_endpoint(self):
        response = self.client.get("/api/v1/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["data"]["status"], "ok")

    def test_cors_headers_are_present(self):
        response = self.client.get("/api/v1/health")
        self.assertEqual(response.headers["Access-Control-Allow-Origin"], "*")

    def test_list_transactions_returns_records(self):
        response = self.client.get("/api/v1/transactions")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.get_json()["data"]), 2)

    def test_list_transactions_filters_period(self):
        response = self.client.get("/api/v1/transactions?year=2026&month=8")
        self.assertEqual(len(response.get_json()["data"]), 2)

    def test_list_transactions_rejects_partial_period(self):
        response = self.client.get("/api/v1/transactions?year=2026")
        self.assertEqual(response.status_code, 422)

    def test_get_transaction(self):
        response = self.client.get("/api/v1/transactions/tx-1")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["data"]["amount"], "5000.00")

    def test_get_missing_transaction_returns_404(self):
        response = self.client.get("/api/v1/transactions/missing")
        self.assertEqual(response.status_code, 404)

    def test_create_transaction(self):
        response = self.client.post(
            "/api/v1/transactions",
            json={"occurred_on": "2026-08-05", "type": "expense", "category": "Transport", "amount": "12.5", "note": "Bus"},
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()["data"]["amount"], "12.50")
        self.assertEqual(len(self.client.get("/api/v1/transactions").get_json()["data"]), 3)

    def test_create_requires_json_content_type(self):
        response = self.client.post("/api/v1/transactions", data="not-json")
        self.assertEqual(response.status_code, 422)

    def test_create_rejects_invalid_amount(self):
        response = self.client.post(
            "/api/v1/transactions",
            json={"occurred_on": "2026-08-05", "type": "expense", "category": "Food", "amount": "0"},
        )
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.get_json()["error"]["code"], "validation_error")

    def test_create_rejects_unknown_field(self):
        response = self.client.post(
            "/api/v1/transactions",
            json={"occurred_on": "2026-08-05", "type": "expense", "category": "Food", "amount": "1", "owner": "x"},
        )
        self.assertEqual(response.status_code, 422)

    def test_patch_transaction(self):
        response = self.client.patch("/api/v1/transactions/tx-2", json={"amount": "180.25", "note": "Weekly groceries"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["data"]["amount"], "180.25")

    def test_patch_empty_body_is_rejected(self):
        response = self.client.patch("/api/v1/transactions/tx-2", json={})
        self.assertEqual(response.status_code, 422)

    def test_delete_transaction(self):
        response = self.client.delete("/api/v1/transactions/tx-2")
        self.assertEqual(response.status_code, 204)
        self.assertEqual(len(self.client.get("/api/v1/transactions").get_json()["data"]), 1)

    def test_delete_missing_transaction(self):
        response = self.client.delete("/api/v1/transactions/missing")
        self.assertEqual(response.status_code, 404)

    def test_get_budget(self):
        response = self.client.get("/api/v1/budgets/2026/8")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["data"]["limits"]["Food"], "100.00")

    def test_put_budget(self):
        response = self.client.put("/api/v1/budgets/2026/8", json={"limits": {"Food": "800", "Study": 350}})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["data"]["limits"]["Study"], "350.00")

    def test_put_budget_rejects_invalid_shape(self):
        response = self.client.put("/api/v1/budgets/2026/8", json={"Food": 100})
        self.assertEqual(response.status_code, 422)

    def test_monthly_report_calculates_budget_status(self):
        response = self.client.get("/api/v1/reports/monthly?year=2026&month=8")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()["data"]
        self.assertEqual(data["balance"], "4880.00")
        self.assertEqual(data["budget_status"][0]["status"], "over")

    def test_monthly_report_requires_period(self):
        response = self.client.get("/api/v1/reports/monthly")
        self.assertEqual(response.status_code, 422)

    def test_categories_include_defaults_and_data(self):
        response = self.client.get("/api/v1/categories")
        self.assertIn("Salary", response.get_json()["data"])

    def test_unknown_route_returns_json_404(self):
        response = self.client.get("/api/v1/nope")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json()["error"]["code"], "not_found")

    def test_options_preflight(self):
        response = self.client.options("/api/v1/transactions")
        self.assertEqual(response.status_code, 204)


if __name__ == "__main__":
    unittest.main()

