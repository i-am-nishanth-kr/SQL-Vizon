import React, { useState } from 'react';
import { HoveredItem, LineageConfig, ColumnTransformation, ColumnDependency } from '../types';
import { X, ChevronUp, ChevronDown, Copy, Check, Sparkles, Layers, ArrowRight, Code2, Database } from 'lucide-react';

interface TransformationPaneProps {
  selectedItem: HoveredItem | null;
  lineageConfig: LineageConfig | null;
  onClose: () => void;
  onSelectColumn?: (item: HoveredItem) => void;
}

export function TransformationPane({
  selectedItem,
  lineageConfig,
  onClose,
  onSelectColumn,
}: TransformationPaneProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!selectedItem) return null;

  const colName = selectedItem.name.trim().toLowerCase();
  const tableName = selectedItem.tableName ? selectedItem.tableName.trim().toLowerCase() : null;

  // 1. Find matching transformation from AI lineageConfig
  const transformations = lineageConfig?.transformations || [];
  const columnDependencies = lineageConfig?.columnDependencies || [];

  const matchedTransformation = transformations.find(t => {
    const tCol = t.targetColumn.trim().toLowerCase();
    const tTable = t.targetTable ? t.targetTable.trim().toLowerCase() : null;
    const isColMatch = tCol === colName;
    const isTableMatch = !tableName || !tTable || tTable === tableName || tTable.includes('output') || tableName.includes('output');
    return isColMatch && isTableMatch;
  });

  // 2. Find matching columnDependencies if transformation not directly found
  const matchedDep = columnDependencies.find(d => {
    const dCol = d.targetColumn.trim().toLowerCase();
    const dTable = d.targetTable ? d.targetTable.trim().toLowerCase() : null;
    const isColMatch = dCol === colName;
    const isTableMatch = !tableName || !dTable || dTable === tableName || dTable.includes('output') || tableName.includes('output');
    return isColMatch && isTableMatch;
  });

  // Derived source columns
  const sourceCols = matchedTransformation?.sourceColumns || matchedDep?.sourceColumns || [];

  // Derived transformation type & expression
  const transformType = (matchedTransformation?.transformationType || 'direct').toLowerCase();
  const expression = matchedTransformation?.expression || 
    (sourceCols.length > 1 
      ? `TRANSFORM(${sourceCols.map(s => `${s.table}.${s.column}`).join(', ')})`
      : sourceCols.length === 1 
        ? `${sourceCols[0].table}.${sourceCols[0].column}`
        : `${selectedItem.tableName ? `${selectedItem.tableName}.` : ''}${selectedItem.name}`);

  // Derived description
  const description = matchedTransformation?.description || 
    (sourceCols.length > 1
      ? `Calculated column combining ${sourceCols.map(s => `'${s.column}' from '${s.table}'`).join(' and ')}.`
      : sourceCols.length === 1
        ? `Pass-through projection derived from '${sourceCols[0].column}' in table '${sourceCols[0].table}'.`
        : `Column '${selectedItem.name}' in '${selectedItem.tableName || 'table'}'.`);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getTypeBadgeStyle = (type: string) => {
    switch (type) {
      case 'concatenation':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'aggregation':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'calculation':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'case_conditional':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'window_function':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'cast':
        return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="absolute bottom-3 left-4 right-4 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200 z-50 transition-all duration-300 overflow-hidden max-w-5xl mx-auto">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between border-b border-slate-700">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-400/30">
            <Sparkles size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Transformation Detail</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${getTypeBadgeStyle(transformType)}`}>
                {transformType}
              </span>
            </div>
            <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5 mt-0.5">
              {selectedItem.tableName && <span className="text-amber-400 font-mono">{selectedItem.tableName}.</span>}
              <span className="font-mono text-amber-300 underline">{selectedItem.name}</span>
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700/60 rounded-md transition-colors"
            title={isMinimized ? 'Expand Pane' : 'Minimize Pane'}
          >
            {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-red-500/80 rounded-md transition-colors"
            title="Close Transformation Pane (Esc)"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body Content */}
      {!isMinimized && (
        <div className="p-4 space-y-4 max-h-[320px] overflow-y-auto">
          {/* Explanation */}
          <div className="p-3 bg-amber-50/70 rounded-lg border border-amber-200/80 flex items-start gap-3">
            <Layers className="text-amber-600 shrink-0 mt-0.5" size={18} />
            <div>
              <div className="text-xs font-bold text-amber-900 uppercase tracking-wide">Transformation Logic</div>
              <p className="text-xs text-slate-700 mt-1 leading-relaxed font-medium">
                {description}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* SQL Expression */}
            <div className="p-3 bg-slate-900 text-slate-100 rounded-lg border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1 uppercase tracking-wider">
                    <Code2 size={13} /> SQL Formula / Expression
                  </span>
                  <button
                    onClick={() => handleCopy(expression)}
                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-amber-300 transition-colors"
                  >
                    {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <pre className="font-mono text-xs bg-slate-950 p-2.5 rounded border border-slate-800 text-emerald-300 overflow-x-auto leading-normal whitespace-pre-wrap">
                  {expression}
                </pre>
              </div>
            </div>

            {/* Source Columns Involved */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1 uppercase tracking-wider mb-2">
                  <Database size={13} className="text-indigo-600" /> Source Columns ({sourceCols.length})
                </div>

                {sourceCols.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {sourceCols.map((src, idx) => (
                      <button
                        key={`${src.table}-${src.column}-${idx}`}
                        onClick={() => onSelectColumn?.({ type: 'column', name: src.column, tableName: src.table })}
                        className="px-2.5 py-1 bg-white hover:bg-amber-100 text-slate-800 hover:text-amber-950 border border-slate-300 hover:border-amber-400 rounded-md font-mono text-xs font-semibold shadow-xs transition-all flex items-center gap-1 group cursor-pointer"
                        title={`Click to highlight ${src.table}.${src.column} in diagram`}
                      >
                        <span className="text-indigo-600 font-bold group-hover:text-amber-800">{src.table}.</span>
                        <span className="text-slate-900 font-extrabold underline">{src.column}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic p-2 bg-white rounded border border-dashed border-slate-200">
                    No direct source columns declared.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Lineage Trail Diagram */}
          {sourceCols.length > 0 && (
            <div className="pt-2 border-t border-slate-200 flex items-center gap-2 overflow-x-auto text-xs font-mono">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Lineage Flow:</span>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex gap-1 bg-slate-100 p-1 rounded border border-slate-200">
                  {sourceCols.map(s => `${s.table}.${s.column}`).join(' + ')}
                </div>
                <ArrowRight size={14} className="text-amber-500" />
                <div className="px-2 py-1 bg-amber-100 text-amber-900 font-bold rounded border border-amber-300">
                  {transformType.toUpperCase()}
                </div>
                <ArrowRight size={14} className="text-amber-500" />
                <div className="px-2 py-1 bg-slate-900 text-amber-300 font-extrabold rounded">
                  {selectedItem.tableName ? `${selectedItem.tableName}.${selectedItem.name}` : selectedItem.name}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
