import React, { useState, useEffect, useCallback } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import Sidebar from './components/Sidebar';
import SqlEditor from './components/Editor';
import Diagram from './components/Diagram';
import MetadataPanel from './components/MetadataPanel';
import VersionPanel from './components/VersionPanel';
import { Query, LineageConfig, DiagramVersion, HoveredItem } from './types';
import { api } from './lib/api';
import { Layers, Database, History, Download, Trash2, Github, Layout as LayoutIcon, PanelLeft, PanelRight, Plus, SlidersHorizontal } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const INITIAL_SQL = `-- Customer Orders & Analytics Lineage Query
SELECT 
  u.id AS user_id,
  CONCAT(u.first_name, ' ', u.last_name) AS customer_name,
  u.email AS customer_email,
  COUNT(o.id) AS total_orders,
  SUM(o.total_amount) AS total_spent
FROM users u
JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.first_name, u.last_name, u.email;`;

export default function App() {
  const [selectedQuery, setSelectedQuery] = useState<Query | null>(null);
  const [lineageConfig, setLineageConfig] = useState<LineageConfig>({ nodes: [], edges: [] });
  const [versions, setVersions] = useState<DiagramVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<'meta' | 'history'>('meta');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [hoveredItem, setHoveredItem] = useState<HoveredItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<HoveredItem | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSelectItem = useCallback((item: HoveredItem | null) => {
    if (!item) {
      setSelectedItem(null);
      return;
    }
    setSelectedItem(prev => {
      if (
        prev && 
        prev.type === item.type && 
        prev.name.toLowerCase() === item.name.toLowerCase() &&
        (prev.tableName || '').toLowerCase() === (item.tableName || '').toLowerCase()
      ) {
        return null; // Toggle off if clicking same item
      }
      return item;
    });
  }, []);

  const activeItem = hoveredItem || selectedItem;

  const loadQueryData = async (queryId: string) => {
    try {
      const query = await api.getQuery(queryId);
      setSelectedQuery(query);
      
      const vData = await api.getVersions(queryId);
      setVersions(vData);
      
      const active = vData.find(v => v.isActive);
      if (active) {
        setLineageConfig(JSON.parse(active.jsonConfig));
        setActiveVersionId(active.id);
      } else {
        setLineageConfig({ nodes: [], edges: [] });
        setActiveVersionId(undefined);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    async function initApp() {
      try {
        const queries = await api.getQueries();
        if (queries && queries.length > 0) {
          await loadQueryData(queries[0].id);
        } else {
          // Create initial sample query
          const { id } = await api.createQuery({
            name: 'Customer Orders Lineage',
            sqlText: INITIAL_SQL,
            datasourceType: 'PostgreSQL',
            metadata: { Owner: 'Analytics Team', Status: 'Production' }
          });
          setRefreshKey(prev => prev + 1);
          await loadQueryData(id);
          
          // Auto analyze initial query
          setLoading(true);
          try {
            const config = await api.parseSql(INITIAL_SQL);
            setLineageConfig(config);
            const { id: vId } = await api.createVersion(id, JSON.stringify(config), 'Initial Generation');
            const vData = await api.getVersions(id);
            setVersions(vData);
            setActiveVersionId(vId);
          } catch (err) {
            console.error('Initial auto-parse error:', err);
          } finally {
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Init app error:', err);
      }
    }
    initApp();
  }, []);

  const handleNewQuery = async () => {
    try {
      const { id } = await api.createQuery({
        name: 'New Query',
        sqlText: INITIAL_SQL,
        datasourceType: 'PostgreSQL',
        metadata: {}
      });
      setRefreshKey(prev => prev + 1);
      await loadQueryData(id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCloneQuery = async (id: string) => {
    try {
      const { id: newId } = await api.cloneQuery(id);
      setRefreshKey(prev => prev + 1);
      await loadQueryData(newId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteQuery = async (id: string) => {
    try {
      await api.deleteQuery(id);
      setRefreshKey(prev => prev + 1);
      if (selectedQuery?.id === id) {
        setSelectedQuery(null);
        setLineageConfig(null);
        setVersions([]);
        setActiveVersionId(null);
      }
    } catch (err) {
      console.error('Failed to delete query:', err);
    }
  };

  const handleSaveQuery = async () => {
    if (!selectedQuery) return;
    try {
      await api.updateQuery(selectedQuery.id, selectedQuery);
      setRefreshKey(prev => prev + 1);
      alert('Saved successfully');
    } catch (err) {
      console.error(err);
    }
  };

  const handleAnalyze = async (prompt?: string) => {
    if (!selectedQuery) return;
    setLoading(true);
    try {
      const config = await api.parseSql(selectedQuery.sqlText, prompt);
      setLineageConfig(config);
      
      // Save as new version
      const { id } = await api.createVersion(selectedQuery.id, JSON.stringify(config), prompt);
      const vData = await api.getVersions(selectedQuery.id);
      setVersions(vData);
      setActiveVersionId(id);
    } catch (err) {
      console.error(err);
      alert('Analysis failed: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleActivateVersion = async (v: DiagramVersion) => {
    if (!selectedQuery) return;
    try {
      await api.activateVersion(selectedQuery.id, v.id);
      setActiveVersionId(v.id);
      setLineageConfig(JSON.parse(v.jsonConfig));
      // Refresh versions list
      const vData = await api.getVersions(selectedQuery.id);
      setVersions(vData);
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfigChange = async (config: LineageConfig) => {
    if (!selectedQuery) return;
    setLineageConfig(config);
    try {
      if (activeVersionId) {
        await api.updateVersionConfig(activeVersionId, JSON.stringify(config));
        const vData = await api.getVersions(selectedQuery.id);
        setVersions(vData);
      } else {
        const { id } = await api.createVersion(selectedQuery.id, JSON.stringify(config), 'Saved Layout');
        setActiveVersionId(id);
        const vData = await api.getVersions(selectedQuery.id);
        setVersions(vData);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#F8FAFC] font-sans text-slate-800 overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
            title={sidebarOpen ? "Collapse Catalog Sidebar" : "Expand Catalog Sidebar"}
          >
            <PanelLeft size={18} />
          </button>
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <LayoutIcon className="text-white" size={18} />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-900 tracking-tight leading-none">SQL_VISION</h1>
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Lineage Studio</span>
          </div>
          {selectedQuery && (
            <>
              <div className="h-4 w-px bg-slate-200 mx-1" />
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700">{selectedQuery.name}</span>
                <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[10px] font-bold rounded border border-green-200 uppercase">Active</span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedQuery && (
            <>
              <button 
                onClick={() => handleCloneQuery(selectedQuery.id)}
                className="px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors font-medium"
              >
                Clone Query
              </button>
              <button 
                onClick={handleSaveQuery}
                className="px-4 py-1.5 text-xs text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 font-medium transition-colors"
              >
                Save Changes
              </button>
            </>
          )}
          <button 
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            className={cn(
              "p-1.5 rounded-lg border transition-colors ml-1",
              rightPanelOpen ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100"
            )}
            title={rightPanelOpen ? "Hide Inspector Panel" : "Show Inspector Panel"}
          >
            <PanelRight size={18} />
          </button>
        </div>
      </header>

      {/* Main App Area */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left Catalog Sidebar */}
        <div className={cn("h-full shrink-0 transition-all duration-200 overflow-hidden bg-white border-r border-slate-200", sidebarOpen ? "w-64" : "w-0 border-r-0")}>
          <div className="w-64 h-full">
            <Sidebar 
              selectedQueryId={selectedQuery?.id}
              onSelectQuery={(q) => loadQueryData(q.id)}
              onNewQuery={handleNewQuery}
              onCloneQuery={handleCloneQuery}
              onDeleteQuery={handleDeleteQuery}
              refreshKey={refreshKey}
            />
          </div>
        </div>

        {/* Center Resizable Editor & Lineage Diagram Workspace */}
        <div className="flex-1 h-full min-w-0">
          <Group direction="horizontal">
            <Panel defaultSize={40} minSize={25}>
              {selectedQuery ? (
                <SqlEditor 
                  sql={selectedQuery.sqlText}
                  onChange={(sql) => setSelectedQuery({ ...selectedQuery, sqlText: sql })}
                  onSave={handleSaveQuery}
                  onAnalyze={() => handleAnalyze()}
                  loading={loading}
                  lineageConfig={lineageConfig}
                  hoveredItem={activeItem}
                  onHoverItem={setHoveredItem}
                  selectedItem={selectedItem}
                  onSelectItem={handleSelectItem}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center bg-slate-50 text-slate-400 gap-3 p-6 text-center">
                  <Database size={32} className="text-slate-300" />
                  <p className="text-xs font-medium">No query selected</p>
                  <button 
                    onClick={handleNewQuery}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <Plus size={14} />
                    Create New Query
                  </button>
                </div>
              )}
            </Panel>

            <Separator className="w-1 bg-slate-100 hover:bg-blue-200 transition-colors cursor-col-resize" />

            <Panel defaultSize={60} minSize={30}>
              {selectedQuery ? (
                <Diagram 
                  config={lineageConfig}
                  onConfigChange={handleConfigChange}
                  hoveredItem={hoveredItem}
                  onHoverItem={setHoveredItem}
                  selectedItem={selectedItem}
                  onSelectItem={handleSelectItem}
                />
              ) : (
                <div className="h-full flex items-center justify-center bg-slate-50 text-slate-400 text-xs">
                  Lineage diagram preview area
                </div>
              )}
            </Panel>
          </Group>
        </div>

        {/* Right Inspector Panel (Properties & History) */}
        <div className={cn("h-full shrink-0 transition-all duration-200 overflow-hidden bg-white border-l border-slate-200", rightPanelOpen ? "w-72" : "w-0 border-l-0")}>
          <div className="w-72 h-full flex flex-col">
            <div className="flex bg-slate-50 border-b border-slate-200 shrink-0">
              <button 
                onClick={() => setRightPanelTab('meta')}
                className={cn(
                  "flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors",
                  rightPanelTab === 'meta' ? "text-blue-600 bg-white border-b-2 border-blue-600 font-bold" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <Database size={13} />
                Properties
              </button>
              <button 
                onClick={() => setRightPanelTab('history')}
                className={cn(
                  "flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors",
                  rightPanelTab === 'history' ? "text-blue-600 bg-white border-b-2 border-blue-600 font-bold" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <History size={13} />
                History
              </button>
            </div>
            <div className="flex-1 overflow-hidden bg-white">
              {selectedQuery ? (
                rightPanelTab === 'meta' ? (
                  <MetadataPanel query={selectedQuery} onChange={setSelectedQuery} />
                ) : (
                  <VersionPanel 
                    versions={versions} 
                    onSelect={handleActivateVersion}
                    selectedId={activeVersionId}
                  />
                )
              ) : (
                <div className="p-6 text-center text-slate-400 text-xs italic">
                  Select a query to edit properties or view generation history
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
