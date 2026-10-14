from __future__ import annotations

from pathlib import Path
from typing import Any

from flask import Flask, jsonify, send_from_directory

from .api import api
from .repository import TextFileFinanceRepository
from .service import FinanceService


def create_app(config: dict[str, Any] | None = None) -> Flask:
    project_dir = Path(__file__).resolve().parent.parent.parent
    frontend_dir = project_dir / "frontend"
    app = Flask(
        __name__,
        static_folder=str(frontend_dir / "assets"),
        static_url_path="/assets",
    )
    app.config.from_mapping(
        DATA_DIR=str(Path(__file__).resolve().parent.parent / "data"),
        FRONTEND_DIR=str(frontend_dir),
        JSON_SORT_KEYS=False,
        TESTING=False,
    )
    if config:
        app.config.update(config)

    repository = TextFileFinanceRepository(Path(app.config["DATA_DIR"]))
    app.extensions["finance_service"] = FinanceService(repository)
    app.register_blueprint(api)

    @app.get("/")
    def frontend_index():
        return send_from_directory(app.config["FRONTEND_DIR"], "index.html")

    @app.after_request
    def add_cors_headers(response):
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, PUT, DELETE, OPTIONS"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.errorhandler(404)
    def not_found(_error):
        return jsonify({"error": {"code": "not_found", "message": "The requested resource was not found."}}), 404

    @app.errorhandler(405)
    def method_not_allowed(_error):
        return jsonify({"error": {"code": "method_not_allowed", "message": "This HTTP method is not allowed for the resource."}}), 405

    return app


__all__ = ["create_app"]
