/**
	Project: SQL Vizion
	Author: Nishanth
	Version: 1.0.0
	License: MIT
**/
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { GoogleGenAI } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;
const DB_PATH = path.join(process.cwd(), 'database.sqlite');

let db: SqlJsDatabase;

function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

async function initDatabase() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const filebuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(filebuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS queries (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    sql_text TEXT NOT NULL,
    datasource_type TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS diagram_versions (
    id TEXT PRIMARY KEY,
    query_id TEXT NOT NULL,
    json_config TEXT NOT NULL,
    is_active INTEGER DEFAULT 0,
    prompt_used TEXT,
    version_number INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );`);

  saveDb();
}

// Helpers for sql.js
function run(sql: string, params: any[] = []) {
  db.run(sql, params);
  saveDb();
}

function all(sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function get(sql: string, params: any[] = []): any | null {
  const rows = all(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

app.use(express.json());

// --- API Routes ---

// Projects
app.get('/api/projects', (req, res) => {
  try {
    const projects = all('SELECT * FROM projects ORDER BY created_at DESC');
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/projects', (req, res) => {
  const { name } = req.body;
  const id = uuidv4();
  try {
    run('INSERT INTO projects (id, name) VALUES (?, ?)', [id, name]);
    res.json({ id, name });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Queries
app.get('/api/queries', (req, res) => {
  const { projectId, search } = req.query;
  let sql = 'SELECT * FROM queries WHERE 1=1';
  const params: any[] = [];
  
  if (projectId) {
    sql += ' AND project_id = ?';
    params.push(projectId);
  }
  if (search) {
    sql += ' AND (name LIKE ? OR sql_text LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  
  sql += ' ORDER BY updated_at DESC';
  
  try {
    const queries = all(sql, params);
    res.json(queries);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/queries/:id', (req, res) => {
  try {
    const query = get('SELECT * FROM queries WHERE id = ?', [req.params.id]);
    if (!query) return res.status(404).json({ error: 'Query not found' });
    res.json(query);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/queries', (req, res) => {
  const { projectId, name, description, sqlText, datasourceType, metadata } = req.body;
  const id = uuidv4();
  try {
    run(
      'INSERT INTO queries (id, project_id, name, description, sql_text, datasource_type, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, projectId || null, name, description || '', sqlText, datasourceType || 'SQL Query', JSON.stringify(metadata || {})]
    );
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/queries/:id', (req, res) => {
  const { name, description, sqlText, datasourceType, metadata } = req.body;
  try {
    run(
      'UPDATE queries SET name = ?, description = ?, sql_text = ?, datasource_type = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, description, sqlText, datasourceType, JSON.stringify(metadata || {}), req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/queries/:id', (req, res) => {
  try {
    run('DELETE FROM diagram_versions WHERE query_id = ?', [req.params.id]);
    run('DELETE FROM queries WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/queries/:id/clone', (req, res) => {
  try {
    const query = get('SELECT * FROM queries WHERE id = ?', [req.params.id]);
    if (!query) return res.status(404).json({ error: 'Query not found' });
    
    const newId = uuidv4();
    run(
      'INSERT INTO queries (id, project_id, name, description, sql_text, datasource_type, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [newId, query.project_id, `${query.name} (Copy)`, query.description, query.sql_text, query.datasource_type, query.metadata]
    );
    
    // Also clone active version
    const activeVersion = get('SELECT * FROM diagram_versions WHERE query_id = ? AND is_active = 1', [req.params.id]);
    if (activeVersion) {
      run(
        'INSERT INTO diagram_versions (id, query_id, json_config, is_active, prompt_used, version_number) VALUES (?, ?, ?, 1, ?, 1)',
        [uuidv4(), newId, activeVersion.json_config, 'Cloned from original']
      );
    }
    
    res.json({ id: newId });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Diagram Versions
app.get('/api/queries/:id/versions', (req, res) => {
  try {
    const versions = all('SELECT * FROM diagram_versions WHERE query_id = ? ORDER BY version_number DESC', [req.params.id]);
    res.json(versions);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/queries/:id/versions', (req, res) => {
  const { jsonConfig, promptUsed } = req.body;
  const queryId = req.params.id;
  try {
    const lastVersion = get('SELECT MAX(version_number) as maxV FROM diagram_versions WHERE query_id = ?', [queryId]);
    const nextV = ((lastVersion && lastVersion.maxV) ? Number(lastVersion.maxV) : 0) + 1;
    const id = uuidv4();
    
    // Set all others to inactive
    run('UPDATE diagram_versions SET is_active = 0 WHERE query_id = ?', [queryId]);
    
    run(
      'INSERT INTO diagram_versions (id, query_id, json_config, is_active, prompt_used, version_number) VALUES (?, ?, ?, 1, ?, ?)',
      [id, queryId, jsonConfig, promptUsed || '', nextV]
    );
    res.json({ id, versionNumber: nextV });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/queries/:id/versions/:versionId/activate', (req, res) => {
  try {
    run('UPDATE diagram_versions SET is_active = 0 WHERE query_id = ?', [req.params.id]);
    run('UPDATE diagram_versions SET is_active = 1 WHERE id = ?', [req.params.versionId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/versions/:versionId', (req, res) => {
  const { jsonConfig } = req.body;
  try {
    run('UPDATE diagram_versions SET json_config = ? WHERE id = ?', [jsonConfig, req.params.versionId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- AI Service ---
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

app.post('/api/ai/parse-sql', async (req, res) => {
  const { sql, prompt: userPrompt } = req.body;
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY missing' });

  try {
    const systemPrompt = `You are a SQL lineage expert. Parse the following SQL and output a JSON representation of its data lineage diagram.
Format:
{
  "nodes": [{ "id": "table1", "type": "table", "data": { "label": "users", "columns": ["id", "name"] }, "position": { "x": 0, "y": 0 } }],
  "edges": [{ "id": "e1", "source": "table1", "target": "table2", "label": "JOIN on id" }]
}
Types: "table", "subquery", "source".
Positioning should be logical (left-to-right).
Output ONLY the raw JSON. No markdown blocks.`;

    const combinedPrompt = userPrompt 
      ? `${systemPrompt}\n\nSQL: ${sql}\n\nUser Instruction: ${userPrompt}`
      : `${systemPrompt}\n\nSQL: ${sql}`;

    const response = await genAI.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: combinedPrompt,
    });
    const text = response.text || '';
    // Clean potential markdown code blocks
    const cleanedJson = text.replace(/```json|```/g, '').trim();
    res.json(JSON.parse(cleanedJson));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/ai/generate-sql', async (req, res) => {
  const { prompt } = req.body;
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY missing' });

  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: `Generate a SQL query based on this description: ${prompt}. Output ONLY the SQL query. No markdown blocks.`,
    });
    const text = response.text || '';
    res.json({ sql: text.replace(/```sql|```/g, '').trim() });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- Server Setup ---

async function startServer() {
  await initDatabase();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
