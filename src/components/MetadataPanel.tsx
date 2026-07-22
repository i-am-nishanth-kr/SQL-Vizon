import React, { useState } from 'react';
import { Tag, FileText, Database, Plus, Trash2 } from 'lucide-react';
import { Query } from '../types';

interface MetadataPanelProps {
  query: Query;
  onChange: (query: Query) => void;
}

export default function MetadataPanel({ query, onChange }: MetadataPanelProps) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const handleAddMetadata = () => {
    if (!newKey.trim()) return;
    onChange({
      ...query,
      metadata: { ...query.metadata, [newKey]: newValue }
    });
    setNewKey('');
    setNewValue('');
  };

  const handleRemoveMetadata = (key: string) => {
    const newMeta = { ...query.metadata };
    delete newMeta[key];
    onChange({ ...query, metadata: newMeta });
  };

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full bg-white">
      <div className="space-y-4">
        <div>
          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Query Name</label>
          <input 
            type="text" 
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-800"
            value={query.name}
            onChange={(e) => onChange({ ...query, name: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Description</label>
          <textarea 
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 min-h-[70px]"
            value={query.description}
            onChange={(e) => onChange({ ...query, description: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Datasource Type</label>
          <select 
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 font-medium"
            value={query.datasourceType}
            onChange={(e) => onChange({ ...query, datasourceType: e.target.value })}
          >
            <option value="PostgreSQL">PostgreSQL</option>
            <option value="BigQuery">BigQuery</option>
            <option value="Snowflake">Snowflake</option>
            <option value="SQLite">SQLite</option>
            <option value="MySQL">MySQL</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Custom Metadata</label>
        
        <div className="border border-slate-100 rounded overflow-hidden mb-3">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-3 py-1.5 text-[9px] font-bold text-slate-400 uppercase">Key</th>
                <th className="px-3 py-1.5 text-[9px] font-bold text-slate-400 uppercase">Value</th>
                <th className="w-6"></th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(query.metadata).length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-[10px] text-slate-400 italic text-center">
                    No custom metadata keys added.
                  </td>
                </tr>
              ) : (
                Object.entries(query.metadata).map(([key, value]) => (
                  <tr key={key} className="border-b border-slate-50 hover:bg-slate-50/50 group">
                    <td className="px-3 py-1.5 text-[10px] font-mono text-slate-700 font-medium">{key}</td>
                    <td className="px-3 py-1.5 text-[10px] text-slate-600">{value}</td>
                    <td className="pr-2 text-right">
                      <button 
                        onClick={() => handleRemoveMetadata(key)}
                        className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2">
          <input 
            type="text" 
            placeholder="New key..." 
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
          />
          <input 
            type="text" 
            placeholder="New value..." 
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
          />
        </div>
        <button 
          onClick={handleAddMetadata}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium transition-colors"
        >
          <Plus size={13} />
          Add Property
        </button>
      </div>
    </div>
  );
}
