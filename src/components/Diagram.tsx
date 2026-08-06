import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap, 
  Handle, 
  Position,
  NodeProps,
  Panel,
  useNodesState,
  useEdgesState,
  getNodesBounds,
  getViewportForBounds,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { toPng, toSvg } from 'html-to-image';
import { FileJson, Edit2, Check, X, Image as ImageIcon, FileCode, Loader2 } from 'lucide-react';
import { LineageConfig, HoveredItem } from '../types';
import { resolveHighlights } from '../lib/lineage';
import { TransformationPane } from './TransformationPane';

interface DiagramProps {
  config: LineageConfig | null;
  onConfigChange: (config: LineageConfig) => void;
  hoveredItem?: HoveredItem | null;
  onHoverItem?: (item: HoveredItem | null) => void;
  selectedItem?: HoveredItem | null;
  onSelectItem?: (item: HoveredItem | null) => void;
}

interface LineageContextType {
  hoveredItem: HoveredItem | null;
  selectedItem: HoveredItem | null;
  onHoverItem?: (item: HoveredItem | null) => void;
  onSelectItem?: (item: HoveredItem | null) => void;
  config: LineageConfig | null;
}

const LineageContext = createContext<LineageContextType>({
  hoveredItem: null,
  selectedItem: null,
  config: null,
});

// Custom Table Node with AI-driven cross-highlighting & click selection
const TableNode = ({ id, data }: NodeProps) => {
  const { hoveredItem, selectedItem, onHoverItem, onSelectItem, config } = useContext(LineageContext);
  const activeItem = hoveredItem || selectedItem;
  const resolved = resolveHighlights(config, activeItem);
  const tableLabel = (data.label || id || '').toLowerCase();
  const isTableHovered = resolved.tableNames.has(tableLabel);
  const isTableSelected = selectedItem?.type === 'table' && 
    (selectedItem.name || '').toLowerCase() === tableLabel;

  // Extract columns list: prioritize data.columns, fallback to graph dependencies/transformations
  const displayColumns: string[] = (data.columns && Array.isArray(data.columns) && data.columns.length > 0)
    ? data.columns
    : Array.from(new Set([
        ...(config?.transformations || [])
          .filter((t: any) => (t.targetTable || '').toLowerCase() === tableLabel)
          .map((t: any) => t.targetColumn),
        ...(config?.columnDependencies || [])
          .filter((d: any) => (d.targetTable || '').toLowerCase() === tableLabel)
          .map((d: any) => d.targetColumn),
        ...(config?.transformations || [])
          .flatMap((t: any) => (t.sourceColumns || []))
          .filter((s: any) => (s.table || '').toLowerCase() === tableLabel)
          .map((s: any) => s.column),
        ...(config?.columnDependencies || [])
          .flatMap((d: any) => (d.sourceColumns || []))
          .filter((s: any) => (s.table || '').toLowerCase() === tableLabel)
          .map((s: any) => s.column)
      ].filter(Boolean)));

  return (
    <div 
      className={`bg-white rounded-lg border min-w-[220px] overflow-hidden ${
        isTableSelected
          ? 'border-amber-500 ring-4 ring-amber-400 shadow-2xl z-50'
          : isTableHovered 
            ? 'border-amber-400 ring-4 ring-amber-300 shadow-xl z-50' 
            : 'border-slate-200 shadow-md hover:border-slate-300'
      }`}
    >
      <div 
        className={`p-2.5 text-xs font-bold flex items-center justify-between cursor-pointer ${
          isTableSelected
            ? 'bg-amber-600 text-white font-black'
            : isTableHovered 
              ? 'bg-amber-500 text-slate-950 font-extrabold' 
              : 'bg-slate-900 text-white hover:bg-slate-800'
        }`}
        onMouseEnter={() => onHoverItem?.({ type: 'table', name: data.label || id })}
        onMouseLeave={() => onHoverItem?.(null)}
        onClick={(e) => {
          e.stopPropagation();
          onSelectItem?.({ type: 'table', name: data.label || id });
        }}
      >
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isTableHovered || isTableSelected ? 'bg-slate-950 font-bold' : 'bg-orange-400'}`} />
          <span className="uppercase tracking-wider font-extrabold">{data.label || id}</span>
        </div>
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
          isTableSelected
            ? 'bg-amber-800 text-white font-bold'
            : isTableHovered 
              ? 'bg-amber-600 text-white font-bold' 
              : 'bg-slate-800 text-slate-300'
        }`}>
          {isTableSelected ? 'SELECTED' : 'TABLE'}
        </span>
      </div>

      <div className="p-2 space-y-1 bg-white">
        {displayColumns.length > 0 ? (
          displayColumns.map((col: string) => {
            const colKey = `${tableLabel}::${col.toLowerCase()}`;
            const isColHovered = resolved.columnKeys.has(colKey) || 
              (resolved.columnKeys.size === 0 && resolved.columnNames.has(col.toLowerCase()));
            const isColSelected = selectedItem?.type === 'column' && 
              selectedItem.name.toLowerCase() === col.toLowerCase() &&
              (!selectedItem.tableName || selectedItem.tableName.toLowerCase() === tableLabel);

            return (
              <div 
                key={col} 
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  onHoverItem?.({ type: 'column', name: col, tableName: data.label || id });
                }}
                onMouseLeave={(e) => {
                  e.stopPropagation();
                  onHoverItem?.(null);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectItem?.({ type: 'column', name: col, tableName: data.label || id });
                }}
                className={`text-[10px] flex items-center justify-between px-2 py-1 rounded cursor-pointer ${
                  isColSelected
                    ? 'bg-amber-400 text-slate-950 font-black ring-2 ring-amber-500 shadow-md'
                    : isColHovered
                      ? 'bg-amber-300 text-amber-950 font-bold ring-2 ring-amber-400 shadow-xs'
                      : 'text-slate-600 hover:bg-amber-50 hover:text-amber-900 border-b border-slate-50 last:border-0'
                }`}
              >
                <div className="flex items-center gap-1">
                  {isColSelected && <span className="text-[10px] shrink-0" title="Selected Column">📌</span>}
                  <span className={`font-medium ${isColHovered || isColSelected ? 'text-amber-950 font-bold' : 'text-slate-700'}`}>
                    {col}
                  </span>
                </div>
                <span className={`font-mono italic text-[9px] ${
                  isColSelected || isColHovered ? 'text-amber-900 font-semibold' : 'text-blue-500'
                }`}>
                  VARCHAR
                </span>
              </div>
            );
          })
        ) : (
          <div className="text-[10px] text-slate-400 italic px-2 py-1">No columns specified</div>
        )}
      </div>
      <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 !bg-blue-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 !bg-blue-500 !border-2 !border-white" />
    </div>
  );
};

const nodeTypes = {
  table: TableNode,
  subquery: TableNode,
  cte: TableNode,
  source: TableNode,
  transformation: TableNode,
  transform: TableNode,
  destination: TableNode,
  output: TableNode,
  view: TableNode,
  derived: TableNode,
  default: TableNode,
  custom: TableNode,
  table_node: TableNode,
};

function DiagramContent({ config, onConfigChange, hoveredItem, onHoverItem, selectedItem, onSelectItem }: DiagramProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isEditingJson, setIsEditingJson] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [exportingImage, setExportingImage] = useState(false);

  const { getNodes } = useReactFlow();

  const safeConfig = config || { nodes: [], edges: [] };
  const activeItem = hoveredItem || selectedItem;

  // Clear selection on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSelectItem?.(null);
        onHoverItem?.(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectItem, onHoverItem]);

  // Sync nodes ONLY when config structure changes
  useEffect(() => {
    const rawNodes = safeConfig.nodes || [];
    setNodes((prevNodes) => {
      const prevMap = new Map(prevNodes.map(n => [n.id, n]));
      return rawNodes.map(node => {
        const existing = prevMap.get(node.id) as { position?: { x: number; y: number } } | undefined;
        return {
          ...node,
          type: node.type || 'table',
          position: existing?.position || node.position || { x: 0, y: 0 },
          data: {
            ...node.data,
            label: node.data?.label || node.id,
            columns: node.data?.columns || [],
          }
        };
      });
    });
  }, [config, setNodes]);

  // Sync edges with highlight styles on active hover/selection and ensure fill: none
  useEffect(() => {
    const rawEdges = safeConfig.edges || [];
    const resolved = resolveHighlights(safeConfig, activeItem);

    const matchingNodeIds = activeItem ? (safeConfig.nodes || [])
      .filter(n => {
        const tLabel = (n.data?.label || n.id).toLowerCase();
        if (resolved.tableNames.has(tLabel)) return true;

        return (n.data?.columns || []).some(col => {
          const colKey = `${tLabel}::${col.toLowerCase()}`;
          return resolved.columnKeys.has(colKey) || (resolved.columnKeys.size === 0 && resolved.columnNames.has(col.toLowerCase()));
        });
      })
      .map(n => n.id) : [];

    const updatedEdges = rawEdges.map(e => {
      const isConnected = activeItem ? (matchingNodeIds.includes(e.source) || matchingNodeIds.includes(e.target)) : false;
      return {
        ...e,
        animated: isConnected ? true : e.animated,
        style: {
          fill: 'none',
          stroke: isConnected ? '#f59e0b' : '#cbd5e1',
          strokeWidth: isConnected ? 3 : 1.5,
          ...(e.style || {}),
        },
        labelStyle: {
          fill: '#0f172a',
          fontWeight: 600,
          fontSize: 11,
          fontFamily: 'system-ui, sans-serif',
          ...(e.labelStyle || {}),
        },
        labelBgStyle: {
          fill: '#ffffff',
          fillOpacity: 1,
          rx: 4,
          ry: 4,
          stroke: '#cbd5e1',
          strokeWidth: 1,
          ...(e.labelBgStyle || {}),
        },
        labelBgPadding: [6, 4] as [number, number],
      };
    });

    setEdges(updatedEdges);
  }, [config, hoveredItem, selectedItem, setEdges]);

  // Handle node position updates when dragged without losing other nodes
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

    onConfigChange({
      ...safeConfig,
      nodes: updatedNodesConfig
    });
  }, [safeConfig, getNodes, onConfigChange]);

  const handleExportJson = () => {
    const currentNodes = getNodes();
    const cleanNodes = currentNodes.map(n => ({
      id: n.id,
      type: n.type || 'table',
      position: n.position,
      data: {
        label: n.data?.label || n.id,
        columns: n.data?.columns || []
      }
    }));
    const cleanEdges = edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label
    }));
    const fullConfig = {
      nodes: cleanNodes.length > 0 ? cleanNodes : (safeConfig.nodes || []),
      edges: cleanEdges.length > 0 ? cleanEdges : (safeConfig.edges || []),
      columnDependencies: safeConfig.columnDependencies || [],
      transformations: safeConfig.transformations || []
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullConfig, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "lineage_config.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleExportDiagram = async (format: 'svg' | 'png' = 'svg') => {
    if (!nodes || nodes.length === 0) {
      alert('Canvas is empty.');
      return;
    }

    const viewportEl = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!viewportEl) {
      alert('Could not find canvas viewport.');
      return;
    }

    setExportingImage(true);
    let injectedStyle: HTMLStyleElement | null = null;
    try {
      // Explicitly set SVG path inline attributes so export renderer doesn't fill paths with black
      const edgePaths = viewportEl.querySelectorAll('.react-flow__edge-path, path');
      edgePaths.forEach((path) => {
        const p = path as SVGPathElement;
        p.setAttribute('fill', 'none');
        p.style.fill = 'none';
        if (!p.getAttribute('stroke')) {
          p.setAttribute('stroke', '#cbd5e1');
          p.style.stroke = '#cbd5e1';
        }
      });

      // Explicitly set SVG edge text labels
      const edgeTexts = viewportEl.querySelectorAll('.react-flow__edge-text, text');
      edgeTexts.forEach((text) => {
        const t = text as SVGTextElement;
        t.setAttribute('fill', '#0f172a');
        t.style.fill = '#0f172a';
        t.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        t.style.fontSize = '11px';
        t.style.fontWeight = '600';
      });

      // Explicitly set SVG edge text background rects
      const edgeTextBgs = viewportEl.querySelectorAll('.react-flow__edge-textbg, rect');
      edgeTextBgs.forEach((rect) => {
        const r = rect as SVGRectElement;
        r.setAttribute('fill', '#ffffff');
        r.style.fill = '#ffffff';
        r.setAttribute('stroke', '#cbd5e1');
        r.style.stroke = '#cbd5e1';
        r.setAttribute('stroke-width', '1');
        r.style.strokeWidth = '1px';
      });

      // Inject temporary inline stylesheet into viewport element for clean canvas snapshot
      injectedStyle = document.createElement('style');
      injectedStyle.id = 'export-canvas-inline-styles';
      injectedStyle.innerHTML = `
        .react-flow__edge-path, path { fill: none !important; stroke-dasharray: none; }
        .react-flow__edge-text, text { fill: #0f172a !important; font-family: system-ui, sans-serif !important; font-size: 11px !important; font-weight: 600 !important; }
        .react-flow__edge-textbg, rect { fill: #ffffff !important; stroke: #cbd5e1 !important; stroke-width: 1px !important; }
      `;
      viewportEl.appendChild(injectedStyle);

      // Calculate exact bounding box for ALL nodes using current user-moved positions
      const currentNodes = getNodes();
      const nodesBounds = getNodesBounds(currentNodes.length > 0 ? currentNodes : nodes);
      const padding = 80;
      const width = Math.max(Math.ceil(nodesBounds.width + padding * 2), 600);
      const height = Math.max(Math.ceil(nodesBounds.height + padding * 2), 400);

      const viewport = getViewportForBounds(
        nodesBounds,
        width,
        height,
        0.1,
        2,
        0.1
      );

      const filter = (node: HTMLElement) => {
        if (node.classList) {
          if (
            node.classList.contains('react-flow__controls') ||
            node.classList.contains('react-flow__panel') ||
            node.classList.contains('react-flow__minimap')
          ) {
            return false;
          }
        }
        return true;
      };

      const exportOptions = {
        backgroundColor: '#f8fafc',
        width,
        height,
        style: {
          width: `${width}px`,
          height: `${height}px`,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        },
        filter,
      };

      let dataUrl = '';
      if (format === 'svg') {
        dataUrl = await toSvg(viewportEl, exportOptions);
      } else {
        dataUrl = await toPng(viewportEl, exportOptions);
      }

      const fileName = `${safeConfig.nodes?.[0]?.data?.label || 'lineage-diagram'}.${format}`;
      const a = document.createElement('a');
      a.setAttribute('download', fileName);
      a.setAttribute('href', dataUrl);
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error(`Failed to export as ${format}:`, err);
      alert(`Could not export canvas as ${format.toUpperCase()}.`);
    } finally {
      if (injectedStyle) {
        injectedStyle.remove();
      }
      setExportingImage(false);
    }
  };

  const handleStartEditJson = () => {
    const currentNodes = getNodes();
    const cleanNodes = currentNodes.map(n => ({
      id: n.id,
      type: n.type || 'table',
      position: n.position,
      data: {
        label: n.data?.label || n.id,
        columns: n.data?.columns || []
      }
    }));
    const cleanEdges = edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label
    }));
    const fullConfig = {
      nodes: cleanNodes.length > 0 ? cleanNodes : (safeConfig.nodes || []),
      edges: cleanEdges.length > 0 ? cleanEdges : (safeConfig.edges || []),
      columnDependencies: safeConfig.columnDependencies || [],
      transformations: safeConfig.transformations || []
    };
    setJsonInput(JSON.stringify(fullConfig, null, 2));
    setIsEditingJson(true);
  };

  const handleSaveJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      onConfigChange(parsed);
      setIsEditingJson(false);
    } catch (err) {
      alert('Invalid JSON');
    }
  };

  return (
    <LineageContext.Provider value={{ hoveredItem, selectedItem, onHoverItem, onSelectItem, config: safeConfig }}>
      <div className="h-full relative bg-slate-50">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={handleNodeDragStop}
          onPaneClick={() => onSelectItem?.(null)}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={{ style: { fill: 'none', stroke: '#cbd5e1', strokeWidth: 1.5 } }}
          fitView
        >
          <Background color="#cbd5e1" gap={20} />
          <Controls />
          <MiniMap nodeStrokeWidth={3} zoomable pannable />

          {selectedItem && (
            <Panel position="top-left" className="flex items-center gap-2 bg-amber-500 text-slate-950 px-3 py-1.5 rounded-lg shadow-lg text-xs font-bold z-10 border border-amber-600">
              <span>📌 Pinned Selection:</span>
              <span className="font-extrabold underline">
                {selectedItem.tableName ? `${selectedItem.tableName}.${selectedItem.name}` : selectedItem.name}
              </span>
              <button 
                onClick={() => onSelectItem?.(null)}
                className="ml-1 p-0.5 hover:bg-amber-600 rounded text-slate-950 hover:text-white transition-colors cursor-pointer"
                title="Clear Pin Selection (Esc or Click Canvas)"
              >
                <X size={14} />
              </button>
            </Panel>
          )}
          
          <Panel position="top-right" className="flex gap-2">
            <button 
              onClick={() => handleExportDiagram('svg')}
              disabled={exportingImage}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-md text-xs font-medium shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              title="Export full canvas as vector SVG"
            >
              {exportingImage ? <Loader2 size={14} className="animate-spin text-blue-600" /> : <FileCode size={14} className="text-blue-600" />}
              Export SVG
            </button>
            <button 
              onClick={() => handleExportDiagram('png')}
              disabled={exportingImage}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-md text-xs font-medium shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              title="Export full canvas as PNG image"
            >
              {exportingImage ? <Loader2 size={14} className="animate-spin text-emerald-600" /> : <ImageIcon size={14} className="text-emerald-600" />}
              Export PNG
            </button>
            <button 
              onClick={handleExportJson}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-md text-xs font-medium shadow-xs transition-all cursor-pointer"
            >
              <FileJson size={14} />
              Export Config
            </button>
            <button 
              onClick={handleStartEditJson}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-md text-xs font-medium shadow-xs transition-all cursor-pointer"
            >
              <Edit2 size={14} />
              Edit JSON
            </button>
          </Panel>
        </ReactFlow>

        {isEditingJson && (
          <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <FileJson size={20} className="text-blue-600" />
                Lineage Configuration
              </h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsEditingJson(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400 transition-colors"
                >
                  <X size={20} />
                </button>
                <button 
                  onClick={handleSaveJson}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-sm font-medium transition-colors"
                >
                  <Check size={16} />
                  Apply Changes
                </button>
              </div>
            </div>
            <textarea 
              className="flex-1 w-full p-4 font-mono text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
            />
          </div>
        )}

        {/* Transformation Inspector Pane */}
        <TransformationPane
          selectedItem={selectedItem}
          lineageConfig={safeConfig}
          onClose={() => onSelectItem?.(null)}
          onSelectColumn={(col) => onSelectItem?.(col)}
        />
      </div>
    </LineageContext.Provider>
  );
}

export default function Diagram(props: DiagramProps) {
  return (
    <ReactFlowProvider>
      <DiagramContent {...props} />
    </ReactFlowProvider>
  );
}
