# Front-end Part of Information System of Personal Finance

This folder is the second-semester **Software Design** coursework project. It is a browser-based client for the REST API in `../backend`.

## Run

The easiest integrated run is `python app.py` inside `../backend`, then open `http://127.0.0.1:5000/`.

For a separate front-end development server, start the API first and then serve this directory over HTTP:

```powershell
cd frontend
python -m http.server 5173
```

Open `http://127.0.0.1:5173/`. The default API base is `http://127.0.0.1:5000/api/v1` and can be changed through **API settings**.

## Implemented requirements

- Calls the back-end REST API for transactions, budgets, categories and monthly reports.
- Validates transaction and budget input before submission and shows field-specific errors.
- Uses browser local storage for settings, unfinished form drafts and last successful monthly data cache.
- Shows a clearly labelled offline demonstration snapshot only when neither the API nor a saved monthly cache is available.
- Supports keyboard focus, responsive layouts and reduced-motion preferences.
- Uses no front-end framework or CDN dependency, so the project remains easy to inspect and run.

## Automated module tests

```powershell
npm test
```

The tests use Node's built-in test runner and cover validation, formatting, storage and API error handling.

## Course paper

The accompanying English course paper is `Frontend_Course_Project_EN.docx`.

## Repository layout

The front-end and back-end folders can be uploaded as two separate repositories. For the integrated local demonstration, keep the checkouts next to each other with the names `frontend` and `backend`.

For live data, run the back-end API and set its URL through API settings. Without the API or cached data, the client shows its labelled read-only demonstration data.
