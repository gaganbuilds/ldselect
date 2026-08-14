import React, { useState, useEffect } from 'react';
import type { Domain } from '../services/domainService';
import { domainService } from '../services/domainService';
import { candidateService } from '../services/candidateService';
import { DomainCard } from './DomainCard';

export const CandidatePortal: React.FC = () => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [registrationOpen, setRegistrationOpen] = useState<boolean>(true);
  
  const [name, setName] = useState<string>('');
  const [candidateId, setCandidateId] = useState<string>('');
  const [selectedDomainId, setSelectedDomainId] = useState<string>('');
  
  const [errors, setErrors] = useState<{name?: string; candidateId?: string; domain?: string; submit?: string}>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [fetchedDomains, regRes] = await Promise.all([
          domainService.getDomains(),
          fetch('/api/settings/registration').then(r => r.json())
        ]);
        setDomains(fetchedDomains);
        setRegistrationOpen(regRes.registrationOpen);
      } catch (err) {
        setErrors(prev => ({ ...prev, submit: 'Failed to load domains.' }));
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const validateForm = () => {
    const newErrors: typeof errors = {};
    let isValid = true;

    if (!name.trim()) {
      newErrors.name = 'Full Name is required';
      isValid = false;
    }

    if (!candidateId.trim()) {
      newErrors.candidateId = 'Candidate ID is required';
      isValid = false;
    }

    if (!selectedDomainId) {
      newErrors.domain = 'Please select a domain';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Auto-trim states so the form UI reflects the clean data
    setName(name.trim());
    setCandidateId(candidateId.trim());

    if (!validateForm()) return;
    
    const selectedDomain = domains.find(d => d.id === selectedDomainId);
    if (!selectedDomain) {
      setErrors({ submit: 'Selected domain not found.' });
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      await candidateService.submitSelection(
        { name: name.trim(), candidateId: candidateId.trim(), domainId: selectedDomainId }
      );
      setIsSubmitted(true);
    } catch (err: any) {
      setErrors({ submit: err.message || 'Failed to submit selection.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    const selectedDomain = domains.find(d => d.id === selectedDomainId);
    return (
      <div className="container">
        <header className="header">
          <h1>ML Internship — Track 2</h1>
          <p>Phase 2 Selection System</p>
        </header>
        
        <div className="confirmation-box">
          <h2>Selection Confirmed</h2>
          <p>Your ML domain selection has been recorded for this session.</p>
          
          <div className="confirmation-details">
            <p><strong>Candidate:</strong> {name.trim()}</p>
            <p><strong>Candidate ID:</strong> {candidateId.trim()}</p>
            <p><strong>Domain:</strong> {selectedDomain?.name}</p>
          </div>
          
          <p>Your selected domain will be used for the next stage of the internship.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <h1>ML Internship — Track 2</h1>
        <p>Choose the ML domain you want to work in. Your selection will determine the project direction for the next stage of your internship.</p>
      </header>
      
      {!loading && !registrationOpen && (
        <div className="error-text" style={{ backgroundColor: '#fee2e2', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', textAlign: 'center', color: '#b91c1c', fontSize: '1.125rem' }}>
          <strong>Registration Closed</strong>
          <br/>Domain selection is currently unavailable.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <div className="form-group">
            <label className="form-label" htmlFor="name">Full Name</label>
            <input 
              type="text" 
              id="name" 
              className="form-input" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Enter your full name"
              disabled={isSubmitting || !registrationOpen}
            />
            {errors.name && <div className="error-text">{errors.name}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="candidateId">Candidate ID</label>
            <input 
              type="text" 
              id="candidateId" 
              className="form-input" 
              value={candidateId} 
              onChange={(e) => setCandidateId(e.target.value)} 
              placeholder="e.g. CAND-12345"
              disabled={isSubmitting || !registrationOpen}
            />
            {errors.candidateId && <div className="error-text">{errors.candidateId}</div>}
          </div>
        </div>

        <div className="domain-section">
          <h2 className="domain-section-title">Select Your Domain</h2>
          {errors.domain && <div className="error-text" style={{marginBottom: '1rem'}}>{errors.domain}</div>}
          
          {loading ? (
            <p>Loading domains...</p>
          ) : domains.length === 0 ? (
            <p>No domains available at this time.</p>
          ) : (
            <div className="domain-grid">
              {domains.map(domain => (
                <DomainCard 
                  key={domain.id} 
                  domain={domain} 
                  isSelected={selectedDomainId === domain.id} 
                  onSelect={(id) => registrationOpen && setSelectedDomainId(id)} 
                />
              ))}
            </div>
          )}
        </div>

        {errors.submit && <div className="error-text" style={{marginBottom: '1rem', textAlign: 'center', fontSize: '1.125rem', fontWeight: 600}}>{errors.submit}</div>}

        <button 
          type="submit" 
          className="btn-submit" 
          disabled={isSubmitting || loading || domains.length === 0 || !registrationOpen}
        >
          {isSubmitting ? 'Submitting...' : 'Confirm Selection'}
        </button>
      </form>
    </div>
  );
};
