import React from 'react';
import type { Domain } from '../services/domainService';

interface DomainCardProps {
  domain: Domain;
  isSelected: boolean;
  onSelect: (domainId: string) => void;
}

export const DomainCard: React.FC<DomainCardProps> = ({ domain, isSelected, onSelect }) => {
  const isDisabled = domain.status !== 'open';

  const handleClick = () => {
    if (!isDisabled) {
      onSelect(domain.id);
    }
  };

  const getStatusText = () => {
    switch (domain.status) {
      case 'open':
        return 'Available';
      case 'full':
        return 'Full';
      case 'closed':
        return 'Closed';
      default:
        return 'Unknown';
    }
  };

  return (
    <div 
      className={`domain-card ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-pressed={isSelected}
      aria-disabled={isDisabled}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="domain-card-header">
        <h3 className="domain-title">{domain.name}</h3>
        {isSelected && (
          <span className="selection-indicator">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </span>
        )}
      </div>
      
      {domain.description && (
        <p className="domain-desc">{domain.description}</p>
      )}
      
      <div className="domain-footer">
        <div className={`status-indicator status-${domain.status}`}>
          <span className="status-dot"></span>
          <span className="status-text">{getStatusText()}</span>
        </div>
        
        {(domain.status === 'open' || domain.status === 'full') && (
          <div className="capacity-text">
            {domain.currentCount} / {domain.capacity} slots filled
          </div>
        )}
      </div>
    </div>
  );
};
