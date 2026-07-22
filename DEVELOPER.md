# SQL Vizon - Developer Architecture & Maintenance Guide

Welcome to the **SQL Vizon** developer documentation. This guide provides a comprehensive technical overview of the application's architecture, backend API endpoints, AI parsing pipeline, React Flow canvas mechanics, state management, and step-by-step instructions for extending or refactoring core infrastructure (such as migrating from SQLite to PostgreSQL).

---

## 📋 Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Layer & Migration Guide (SQLite to PostgreSQL)](#2-database-layer--migration-guide-sqlite-to-postgresql)
3. [Backend REST API Specification](#3-backend-rest-api-specification)
4. [AI Lineage Analysis Engine](#4-ai-lineage-analysis-engine)
5. [Frontend React Flow Canvas Architecture](#5-frontend-react-flow-canvas-architecture)
6. [State Management & Catalog Workflows](#6-state-management--catalog-workflows)
7. [Build & Deployment System](#7-build--deployment-system)

---

## 1. Architecture Overview

SQL Vizon uses a unified, single-process Express + Vite architecture running on **Node.js**:

```
                  ┌──────────────────────────────────────────────┐
                  │          Browser / React 19 Frontend         │
                  │  (React Flow Canvas, Monocle Editor, Hooks)  │
                  └──────────────────────┬───────────────────────┘
                                         │
                                   REST API Calls
                                         │
                  ┌──────────────────────▼───────────────────────┐
                  │            Express.js Server (Port 3000)      │
                  │  (/api/queries, /api/versions, /api/ai/*)    │
                  └──────────┬────────────────────────┬──────────┘
                             │                        │
            ┌────────────────▼───────────────┐  ┌─────▼──────────────────────┐
            │   Google Gemini API Client     │  │   Database Layer (sql.js)  │
            │   (@google/genai SDK)          │  │   database.sqlite File     │
            └────────────────────────────────┘  └────────────────────────────┘
```

- **Development Mode**: `tsx server.ts` starts Express and attaches Vite's development middleware (`app.use(vite.middlewares)`), providing instant HMR and dynamic client compilation on port 3000.
- **Production Mode**: `npm run build` compiles Vite assets to `/dist` and uses `esbuild` to bundle `server.ts` into CommonJS (`dist/server.cjs`). `node dist/server.cjs` serves static assets alongside REST endpoints.

---

## 2. Database Layer & Migration Guide (SQLite to PostgreSQL)

### Current Setup: `sql.js` (SQLite)
The application currently uses `sql.js` (a WebAssembly compiled version of SQLite) running in Node.js, persisted to a disk file at `./database.sqlite`.

#### Database Schema (`database.sqlite`)

```sql
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS queries (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  sql_text TEXT NOT NULL,
  datasource_type TEXT,
  metadata TEXT, -- JSON stringified key-value object
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS diagram_versions (
  id TEXT PRIMARY KEY,
  query_id TEXT NOT NULL,
  json_config TEXT NOT NULL,
  is_active INTEGER DEFAULT 0,
  prompt_used TEXT,
  version_number INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

### 🔄 How to Switch from SQLite (`sql.js`) to PostgreSQL / Cloud SQL / Supabase / Neon

If you want to migrate SQL Vizon to use a real relational PostgreSQL database (or Google Cloud SQL, Supabase, Neon, AWS RDS), follow these exact step-by-step instructions.

#### Step 1: File Locations
All database initialization, schema creation, and execution helpers are centralized in:
- **`server.ts`** (Lines 14–87)

#### Step 2: Update Package Dependencies
Remove `sql.js` and install the node PostgreSQL driver (`pg`):

```bash
npm remove sql.js @types/sql.js
npm install pg
npm install --save-dev @types/pg
```

#### Step 3: Configure Environment Variables
Update `.env` and `.env.example` with PostgreSQL connection settings:

```env
# Database Connection
DATABASE_URL=postgres://user:password@localhost:5432/sqlvizon
# OR individual parameters:
PGHOST=localhost
PGUSER=postgres
PGPASSWORD=yourpassword
PGDATABASE=sqlvizon
PGPORT=5432
```

#### Step 4: Schema Translation (SQLite -> PostgreSQL DDL)

| SQLite Dialect | PostgreSQL Equivalent |
| :--- | :--- |
| `id TEXT PRIMARY KEY` | `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` |
| `DATETIME DEFAULT CURRENT_TIMESTAMP` | `TIMESTAMPTZ DEFAULT NOW()` |
| `is_active INTEGER DEFAULT 0` | `is_active BOOLEAN DEFAULT FALSE` |
| `metadata TEXT` | `metadata JSONB DEFAULT '{}'::jsonb` |

PostgreSQL Schema:

```sql
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  sql_text TEXT NOT NULL,
  datasource_type TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS diagram_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id UUID NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
  json_config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  prompt_used TEXT,
  version_number INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Step 5: Replace Query Syntax & Execution Logic in `server.ts`

1. **Parameter Placeholder Conversion**: Change SQLite `?` placeholders to PostgreSQL `$1, $2, $3`.
2. **Async Conversion**: Change synchronous helper functions `run()`, `all()`, and `get()` to `async/await` using `pg.Pool`.

#### Before & After Code Snippet (`server.ts`)

**BEFORE (`sql.js` / SQLite):**
```typescript
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';

let db: SqlJsDatabase;

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

// Endpoint usage
app.get('/api/queries', (req, res) => {
  const queries = all('SELECT * FROM queries WHERE project_id = ?', [projectId]);
  res.json(queries);
});
```

**AFTER (PostgreSQL with `pg` Pool):**
```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function query(text: string, params?: any[]) {
  return await pool.query(text, params);
}

// Endpoint usage (Converted to async handlers & $1 parameters)
app.get('/api/queries', async (req, res) => {
  try {
    const { projectId } = req.query;
    const { rows } = await query('SELECT * FROM queries WHERE project_id = $1 ORDER BY updated_at DESC', [projectId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
```

---

## 3. Backend REST API Specification

All backend API routes are registered in `server.ts`.

### Projects API
- **`GET /api/projects`**: Returns all projects ordered by creation date.
- **`POST /api/projects`**: Creates a new project folder.
  - *Body*: `{ "name": "Marketing Data Warehouse" }`

### Queries Catalog API
- **`GET /api/queries?projectId=&search=`**: List queries filtered by optional project ID or text search across query name/SQL.
- **`GET /api/queries/:id`**: Fetch a single query object by ID.
- **`POST /api/queries`**: Save a new SQL query into the catalog.
  - *Body*: `{ "projectId": "...", "name": "Monthly Active Users", "description": "...", "sqlText": "SELECT...", "datasourceType": "Snowflake", "metadata": {} }`
- **`PUT /api/queries/:id`**: Update query name, description, SQL text, or metadata tags.
- **`DELETE /api/queries/:id`**: Deletes the query and all associated diagram version records from the database.
- **`POST /api/queries/:id/clone`**: Clones a query and duplicates its currently active diagram version.

### Diagram Versions API
- **`GET /api/queries/:id/versions`**: Returns version history for a query ordered by `version_number DESC`.
- **`POST /api/queries/:id/versions`**: Creates a new version snapshot, automatically incrementing `version_number` and marking it active.
  - *Body*: `{ "jsonConfig": "{ \"nodes\": [...], \"edges\": [...] }", "promptUsed": "Refactored CTE layout" }`
- **`PUT /api/queries/:id/versions/:versionId/activate`**: Sets specified version as active (`is_active = 1`) and deactivates all others.
- **`PUT /api/versions/:versionId`**: Saves layout position changes (dragged table nodes) to the specified version record.

### AI Services API
- **`POST /api/ai/parse-sql`**: Analyzes raw SQL and generates node/edge diagram JSON.
  - *Body*: `{ "sql": "SELECT u.id, p.total FROM users u JOIN purchases p ON u.id = p.user_id", "prompt": "Optional user tweak instruction" }`
- **`POST /api/ai/generate-sql`**: Generates SQL text from natural language description.
  - *Body*: `{ "prompt": "Calculate monthly rolling retention by cohort" }`

---

## 4. AI Lineage Analysis Engine

The lineage engine leverages the Google Gen AI SDK (`@google/genai`) in `server.ts`:

```typescript
import { GoogleGenAI } from '@google/genai';
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
```

### Parsing Workflow:
1. **System Prompt Formulation**: Instructs `gemini-3.5-flash` to output strict JSON conforming to the `LineageConfig` schema (`nodes` and `edges`).
2. **Node Classification**: Categorizes entities into `'table'`, `'subquery'`, or `'source'`.
3. **Markdown Sanitization**: Strip potential markdown ticks (` ```json ... ``` `) before calling `JSON.parse()`.
4. **Error Handling**: Graceful fallback error responses if the model returns malformed JSON or if the API key is missing.

---

## 5. Frontend React Flow Canvas Architecture

The diagram canvas is implemented in `src/components/Diagram.tsx` using **React Flow** (`reactflow` v11) wrapped in a `ReactFlowProvider`.

### Node State Protection During Drag & Drop
To prevent nodes from disappearing when a user drags a table on the canvas:
- `handleNodeDragStop` utilizes `useReactFlow().getNodes()` to inspect the complete array of active nodes in React Flow state before emitting the updated config callback `onConfigChange`.

```typescript
const handleNodeDragStop = useCallback(() => {
  const currentNodes = getNodes();
  const updatedNodesConfig = currentNodes.map(n => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: {
      label: n.data?.label,
      type: n.data?.type,
      columns: n.data?.columns,
    }
  }));

  onConfigChange({ ...safeConfig, nodes: updatedNodesConfig });
}, [safeConfig, getNodes, onConfigChange]);
```

### Cross-Table Column Highlighting
- When a user hovers over a table or column item, the state `hoveredItem` (`{ type: 'column' | 'table', name: string, tableName?: string }`) is passed down to every `TableNode`.
- Edge highlighting logic automatically matches edge sources/targets to active node columns, animating connected edges with an amber stroke (`#f59e0b`).

### SVG & PNG Export System (`html-to-image`)
Exporting vector diagrams from an interactive React Flow canvas requires handling SVG DOM styling quirks:
1. **SVG Path Inline Injection**: `html-to-image` can default SVG edge paths to black filled polygons if explicit `fill: none` inline styles are omitted. `Diagram.tsx` iterates through viewport SVG elements before capture to explicitly apply:
   - `fill: none` and `stroke: #cbd5e1` on edge paths.
   - `fill: #0f172a` on text labels.
   - `fill: #ffffff` and `stroke: #cbd5e1` on text background rects.
2. **Bounding Box Snapshot Calculation**: Uses `getNodesBounds(nodes)` and `getViewportForBounds()` to calculate exact diagram bounds plus 80px padding, ensuring exports render the entire diagram regardless of the user's current zoom or scroll position.

---

## 6. State Management & Catalog Workflows

Application state is orchestrated at the top level in `src/App.tsx`:

- **`selectedQuery`**: Currently active query from catalog.
- **`lineageConfig`**: Current JSON node and edge graph.
- **`versions` & `activeVersionId`**: Version array for the selected query.
- **`hoveredItem`**: Cross-component hover highlight state shared between `Diagram.tsx`, `Editor.tsx`, and `MetadataPanel.tsx`.

### Two-Step Delete Workflow in Catalog (`Sidebar.tsx`)
When deleting a query:
1. User clicks the Trash icon next to a query item.
2. The item replaces its row with an inline confirmation bar (**Delete** / **Cancel**).
3. Confirming removes the item immediately from client state (`setQueries`) and dispatches `api.deleteQuery(id)` asynchronously to clean up database records without full page reloads.

---

## 7. Build & Deployment System

### Scripts (`package.json`)
- **`npm run dev`**: Launches backend Express server via `tsx` on port 3000 with Vite middleware attached.
- **`npm run build`**: Runs `vite build` to output client bundles, followed by `esbuild server.ts` to output `dist/server.cjs`.
- **`npm start`**: Runs `node dist/server.cjs` in production mode.
- **`npm run lint`**: Runs `tsc --noEmit` to verify type safety across frontend and backend codebases.

---

## 🧰 Developer Quick Reference Checklist

- [ ] Need to add a new column to queries? Update `server.ts` schema initialization and `src/types.ts` `Query` interface.
- [ ] Need to change AI model? Modify `model: 'gemini-3.5-flash'` in `server.ts`.
- [ ] Need to adjust canvas styles? Edit custom `TableNode` in `src/components/Diagram.tsx`.
- [ ] Need to migrate DB to Postgres? Follow Section 2 of this guide.
