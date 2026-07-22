# SQL Vizon - AI-Powered SQL Lineage & Diagram Visualizer

**SQL Vizon** is an enterprise-grade Business Intelligence and Data Engineering tool designed to automatically parse SQL queries into interactive, node-based data lineage diagrams. Built with React 19, React Flow, Express, and Google Gemini AI, SQL Vizon helps data engineers, BI analysts, and developers visualize table relationships, column dependencies, subqueries, and diagram version histories seamlessly.

---

## 🌟 Key Features

- **🤖 AI-Driven SQL Lineage Parsing**: Uses Google Gemini AI to analyze complex SQL queries (JOINs, Subqueries, CTEs, Aggregations) and generate structured lineage graphs.
- **🎨 Interactive Canvas (React Flow)**: Drag and drop tables, zoom, pan, and interact with nodes and relationship edges in real-time.
- **✨ Cross-Table Column Highlighting**: Hover over any table or column name in the canvas or metadata panel to highlight parent/child table connections and matching columns across the entire lineage graph.
- **📚 Query Catalog & Management**: Search, filter, clone, edit, and organize SQL queries by datasource type and tags.
- **🕒 Version Control & Timeline**: Save and restore diagram versions, track AI prompts used for diagram generation, and set active diagram states.
- **🖼️ High-Resolution Vector & Image Exports**: Export complete lineage diagrams as crisp **SVG** vectors or **PNG** images with automatic bounding-box calculation and fill-injected styling for clear edge labels.
- **⚡ Built-in SQL Editor & Generator**: Feature-rich SQL editor with line numbers, syntax highlighting, and natural language to SQL generation powered by Gemini AI.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend Framework** | React 19 + TypeScript + Vite |
| **Canvas & Diagrams** | React Flow (`reactflow` v11) |
| **Styling & UI** | Tailwind CSS v4 + Lucide React |
| **Export Engine** | `html-to-image` (SVG & PNG rendering) |
| **Backend Server** | Node.js + Express + `tsx` / `esbuild` |
| **Database** | SQLite via `sql.js` (In-memory + filesystem persistence) |
| **AI Integration** | Google Gen AI SDK (`@google/genai`) |

---

## 🚀 Quick Start

### 1. Prerequisites

- **Node.js**: v18.x or later
- **npm**: v9.x or later
- **Gemini API Key**: Required for AI lineage parsing and SQL query generation.

### 2. Environment Configuration

Create a `.env` file in the root directory (or copy from `.env.example`):

```env
# Server Port (Default: 3000)
PORT=3000

# Google Gemini API Key for SQL parsing & AI generation
GEMINI_API_KEY=your_gemini_api_key_here

# Environment Mode
NODE_ENV=development
```

### 3. Installation & Running

```bash
# Install dependencies
npm install

# Start development server (Express + Vite hot-reload on port 3000)
npm run dev
```

Open your browser at `http://localhost:3000`.

### 4. Production Build & Execution

```bash
# Compile frontend assets and bundle backend server into dist/server.cjs
npm run build

# Start production Node.js server
npm start
```

---

## 📂 Project Directory Structure

```
sql-vizon/
├── database.sqlite            # Local SQLite database file (auto-created)
├── server.ts                  # Express API server + SQLite + Gemini AI service
├── src/
│   ├── App.tsx                # Main layout and global state orchestration
│   ├── main.tsx               # Client entry point
│   ├── types.ts               # Global TypeScript definitions & interfaces
│   ├── components/
│   │   ├── Diagram.tsx        # React Flow canvas, node drag handler & SVG/PNG exports
│   │   ├── Editor.tsx         # SQL code editor & AI query prompt generator
│   │   ├── Sidebar.tsx        # Catalog drawer, search, clone & delete confirmation
│   │   ├── VersionPanel.tsx   # Diagram version history & activation control
│   │   └── MetadataPanel.tsx  # Datasource type selector & key-value tags
│   └── lib/
│       └── api.ts             # REST API client wrapper
├── package.json
└── README.md
```

---

## 📖 Feature Guide

### 1. Visualizing SQL Lineage
1. Click **Catalog** in the left sidebar to select an existing query or click **New Query**.
2. Paste or write your SQL code into the **SQL Editor**.
3. Click **Analyze Lineage**. The server communicates with Google Gemini AI to analyze table joins, sources, and subquery relationships and renders a lineage diagram in the canvas.

### 2. Interactive Column Tracking
- Hover over any column inside a table node on the canvas.
- Matching columns in upstream and downstream tables will instantly highlight in amber with animated edge strokes.

### 3. Exporting Diagrams
- **Export SVG**: Generates a scalable vector graphic (`.svg`) representing the full canvas content regardless of current screen zoom.
- **Export PNG**: Generates a high-definition image (`.png`) formatted with clean white backgrounds and high-contrast labels.
- **Export Config / Edit JSON**: View and edit the raw JSON node and edge graph configuration directly.

---

## 📄 Documentation

For deep technical details, backend endpoint documentation, state architecture, and a step-by-step developer guide on **switching from SQLite to PostgreSQL**, please consult **[DEVELOPER.md](./DEVELOPER.md)**.
