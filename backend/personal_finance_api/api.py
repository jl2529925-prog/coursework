from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Callable

from flask import Blueprint, current_app, jsonify, request
from werkzeug.exceptions import BadRequest

from .service import FinanceService, NotFoundError


api = Blueprint("api", __name__, url_prefix="/api/v1")


def service() -> FinanceService:
    return current_app.extensions["finance_service"]


def ok(data: Any, status: int = 200):
    response = jsonify({"data": data, "meta": {"timestamp": datetime.now(UTC).isoformat()}})
    response.status_code = status
    return response


def fail(code: str, message: str, status: int, details: dict[str, str] | None = None):
    payload: dict[str, Any] = {"error": {"code": code, "message": message}}
    if details:
        payload["error"]["details"] = details
    return jsonify(payload), status


def json_body() -> dict[str, object]:
    if not request.is_json:
        raise ValueError("Content-Type must be application/json.")
    try:
        payload = request.get_json()
    except BadRequest as exc:
        raise ValueError("Request body contains invalid JSON.") from exc
    if not isinstance(payload, dict):
        raise ValueError("Request body must be a JSON object.")
    return payload


def handled(action: Callable[[], Any]):
    try:
        return action()
    except NotFoundError as exc:
        return fail("not_found", str(exc), 404)
    except ValueError as exc:
        return fail("validation_error", str(exc), 422)


@api.route("/health", methods=["GET", "OPTIONS"])
def health():
    if request.method == "OPTIONS":
        return "", 204
    return ok({"status": "ok", "service": "personal-finance-api", "version": "1.0"})


@api.route("/transactions", methods=["GET", "POST", "OPTIONS"])
def transactions_collection():
    if request.method == "OPTIONS":
        return "", 204
    if request.method == "GET":
        return handled(lambda: ok([item.to_dict() for item in service().list_transactions(request.args)]))
    return handled(lambda: ok(service().create_transaction(json_body()).to_dict(), 201))


@api.route("/transactions/<transaction_id>", methods=["GET", "PATCH", "DELETE", "OPTIONS"])
def transaction_item(transaction_id: str):
    if request.method == "OPTIONS":
        return "", 204
    if request.method == "GET":
        return handled(lambda: ok(service().get_transaction(transaction_id).to_dict()))
    if request.method == "PATCH":
        return handled(lambda: ok(service().update_transaction(transaction_id, json_body()).to_dict()))

    def delete_action():
        service().delete_transaction(transaction_id)
        return "", 204

    return handled(delete_action)


@api.route("/budgets/<year>/<month>", methods=["GET", "PUT", "OPTIONS"])
def budget_item(year: str, month: str):
    if request.method == "OPTIONS":
        return "", 204
    if request.method == "GET":
        return handled(lambda: ok(service().get_budget(year, month)))
    return handled(lambda: ok(service().set_budget(year, month, json_body())))


@api.route("/reports/monthly", methods=["GET", "OPTIONS"])
def monthly_report():
    if request.method == "OPTIONS":
        return "", 204
    return handled(lambda: ok(service().monthly_report(request.args.get("year"), request.args.get("month"))))


@api.route("/categories", methods=["GET", "OPTIONS"])
def categories():
    if request.method == "OPTIONS":
        return "", 204
    return ok(service().categories())

