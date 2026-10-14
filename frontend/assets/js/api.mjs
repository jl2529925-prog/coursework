export class ApiError extends Error {
  constructor(message, { status = 0, code = "network_error", details = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ApiClient {
  constructor(baseUrl, fetchImpl = globalThis.fetch) {
    this.baseUrl = String(baseUrl).replace(/\/+$/, "");
    this.fetch = fetchImpl;
  }

  async request(path, options = {}) {
    let response;
    try {
      const requestOptions = {
        headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
        ...options,
      };
      response = typeof this.fetch === "function"
        ? await this.fetch(`${this.baseUrl}${path}`, requestOptions)
        : await xhrRequest(`${this.baseUrl}${path}`, requestOptions);
    } catch (error) {
      throw new ApiError("The finance API could not be reached. Check that the back-end server is running.", { details: error });
    }

    if (response.status === 204) return null;
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new ApiError("The API returned an unreadable response.", { status: response.status, code: "invalid_response" });
    }
    if (!response.ok) {
      throw new ApiError(payload?.error?.message ?? "The request failed.", {
        status: response.status,
        code: payload?.error?.code ?? "request_failed",
        details: payload?.error?.details ?? null,
      });
    }
    return payload.data;
  }

  health() { return this.request("/health"); }
  transactions(query = "") { return this.request(`/transactions${query ? `?${query}` : ""}`); }
  createTransaction(payload) { return this.request("/transactions", { method: "POST", body: JSON.stringify(payload) }); }
  deleteTransaction(id) { return this.request(`/transactions/${encodeURIComponent(id)}`, { method: "DELETE" }); }
  budget(year, month) { return this.request(`/budgets/${year}/${month}`); }
  saveBudget(year, month, limits) { return this.request(`/budgets/${year}/${month}`, { method: "PUT", body: JSON.stringify({ limits }) }); }
  report(year, month) { return this.request(`/reports/monthly?year=${year}&month=${month}`); }
  categories() { return this.request("/categories"); }
}

function xhrRequest(url, options) {
  return new Promise((resolve, reject) => {
    if (typeof XMLHttpRequest === "undefined") {
      reject(new Error("No browser HTTP transport is available."));
      return;
    }
    const request = new XMLHttpRequest();
    request.open(options.method ?? "GET", url, true);
    Object.entries(options.headers ?? {}).forEach(([key, value]) => request.setRequestHeader(key, value));
    request.onload = () => resolve({
      ok: request.status >= 200 && request.status < 300,
      status: request.status,
      async json() { return JSON.parse(request.responseText); },
    });
    request.onerror = () => reject(new Error("Network request failed."));
    request.send(options.body ?? null);
  });
}
