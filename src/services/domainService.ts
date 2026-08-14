export type DomainStatus = 'open' | 'full' | 'closed';

export interface Domain {
  id: string;
  name: string;
  description: string;
  capacity: number;
  currentCount: number;
  status: DomainStatus;
}

export const domainService = {
  async getDomains(): Promise<Domain[]> {
    const res = await fetch('/api/domains');
    if (!res.ok) {
      throw new Error('Unable to connect to the selection system. Please try again.');
    }
    return res.json();
  }
};
