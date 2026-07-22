import React from 'react';
import { History, CheckCircle2, Clock } from 'lucide-react';
import { DiagramVersion } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface VersionPanelProps {
  versions: DiagramVersion[];
  onSelect: (version: DiagramVersion) => void;
  selectedId?: string;
}

export default function VersionPanel({ versions, onSelect, selectedId }: VersionPanelProps) {
  return (
    <div className="p-4 flex flex-col h-full bg-white">
      <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
        <History size={12} />
        Generation History ({versions.length})
      </h3>
      
      <div className="space-y-2.5 overflow-y-auto pr-1">
        {versions.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs italic">
            No versions generated yet.
          </div>
        ) : (
          versions.map((v) => (
            <div 
              key={v.id}
              onClick={() => onSelect(v)}
              className={cn(
                "p-3 rounded border transition-all cursor-pointer relative overflow-hidden",
                selectedId === v.id || v.isActive
                  ? "bg-blue-50/40 border-blue-200 shadow-2xs"
                  : "bg-slate-50/50 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-900">Version {v.versionNumber}</span>
                {v.isActive && (
                  <span className="flex items-center gap-1 text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-200 uppercase">
                    <CheckCircle2 size={10} />
                    Active
                  </span>
                )}
              </div>
              
              <p className="text-[11px] text-slate-600 line-clamp-2 italic mb-2 font-mono">
                "{v.promptUsed || 'Initial diagram'}"
              </p>
              
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <Clock size={11} />
                {new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>

              {(selectedId === v.id || v.isActive) && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
