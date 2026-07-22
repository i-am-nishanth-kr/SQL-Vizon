import React, { useState, useEffect, useCallback } from 'react';
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

// Custom Table Node with cross-highlighting
const TableNode = ({ data }: NodeProps) => {
  const isTableHovered = data.hoveredItem?.type === 'table' && 
    (data.label || '').toLowerCase() === (data.hoveredItem.name || '').toLowerCase();

  return (
    <div 
      className={`bg-white rounded-lg border transition-all duration-150 min-w-[210px] overflow-hidden ${
        isTableHovered 
          ? 'border-amber-400 ring-4 ring-amber-300 shadow-xl scale-[1.03] z-50' 
          : 'border-slate-200 shadow-md hover:border-slate-300'
      }`}
    >
      <div 
        className={`p-2.5 text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
          isTableHovered ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-white hover:bg-slate-800'
        }`}
        onMouseEnter={() => data.onHoverItem?.({ type: 'table', name: data.label })}
        onMouseLeave={() => data.onHoverItem?.(null)}
      >
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isTableHovered ? 'bg-slate-950 font-bold' : 'bg-orange-400'}`} />
          <span className="uppercase tracking-wider font-extrabold">{data.label}</span>
        </div>
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
          isTableHovered ? 'bg-amber-600 text-white font-bold' : 'bg-slate-800 text-slate-300'
        }`}>
          TABLE
        </span>
      </div>

      <div className="p-2 space-y-1 bg-white">
        {data.columns?.map((col: string) => {
          const isColHovered = data.hoveredItem?.type === 'column' && 
            col.toLowerCase() === (data.hoveredItem.name || '').toLowerCase();

          return (
            <div 
              key={col} 
              onMouseEnter={(e) => {
                e.stopPropagation();
                data.onHoverItem?.({ type: 'column', name: col, tableName: data.label });
              }}
              onMouseLeave={(e) => {
                e.stopPropagation();
                data.onHoverItem?.(null);
              }}
              className={`text-[10px] flex items-center justify-between px-2 py-1 rounded transition-all cursor-pointer ${
                isColHovered
                  ? 'bg-amber-300 text-amber-950 font-bold ring-2 ring-amber-400 shadow-xs scale-[1.02]'
                  : 'text-slate-600 hover:bg-amber-50 hover:text-amber-900 border-b border-slate-50 last:border-0'
              }`}
            >
              <span className={`font-medium ${isColHovered ? 'text-amber-950 font-bold' : 'text-slate-700'}`}>
                {col}
              </span>
              <span className={`font-mono italic text-[9px] ${
                isColHovered ? 'text-amber-900 font-semibold' : 'text-blue-500'
              }`}>
                VARCHAR
              </span>
            </div>
          );
        })}
      </div>
      <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 !bg-blue-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 !bg-blue-500 !border-2 !border-white" />
    </div>
  );
};

const nodeTypes = {
  table: TableNode,
  subquery: TableNode,
  source: TableNode,
};

interface DiagramProps {
  config: LineageConfig | null;
  onConfigChange: (config: LineageConfig) => void;
  hoveredItem?: HoveredItem | null;
  onHoverItem?: (item: HoveredItem | null) => void;
}

function DiagramContent({ config, onConfigChange, hoveredItem, onHoverItem }: DiagramProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isEditingJson, setIsEditingJson] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [exportingImage, setExportingImage] = useState(false);

  const { getNodes } = useReactFlow();

  const safeConfig = config || { nodes: [], edges: [] };

  // Sync nodes when config changes while retaining custom node data
  useEffect(() => {
    const rawNodes = safeConfig.nodes || [];
    setNodes(
      rawNodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          hoveredItem,
          onHoverItem,
        }
      }))
    );
  }, [config, setNodes]);

  // Update hoveredItem in node data when hover changes
  useEffect(() => {
    setNodes((prevNodes) =>
      prevNodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          hoveredItem,
          onHoverItem,
        }
      }))
    );
  }, [hoveredItem, onHoverItem, setNodes]);

  // Sync edges with highlight styles on active hover and ensure fill: none
  useEffect(() => {
    const rawEdges = safeConfig.edges || [];
    const hName = hoveredItem?.name?.toLowerCase() || '';

    const matchingNodeIds = hoveredItem ? (safeConfig.nodes || [])
      .filter(n => {
        if (hoveredItem.type === 'table') {
          return (n.data?.label || '').toLowerCase() === hName || n.id.toLowerCase() === hName;
        } else {
          return (n.data?.columns || []).some(c => c.toLowerCase() === hName);
        }
      })
      .map(n => n.id) : [];

    const updatedEdges = rawEdges.map(e => {
      const isConnected = hoveredItem ? (matchingNodeIds.includes(e.source) || matchingNodeIds.includes(e.target)) : false;
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
  }, [config, hoveredItem, setEdges]);

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
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ nodes, edges }, null, 2));
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
    setJsonInput(JSON.stringify({ nodes, edges }, null, 2));
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
    <div className="h-full relative bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={handleNodeDragStop}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{ style: { fill: 'none', stroke: '#cbd5e1', strokeWidth: 1.5 } }}
        fitView
      >
        <Background color="#cbd5e1" gap={20} />
        <Controls />
        <MiniMap nodeStrokeWidth={3} zoomable pannable />
        
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
    </div>
  );
}

export default function Diagram(props: DiagramProps) {
  return (
    <ReactFlowProvider>
      <DiagramContent {...props} />
    </ReactFlowProvider>
  );
}
