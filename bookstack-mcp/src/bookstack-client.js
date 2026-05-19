/**
 * BookStack API Client
 * Handles authentication and all HTTP communication with the BookStack REST API.
 * Auth uses Token ID + Token Secret as a Bearer token: "Token {id}:{secret}"
 */
export class BookStackClient {
  constructor(baseUrl, tokenId, tokenSecret) {
    // Strip trailing slash and /api suffix if provided
    this.baseUrl = baseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    this.apiBase = `${this.baseUrl}/api`;
    this.authHeader = `Token ${tokenId}:${tokenSecret}`;
  }

  async request(method, path, body = null, isFormData = false) {
    const url = `${this.apiBase}${path}`;
    const headers = { Authorization: this.authHeader };

    let bodyContent = null;
    if (body !== null) {
      if (isFormData) {
        bodyContent = body; // FormData object
      } else {
        headers['Content-Type'] = 'application/json';
        bodyContent = JSON.stringify(body);
      }
    }

    const response = await fetch(url, {
      method,
      headers,
      body: bodyContent,
    });

    if (!response.ok) {
      let errorMsg = `BookStack API error: ${response.status} ${response.statusText}`;
      try {
        const errBody = await response.json();
        if (errBody.error?.message) errorMsg += ` — ${errBody.error.message}`;
        else if (errBody.message) errorMsg += ` — ${errBody.message}`;
      } catch {}
      throw new Error(errorMsg);
    }

    // Some DELETE endpoints return 204 No Content
    if (response.status === 204) return { success: true };

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return response.json();
    }
    // For export endpoints that return raw content (HTML, PDF, etc.)
    return { content: await response.text(), contentType };
  }

  get(path) { return this.request('GET', path); }
  post(path, body) { return this.request('POST', path, body); }
  put(path, body) { return this.request('PUT', path, body); }
  delete(path) { return this.request('DELETE', path); }
  postForm(path, formData) { return this.request('POST', path, formData, true); }
  putForm(path, formData) { return this.request('PUT', path, formData, true); }

  // Build query string from params object, omitting null/undefined values
  buildQuery(params = {}) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== null && v !== undefined && v !== '') q.append(k, String(v));
    }
    const str = q.toString();
    return str ? `?${str}` : '';
  }
}
