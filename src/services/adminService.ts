export const adminService = {
  getToken() {
    return localStorage.getItem('adminToken');
  },

  setToken(token: string) {
    localStorage.setItem('adminToken', token);
  },

  removeToken() {
    localStorage.removeItem('adminToken');
  },

  async fetchWithAuth(url: string, options: RequestInit = {}) {
    const token = this.getToken();
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      this.removeToken();
      window.location.href = '/admin'; // Force re-login
      throw new Error('Unauthorized');
    }
    return res;
  },

  async login(password: string) {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (!res.ok) throw new Error('Invalid password');
    const data = await res.json();
    this.setToken(data.token);
  },

  async getSettings() {
    const res = await this.fetchWithAuth('/api/settings');
    return res.json();
  },

  async updateSettings(settings: any) {
    const res = await this.fetchWithAuth('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    return res.json();
  },

  async getCandidates() {
    const res = await this.fetchWithAuth('/api/candidates');
    return res.json();
  },

  async createDomain(domain: any) {
    const res = await this.fetchWithAuth('/api/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(domain)
    });
    if (!res.ok) throw new Error('Failed to create domain');
    return res.json();
  },

  async updateDomain(id: string, domain: any) {
    const res = await this.fetchWithAuth(`/api/domains/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(domain)
    });
    if (!res.ok) throw new Error('Failed to update domain');
    return res.json();
  },

  async deleteDomain(id: string) {
    const res = await this.fetchWithAuth(`/api/domains/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to delete domain');
    }
    return res.json();
  }
};
