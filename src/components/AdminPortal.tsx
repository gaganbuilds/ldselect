import React, { useState, useEffect, useMemo } from 'react';
import { adminService } from '../services/adminService';
import type { Domain } from '../services/domainService';

type SortOption = 'newest' | 'oldest' | 'name-asc';

export const AdminPortal: React.FC = () => {
  const [token, setToken] = useState<string | null>(adminService.getToken());
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Data states
  const [domains, setDomains] = useState<Domain[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [registrationOpen, setRegistrationOpen] = useState(true);
  
  // UI States
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{type: 'success'|'error', msg: string} | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modals
  const [domainModalOpen, setDomainModalOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState<Domain | null>(null);
  
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDanger?: boolean;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const loadData = async () => {
    setLoading(true);
    try {
      const [domRes, candRes, setRes] = await Promise.all([
        fetch('/api/domains').then(r => r.json()),
        adminService.getCandidates(),
        adminService.getSettings()
      ]);
      setDomains(domRes);
      setCandidates(candRes);
      setRegistrationOpen(setRes.registrationOpen);
    } catch (err) {
      showNotification('error', 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadData();
  }, [token]);

  const showNotification = (type: 'success'|'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminService.login(password);
      setToken(adminService.getToken());
      setLoginError('');
    } catch (err: any) {
      setLoginError(err.message);
    }
  };

  const handleLogout = () => {
    adminService.removeToken();
    setToken(null);
  };

  // --- Domain Management Actions ---

  const openDomainModal = (domain?: Domain) => {
    setEditingDomain(domain || null);
    setDomainModalOpen(true);
  };

  const handleSaveDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const capacity = parseInt(formData.get('capacity') as string, 10);
    const status = formData.get('status') as string;

    if (editingDomain && capacity < (editingDomain.currentCount || 0)) {
      alert(`Capacity cannot be lower than the current number of registered candidates (${editingDomain.currentCount}).`);
      return;
    }

    try {
      if (editingDomain) {
        await adminService.updateDomain(editingDomain.id, { ...editingDomain, name, description, capacity, status });
        showNotification('success', 'Domain updated successfully.');
      } else {
        const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        await adminService.createDomain({ id, name, description, capacity, status });
        showNotification('success', 'Domain added successfully.');
      }
      setDomainModalOpen(false);
      loadData();
    } catch (err: any) {
      showNotification('error', 'Failed to save domain.');
    }
  };

  const confirmToggleStatus = (domain: Domain) => {
    const isClosing = domain.status !== 'closed';
    setConfirmModal({
      isOpen: true,
      title: isClosing ? 'Close Domain' : 'Open Domain',
      message: isClosing 
        ? `Are you sure you want to close "${domain.name}"? Candidates will no longer be able to select it.` 
        : `Are you sure you want to open "${domain.name}" for candidates?`,
      isDanger: isClosing,
      onConfirm: async () => {
        try {
          await adminService.updateDomain(domain.id, { ...domain, status: isClosing ? 'closed' : 'open' });
          showNotification('success', `Domain ${isClosing ? 'closed' : 'opened'} successfully.`);
          loadData();
        } catch (err) {
          showNotification('error', 'Failed to update domain status.');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const confirmDeleteDomain = (domain: Domain) => {
    if ((domain.currentCount || 0) > 0) {
      setConfirmModal({
        isOpen: true,
        title: 'Cannot Delete',
        message: `"${domain.name}" has ${domain.currentCount} registered candidates. You should close it instead of deleting it to preserve history.`,
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }
    
    setConfirmModal({
      isOpen: true,
      title: 'Delete Domain',
      message: `Are you sure you want to permanently delete "${domain.name}"? This action cannot be undone.`,
      isDanger: true,
      onConfirm: async () => {
        try {
          await adminService.deleteDomain(domain.id);
          showNotification('success', 'Domain deleted successfully.');
          loadData();
        } catch (err) {
          showNotification('error', 'Failed to delete domain.');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const confirmToggleRegistration = () => {
    setConfirmModal({
      isOpen: true,
      title: registrationOpen ? 'Close Registration' : 'Open Registration',
      message: registrationOpen 
        ? 'Close registration for all candidates? Candidates will no longer be able to submit domain selections.' 
        : 'Open registration? Candidates will be able to submit their selections.',
      isDanger: registrationOpen,
      onConfirm: async () => {
        try {
          await adminService.updateSettings({ registrationOpen: !registrationOpen });
          showNotification('success', `Registration ${registrationOpen ? 'closed' : 'opened'} successfully.`);
          loadData();
        } catch (err) {
          showNotification('error', 'Failed to update registration status.');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // --- Filtering & Sorting ---

  const filteredAndSortedCandidates = useMemo(() => {
    let result = candidates.filter(c => {
      const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.candidateId.toLowerCase().includes(search.toLowerCase());
      const matchDomain = domainFilter === 'all' || c.domainId === domainFilter;
      return matchSearch && matchDomain;
    });

    result.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      if (sortBy === 'oldest') return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      return 0;
    });

    return result;
  }, [candidates, search, domainFilter, sortBy]);

  const paginatedCandidates = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAndSortedCandidates.slice(start, start + pageSize);
  }, [filteredAndSortedCandidates, page, pageSize]);

  const totalPages = Math.ceil(filteredAndSortedCandidates.length / pageSize) || 1;

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const clearFilters = () => {
    setSearch('');
    setDomainFilter('all');
    setSortBy('newest');
    setPage(1);
  };

  const exportCSV = () => {
    if (filteredAndSortedCandidates.length === 0) {
      showNotification('error', 'No candidates to export.');
      return;
    }
    const headers = ['Name', 'Candidate ID', 'Domain', 'Submitted At'];
    const rows = filteredAndSortedCandidates.map(c => [
      `"${c.name}"`, 
      `"${c.candidateId}"`, 
      `"${c.domainName}"`, 
      `"${new Date(c.timestamp).toLocaleString()}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `candidates_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('success', 'CSV exported successfully.');
  };

  if (!token) {
    return (
      <div className="container" style={{ maxWidth: '400px' }}>
        <div className="form-section">
          <h2 style={{ marginBottom: '1rem' }}>Admin Login</h2>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input 
                type="password" 
                className="form-input" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
              />
            </div>
            {loginError && <div className="error-text" style={{marginBottom: '1rem'}}>{loginError}</div>}
            <button type="submit" className="btn-submit">Login</button>
          </form>
        </div>
      </div>
    );
  }

  const availableDomains = domains.filter(d => d.status === 'open').length;
  const fullDomains = domains.filter(d => d.status === 'full').length;
  const closedDomains = domains.filter(d => d.status === 'closed').length;

  return (
    <div className="container" style={{ maxWidth: '1200px' }}>
      {/* Notification */}
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.msg}
        </div>
      )}

      {/* Header */}
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{fontSize: '2rem'}}>ML Internship — Admin</h1>
          <p>Track 2 Selection System</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button onClick={loadData} className="btn-secondary" style={{ padding: '0.5rem 1rem' }} disabled={loading}>↻ Refresh</button>
          <button onClick={handleLogout} className="btn-secondary" style={{ padding: '0.5rem 1rem' }}>Logout</button>
        </div>
      </header>

      {/* Overview Cards */}
      <div className="overview-grid">
        <div className="overview-card">
          <h3>Total Candidates</h3>
          <div className="overview-value">{candidates.length}</div>
        </div>
        <div className="overview-card">
          <h3>Total Domains</h3>
          <div className="overview-value">{domains.length}</div>
        </div>
        <div className="overview-card">
          <h3>Open Domains</h3>
          <div className="overview-value" style={{ color: 'var(--status-open)' }}>{availableDomains}</div>
        </div>
        <div className="overview-card">
          <h3>Full / Closed</h3>
          <div className="overview-value" style={{ color: 'var(--status-closed)' }}>{fullDomains + closedDomains}</div>
        </div>
        <div className="overview-card" style={{ gridColumn: '1 / -1', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem' }}>
          <div style={{ textAlign: 'left' }}>
            <h3 style={{ margin: 0 }}>Registration Status</h3>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: registrationOpen ? 'var(--status-open)' : 'var(--status-closed)' }}>
              ● {registrationOpen ? 'OPEN' : 'CLOSED'}
            </div>
          </div>
          <button onClick={confirmToggleRegistration} className={registrationOpen ? 'btn-danger' : 'btn-primary'}>
            {registrationOpen ? 'Close Registration' : 'Open Registration'}
          </button>
        </div>
      </div>

      {/* Domain Management */}
      <div className="form-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0 }}>Domain Management</h2>
          <button onClick={() => openDomainModal()} className="btn-primary" style={{ width: 'auto' }}>+ Add Domain</button>
        </div>
        
        {loading && domains.length === 0 ? <p>Loading domains...</p> : domains.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No domains configured. Add your first internship domain to get started.</p>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {domains.map(d => {
              const current = d.currentCount || 0;
              const percent = Math.min((current / d.capacity) * 100, 100);
              const remaining = d.capacity - current;
              return (
                <div key={d.id} className="domain-list-item">
                  <div className="domain-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                      <h4 style={{ margin: 0, fontSize: '1.125rem' }}>{d.name}</h4>
                      <span className={`badge badge-${d.status}`}>{d.status}</span>
                    </div>
                    {d.description && <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{d.description}</p>}
                    
                    <div className="progress-container">
                      <div className={`progress-bar ${d.status === 'full' ? 'full' : ''}`} style={{ width: `${percent}%` }}></div>
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', gap: '1rem' }}>
                      <span>{current} / {d.capacity} registered</span>
                      {remaining > 0 && <span>{remaining} seats remaining</span>}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button onClick={() => openDomainModal(d)} className="btn-secondary">Edit</button>
                    <button onClick={() => confirmToggleStatus(d)} className="btn-secondary">
                      {d.status === 'closed' ? 'Open' : 'Close'}
                    </button>
                    <button onClick={() => confirmDeleteDomain(d)} className="btn-secondary" style={{ color: 'var(--status-closed)', borderColor: 'var(--status-closed)' }}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Candidate Submissions */}
      <div className="form-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ margin: 0 }}>Candidate Submissions</h2>
          <button onClick={exportCSV} className="btn-primary" style={{ width: 'auto' }}>Export CSV ({filteredAndSortedCandidates.length})</button>
        </div>
        
        <div className="filters-bar">
          <input 
            type="text" 
            placeholder="Search candidates..." 
            className="form-input" 
            style={{ width: 'auto', flex: 1, minWidth: '200px' }}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          <select 
            className="form-input" 
            style={{ width: 'auto' }}
            value={domainFilter}
            onChange={e => { setDomainFilter(e.target.value); setPage(1); }}
          >
            <option value="all">All Domains</option>
            {domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select 
            className="form-input" 
            style={{ width: 'auto' }}
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortOption)}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name-asc">Name (A-Z)</option>
          </select>
          {(search || domainFilter !== 'all' || sortBy !== 'newest') && (
            <button onClick={clearFilters} className="btn-secondary">Clear Filters</button>
          )}
        </div>
        
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Candidate ID</th>
                <th>Domain</th>
                <th>Submitted At</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCandidates.map((c, i) => (
                <tr key={i}>
                  <td>{c.name}</td>
                  <td>{c.candidateId}</td>
                  <td>{c.domainName}</td>
                  <td>{new Date(c.timestamp).toLocaleString()}</td>
                </tr>
              ))}
              {paginatedCandidates.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    {candidates.length === 0 ? 'No candidate submissions yet.' : 'No candidates match your search.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {filteredAndSortedCandidates.length > 0 && (
          <div className="pagination">
            <div>
              Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, filteredAndSortedCandidates.length)} of {filteredAndSortedCandidates.length}
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <select className="form-input" style={{ width: 'auto', padding: '0.25rem 0.5rem' }} value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
              <button className="btn-secondary" style={{ padding: '0.25rem 0.75rem' }} disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</button>
              <span>Page {page} of {totalPages}</span>
              <button className="btn-secondary" style={{ padding: '0.25rem 0.75rem' }} disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>

      {/* --- Modals --- */}
      
      {/* Add/Edit Domain Modal */}
      {domainModalOpen && (
        <div className="modal-overlay" onClick={() => setDomainModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingDomain ? 'Edit Domain' : 'Add Domain'}</h2>
              <button className="btn-close" onClick={() => setDomainModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleSaveDomain}>
              <div className="form-group">
                <label className="form-label">Domain Name</label>
                <input name="name" type="text" className="form-input" required defaultValue={editingDomain?.name} />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  name="description" 
                  className="form-input" 
                  maxLength={300}
                  rows={3}
                  placeholder="Briefly describe what candidates will work on in this domain..."
                  defaultValue={editingDomain?.description} 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Capacity</label>
                <input name="capacity" type="number" min="1" className="form-input" required defaultValue={editingDomain?.capacity || ''} />
                {editingDomain && (
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    Current registrations: {editingDomain.currentCount}. Capacity cannot be set lower than this.
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select name="status" className="form-input" defaultValue={editingDomain?.status || 'open'}>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setDomainModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Domain</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generic Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="modal-overlay" onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{confirmModal.title}</h2>
              <button className="btn-close" onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}>&times;</button>
            </div>
            <p style={{ fontSize: '1.125rem' }}>{confirmModal.message}</p>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}>Cancel</button>
              {/* Only show action button if an action exists (some confirms are just alerts) */}
              {confirmModal.title !== 'Cannot Delete' && (
                <button className={confirmModal.isDanger ? 'btn-danger' : 'btn-primary'} onClick={confirmModal.onConfirm}>
                  Confirm
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
