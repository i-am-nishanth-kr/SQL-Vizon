import React, { useState, useMemo, useCallback } from 'react';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-sql';
import 'prismjs/themes/prism.css';
import { Play, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { LineageConfig, HoveredItem } from '../types';
import { resolveHighlights } from '../lib/lineage';

interface SqlEditorProps {
  sql: string;
  onChange: (sql: string) => void;
  onSave: () => void;
  onAnalyze: () => void;
  loading?: boolean;
  lineageConfig?: LineageConfig;
  hoveredItem?: HoveredItem | null;
  onHoverItem?: (item: HoveredItem | null) => void;
  selectedItem?: HoveredItem | null;
  onSelectItem?: (item: HoveredItem | null) => void;
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightSqlWithTokens(
  code: string,
  knownTables: string[],
  knownColumns: string[],
  hoveredItem: HoveredItem | null | undefined,
  lineageConfig: LineageConfig | undefined
) {
  const prismHtml = highlight(code, languages.sql, 'sql');
  const resolved = resolveHighlights(lineageConfig, hoveredItem);

  const tableSet = new Set(knownTables.map(t => t.toLowerCase()));
  const columnSet = new Set(knownColumns.map(c => c.toLowerCase()));

  if (hoveredItem?.name) {
    if (hoveredItem.type === 'table') tableSet.add(hoveredItem.name.toLowerCase());
    if (hoveredItem.type === 'column') columnSet.add(hoveredItem.name.toLowerCase());
  }

  // Ensure resolved column & table names are present in candidates
  resolved.columnNames.forEach(c => columnSet.add(c));
  resolved.tableNames.forEach(t => tableSet.add(t));

  if (tableSet.size === 0 && columnSet.size === 0) {
    return prismHtml;
  }

  const candidates: { name: string; type: 'table' | 'column' }[] = [];
  tableSet.forEach(t => candidates.push({ name: t, type: 'table' }));
  columnSet.forEach(c => candidates.push({ name: c, type: 'column' }));
  candidates.sort((a, b) => b.name.length - a.name.length);

  const parts = prismHtml.split(/(<[^>]+>)/g);
  const pattern = new RegExp(`\\b(${candidates.map(c => escapeRegExp(c.name)).join('|')})\\b`, 'gi');

  const hName = hoveredItem?.name?.toLowerCase();

  for (let i = 0; i < parts.length; i++) {
    if (parts[i] && !parts[i].startsWith('<')) {
      parts[i] = parts[i].replace(pattern, (match) => {
        const lower = match.toLowerCase();
        const cand = candidates.find(c => c.name.toLowerCase() === lower);
        const itemType = cand ? cand.type : 'column';

        const isHovered = itemType === 'table'
          ? resolved.tableNames.has(lower)
          : (resolved.columnNames.has(lower) || (hName && hName === lower));

        const highlightClass = isHovered
          ? "bg-amber-300 text-amber-950 font-extrabold px-1 py-0.5 rounded-xs ring-2 ring-amber-400"
          : "hover:bg-amber-100 hover:text-amber-900 rounded-xs transition-colors cursor-pointer text-blue-700 font-semibold";

        return `<span class="sql-hover-token ${highlightClass}" data-token-type="${itemType}" data-token-name="${match}">${match}</span>`;
      });
    }
  }

  return parts.join('');
}

export default function SqlEditor({ 
  sql, 
  onChange, 
  onSave, 
  onAnalyze, 
  loading,
  lineageConfig,
  hoveredItem,
  onHoverItem,
  selectedItem,
  onSelectItem
}: SqlEditorProps) {
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);

  // Extract table and column names from lineageConfig and SQL text
  const { knownTables, knownColumns } = useMemo(() => {
    const tables: string[] = [];
    const columns: string[] = [];

    if (lineageConfig?.nodes) {
      lineageConfig.nodes.forEach(node => {
        if (node.data?.label) tables.push(node.data.label);
        if (node.data?.columns) {
          node.data.columns.forEach(col => columns.push(col));
        }
      });
    }

    const sqlKeywords = new Set([
      'select', 'from', 'where', 'join', 'on', 'inner', 'outer', 'left', 'right',
      'group', 'by', 'order', 'having', 'limit', 'as', 'and', 'or', 'not', 'in',
      'is', 'null', 'asc', 'desc', 'count', 'sum', 'avg', 'min', 'max', 'distinct',
      'case', 'when', 'then', 'else', 'end', 'union', 'all', 'insert', 'update', 'delete',
      'into', 'values', 'set', 'table', 'create', 'drop', 'alter', 'index', 'primary', 'key'
    ]);

    // From / Join table matches
    const fromMatches = sql.matchAll(/(?:from|join)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi);
    for (const match of fromMatches) {
      if (match[1] && !sqlKeywords.has(match[1].toLowerCase())) {
        tables.push(match[1]);
      }
    }

    // Identifiers in SQL
    const identifiers = sql.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
    identifiers.forEach((w: string) => {
      const lower = w.toLowerCase();
      if (!sqlKeywords.has(lower) && !tables.some((t: string) => t.toLowerCase() === lower)) {
        columns.push(w);
      }
    });

    return { 
      knownTables: Array.from(new Set(tables)), 
      knownColumns: Array.from(new Set(columns)) 
    };
  }, [lineageConfig, sql]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const result = await api.generateSql(prompt);
      onChange(result.sql);
      setPrompt('');
    } catch (err) {
      console.error(err);
      alert('Failed to generate SQL');
    } finally {
      setGenerating(false);
    }
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!onHoverItem) return;

    // Use elementsFromPoint to inspect stacked elements beneath transparent textarea
    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    const token = elements.find(el => el.classList && el.classList.contains('sql-hover-token'));

    if (token) {
      const name = token.getAttribute('data-token-name');
      const type = token.getAttribute('data-token-type') as 'table' | 'column';
      if (name && type) {
        onHoverItem({ type, name });
        return;
      }
    }

    onHoverItem(null);
  }, [onHoverItem]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!onSelectItem) return;

    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    const token = elements.find(el => el.classList && el.classList.contains('sql-hover-token'));

    if (token) {
      const name = token.getAttribute('data-token-name');
      const type = token.getAttribute('data-token-type') as 'table' | 'column';
      if (name && type) {
        onSelectItem({ type, name });
      }
    }
  }, [onSelectItem]);

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      <div className="px-4 py-2 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SQL Query Writer</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={onAnalyze}
            disabled={loading || !sql}
            className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded text-xs font-medium transition-colors shadow-xs"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            Visualize Lineage
          </button>
        </div>
      </div>

      <div 
        className="flex-1 overflow-auto p-4 font-mono text-sm leading-relaxed text-slate-700 bg-slate-50/20 relative"
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onMouseLeave={() => onHoverItem && onHoverItem(null)}
      >
        <Editor
          value={sql}
          onValueChange={onChange}
          highlight={code => highlightSqlWithTokens(code, knownTables, knownColumns, hoveredItem, lineageConfig)}
          padding={8}
          style={{
            fontFamily: '"Fira code", "Fira Mono", "Courier New", monospace',
            minHeight: '100%',
          }}
          className="min-h-full focus:outline-none"
        />
      </div>

      <div className="p-4 border-t border-slate-100 bg-white">
        <div className="bg-slate-900 rounded-xl p-3 flex items-center gap-3 shadow-lg">
          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px] font-bold italic shrink-0">
            AI
          </div>
          <input 
            type="text" 
            placeholder="Prompt AI to autofill or modify SQL query..." 
            className="flex-1 bg-transparent text-white text-xs focus:outline-none placeholder:text-slate-500"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          />
          <button 
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            className="px-2.5 py-1 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white rounded text-[10px] font-medium transition-colors shrink-0"
          >
            {generating ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}
