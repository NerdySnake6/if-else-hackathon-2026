import { getToken } from './state.js';

const API_BASE = '/api';

export function apiFetch(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const token = getToken();
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    return fetch(`${API_BASE}${path}`, { ...options, headers });
}
