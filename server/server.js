import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from server/.env if present
dotenv.config({ path: path.join(process.cwd(), 'server', '.env') });

const app = express();
app.use(cors());
app.use(express.json());

const DB_FILE = path.join(process.cwd(), 'server', 'database.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

// --- SCHEMA INITIALIZATION ---
// Initialize the database file if it doesn't exist
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({
    domains: [],
    candidates: [],
    settings: {
      registrationOpen: 'true'
    }
  }, null, 2));
}

// Helper functions for synchronous, atomic file operations
// In Node.js, synchronous execution blocks the event loop, acting as a lock
// which perfectly prevents race conditions for our 110+ user scale.
const readDb = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
const writeDb = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// --- MIDDLEWARE ---
const requireAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader === 'Bearer secret-admin-token') {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// --- CANDIDATE API ---

app.get('/api/domains', (req, res) => {
  try {
    const db = readDb();
    const domains = db.domains.map(d => {
      const currentCount = db.candidates.filter(c => c.domainId === d.id).length;
      let status = d.status;
      if (status === 'open' && currentCount >= d.capacity) {
        status = 'full';
      }
      return { ...d, currentCount, status };
    });
    res.json(domains);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/candidates', (req, res) => {
  const { name, candidateId, domainId } = req.body;

  if (!name || !candidateId || !domainId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const db = readDb();
    
    // 1. Check if registration is open
    if (db.settings.registrationOpen !== 'true') {
      return res.status(400).json({ error: 'Domain selection is currently closed.' });
    }

    // 2. Check if candidateId already exists
    if (db.candidates.some(c => c.candidateId === candidateId)) {
      return res.status(400).json({ error: 'This Candidate ID has already submitted a domain selection.' });
    }

    // 3. Check domain status and capacity
    const domain = db.domains.find(d => d.id === domainId);
    if (!domain) {
      return res.status(400).json({ error: 'Selected domain not found.' });
    }
    if (domain.status === 'closed') {
      return res.status(400).json({ error: 'This domain is currently unavailable.' });
    }

    const currentCount = db.candidates.filter(c => c.domainId === domainId).length;
    if (currentCount >= domain.capacity) {
      return res.status(400).json({ error: 'This domain has just reached its capacity. Please choose another available domain.' });
    }

    // 4. Save submission
    db.candidates.push({
      id: Date.now().toString(),
      name,
      candidateId,
      domainId,
      timestamp: new Date().toISOString()
    });
    
    writeDb(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/settings/registration', (req, res) => {
  const db = readDb();
  res.json({ registrationOpen: db.settings.registrationOpen === 'true' });
});

// --- ADMIN API ---

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ token: 'secret-admin-token' });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.get('/api/settings', requireAdmin, (req, res) => {
  const db = readDb();
  res.json({ registrationOpen: db.settings.registrationOpen === 'true' });
});

app.put('/api/settings', requireAdmin, (req, res) => {
  const { registrationOpen } = req.body;
  if (registrationOpen !== undefined) {
    const db = readDb();
    db.settings.registrationOpen = registrationOpen ? 'true' : 'false';
    writeDb(db);
  }
  res.json({ success: true });
});

app.post('/api/domains', requireAdmin, (req, res) => {
  const { id, name, description, capacity, status } = req.body;
  try {
    const db = readDb();
    db.domains.push({
      id,
      name,
      description: description || '',
      capacity: parseInt(capacity, 10),
      status: status || 'open',
      createdAt: new Date().toISOString()
    });
    writeDb(db);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Failed to create domain' });
  }
});

app.put('/api/domains/:id', requireAdmin, (req, res) => {
  const { name, description, capacity, status } = req.body;
  try {
    const db = readDb();
    const idx = db.domains.findIndex(d => d.id === req.params.id);
    if (idx !== -1) {
      db.domains[idx] = {
        ...db.domains[idx],
        name,
        description: description || '',
        capacity: parseInt(capacity, 10),
        status
      };
      writeDb(db);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  } catch (error) {
    res.status(400).json({ error: 'Failed to update domain' });
  }
});

app.delete('/api/domains/:id', requireAdmin, (req, res) => {
  const domainId = req.params.id;
  try {
    const db = readDb();
    const count = db.candidates.filter(c => c.domainId === domainId).length;
    if (count > 0) {
      return res.status(400).json({ error: 'This domain has registered candidates and cannot be deleted. Close it instead.' });
    }
    db.domains = db.domains.filter(d => d.id !== domainId);
    writeDb(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete domain' });
  }
});

app.get('/api/candidates', requireAdmin, (req, res) => {
  try {
    const db = readDb();
    const candidates = db.candidates.map(c => {
      const domain = db.domains.find(d => d.id === c.domainId);
      return {
        ...c,
        domainName: domain ? domain.name : 'Unknown'
      };
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json(candidates);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
