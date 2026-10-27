/**
 * Fetch helper untuk dashboard SPA.
 * Single-user, tanpa login: semua endpoint API publik, tidak ada token.
 */

function apiOrigin() {
    if (import.meta.env.VITE_APP_URL) {
        return String(import.meta.env.VITE_APP_URL).replace(/\/$/, '');
    }
    return '';
}

export default {
    /**
     * Fetch JSON dari API yang sama-origin.
     * @param {string} path — mis. `/api/dashboard` atau URL absolut
     * @param {RequestInit} options
     * @returns {Promise<Response|null>}
     */
    async apiFetch(path, options = {}) {
        const headers = new Headers(options.headers || {});
        if (!headers.has('Accept')) headers.set('Accept', 'application/json');

        const url =
            path.startsWith('http') || path.startsWith('//')
                ? path
                : `${apiOrigin() || ''}${path.startsWith('/') ? '' : '/'}${path}`;

        const res = await fetch(url, {
            ...options,
            headers,
            credentials: 'same-origin',
        });

        return res;
    },

    /**
     * Parse JSON dari response OK; lempar Error jika gagal.
     * @param {Response} res
     */
    async parseJson(res) {
        const text = await res.text();
        if (!text) return null;
        try {
            return JSON.parse(text);
        } catch {
            throw new Error('Response bukan JSON');
        }
    },

    async apiJson(path, options = {}) {
        const res = await this.apiFetch(path, options);
        if (!res) return null;
        if (!res.ok) {
            let msg = `HTTP ${res.status}`;
            try {
                const err = await res.json();
                if (err.message) msg = err.message;
            } catch {
                /* ignore */
            }
            throw new Error(msg);
        }
        return this.parseJson(res);
    },
};
