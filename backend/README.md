# Back-end Part of Information System of Personal Finance

This folder is the second-semester **Computer Systems and Networks** coursework project. It extends the first-semester domain model into a versioned HTTP/REST API while retaining CSV/JSON text files as the external data source.

## Run

```powershell
cd backend
python app.py
```

The complete browser client opens at `http://127.0.0.1:5000/` and the API starts at `http://127.0.0.1:5000/api/v1`. Flask serves the static client for one-command demonstration; the client remains a separate source module and may also be served independently.

## Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Service status |
| GET, POST | `/transactions` | List/filter or create transactions |
| GET, PATCH, DELETE | `/transactions/{id}` | Read, edit or delete a transaction |
| GET, PUT | `/budgets/{year}/{month}` | Read or replace a monthly budget |
| GET | `/reports/monthly?year=YYYY&month=M` | Monthly totals, categories and budget status |
| GET | `/categories` | Suggested categories |

Successful responses use `{ "data": ..., "meta": ... }`. Errors use `{ "error": { "code": ..., "message": ... } }`.

## Automated API tests

```powershell
python -m unittest discover -s tests -v
python tools/run_coverage.py
```

Tests use a temporary data directory and never modify the sample data files.

## Course paper

The accompanying English course paper is `Backend_Course_Project_EN.docx`.

## Repository layout

The front-end and back-end folders can be uploaded as two separate repositories. For the integrated local demonstration, keep the checkouts next to each other with the names `frontend` and `backend`.

Install the dependencies with `python -m pip install -r requirements.txt` before running `python app.py`. The API can run on its own; the browser page at `/` requires the sibling `frontend` folder.
