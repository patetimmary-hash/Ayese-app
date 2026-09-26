// API client with JWT auth
export const API = {
  token: localStorage.getItem('ayese_token'),
  user: JSON.parse(localStorage.getItem('ayese_user') || 'null'),

  async request(path, options = {}) {
    const res = await fetch('/api' + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (res.status === 401) {
      this.logout();
      throw new Error('Session expired');
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  setSession(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('ayese_token', token);
    localStorage.setItem('ayese_user', JSON.stringify(user));
  },

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('ayese_token');
    localStorage.removeItem('ayese_user');
  },

  isLoggedIn() { return !!this.token; },

  // Auth
  register(email, password, name) { return this.request('/auth/register', { method: 'POST', body: { email, password, name } }); },
  login(email, password) { return this.request('/auth/login', { method: 'POST', body: { email, password } }); },
  googleAuth(idToken) { return this.request('/auth/google', { method: 'POST', body: { idToken } }); },
  me() { return this.request('/auth/me'); },
  config() { return this.request('/config'); },

  // Reports
  getReports() { return this.request('/reports'); },
  createReport(data) { return this.request('/reports', { method: 'POST', body: data }); },
  resolveReport(id) { return this.request(`/reports/${id}/resolve`, { method: 'PATCH' }); },
  flagReport(id) { return this.request('/flags', { method: 'POST', body: { reportId: id } }); },

  // Adoptions
  getAdoptions() { return this.request('/adoptions'); },
  adoptArea(area) { return this.request('/adoptions', { method: 'POST', body: { area } }); },

  // Rewards
  getRewards() { return this.request('/rewards'); },
  getImpact() { return this.request('/impact'); },
};
