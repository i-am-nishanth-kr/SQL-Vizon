import React, { useState, useEffect } from 'react';
import { Search, Plus, Database, FileText, ChevronRight, MoreVertical, Copy, Trash2 } from 'lucide-react';
import { Query, Project } from '../types';
import { api } from '../lib/api';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  onSelectQuery: (query: Query) => void;
  selectedQueryId?: string;
  onNewQuery: () => void;
  onCloneQuery: (id: string) => void;
  onDeleteQuery: (id: string) => void;
  refreshKey?: number;
}

export default function Sidebar({ onSelectQuery, selectedQueryId, onNewQuery, onCloneQuery, onDeleteQuery, refreshKey }: SidebarProps) {
  const [queries, setQueries] = useState<Query[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchQueries = async () => {
    try {
      const data = await api.getQueries(undefined, search);
      setQueries(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueries();
  }, [refreshKey]);

  useEffect(() => {
    const timer = setTimeout(fetchQueries, 300);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <aside className="w-full h-full border-r border-slate-200 bg-white flex flex-col">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <span className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-2">
          <Database size={15} className="text-blue-600" />
          Catalog
        </span>
        <button 
          onClick={onNewQuery}
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
          title="New Query"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="p-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search catalog..." 
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 space-y-1">
        {loading ? (
          <div className="text-center py-8 text-slate-400 text-xs">Loading catalog...</div>
        ) : queries.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">No queries found</div>
        ) : (
          queries.map((q) => {
            if (deleteConfirmId === q.id) {
              return (
                <div 
                  key={q.id}
                  className="p-2 rounded-md bg-rose-50 border border-rose-200 flex items-center justify-between text-xs my-1"
                >
                  <span className="font-semibold text-rose-800 text-[11px] truncate mr-2">
                    Delete?
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setQueries(prev => prev.filter(item => item.id !== q.id));
                        setDeleteConfirmId(null);
                        onDeleteQuery(q.id);
                      }}
                      className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      Delete
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(null);
                      }}
                      className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px] font-medium transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            }

            const isSelected = selectedQueryId === q.id;
            return (
              <div 
                key={q.id}
                onClick={() => onSelectQuery(q)}
                className={cn(
                  "group relative p-2.5 rounded-md transition-all cursor-pointer flex items-center justify-between",
                  isSelected 
                    ? "bg-blue-50 text-blue-700 border border-blue-100 shadow-xs" 
                    : "hover:bg-slate-50 text-slate-600 border border-transparent"
                )}
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className={cn("text-xs font-semibold truncate", isSelected ? "text-blue-900" : "text-slate-800")}>
                    {q.name}
                  </div>
                  <div className={cn("text-[10px] mt-0.5 uppercase tracking-wider truncate", isSelected ? "text-blue-500 opacity-90" : "text-slate-400")}>
                    {q.datasourceType || 'SQL Query'}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloneQuery(q.id);
                    }}
                    className="p-1 hover:bg-slate-200/80 rounded text-slate-400 hover:text-slate-700 transition-colors"
                    title="Clone Query"
                  >
                    <Copy size={13} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmId(q.id);
                    }}
                    className="p-1 hover:bg-rose-100 rounded text-slate-400 hover:text-rose-600 transition-colors"
                    title="Delete Query"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </nav>

      <div className="p-3 border-t border-slate-100 flex items-center gap-2.5 bg-slate-50/50">
        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs">
          SQL
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold text-slate-700 truncate">Workspace Query Store</div>
          <div className="text-[10px] text-slate-400 truncate">SQLite Sync Engine</div>
        </div>
      </div>
    </aside>
  );
}
