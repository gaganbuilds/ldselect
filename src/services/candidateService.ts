

export interface CandidateSelection {
  name: string;
  candidateId: string;
  domainId: string;
}

export const candidateService = {
  async submitSelection(selection: CandidateSelection): Promise<boolean> {
    const res = await fetch('/api/candidates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(selection)
    });

    if (!res.ok) {
      let errorMessage = 'Unable to connect to the selection system. Please try again.';
      try {
        const errorData = await res.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {
        // ignore
      }
      throw new Error(errorMessage);
    }

    return true;
  }
};
