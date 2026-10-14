from __future__ import annotations

import os

from personal_finance_api import create_app


app = create_app()


if __name__ == "__main__":
    port = int(os.environ.get("PF_API_PORT", "5000"))
    app.run(host="127.0.0.1", port=port, debug=False)

