import { LineageConfig, HoveredItem, LineageNode, ColumnSource } from '../types';

export interface ResolvedHighlight {
  columnKeys: Set<string>;   // "table_name::column_name" in lowercase
  columnNames: Set<string>;  // "column_name" in lowercase
  tableNames: Set<string>;   // "table_name" in lowercase
}

/**
 * Builds a mapping from any table name / alias / ID variation to the set of all equivalent table names
 */
function buildTableSynonymMap(nodes: LineageNode[] = []): Map<string, Set<string>> {
  const synonymMap = new Map<string, Set<string>>();

  nodes.forEach(node => {
    const equivalents = new Set<string>();

    if (node.id) {
      equivalents.add(node.id.trim().toLowerCase());
    }

    if (node.data?.label) {
      const label = node.data.label.trim().toLowerCase();
      equivalents.add(label);

      // Extract words e.g. "users u" -> ["users", "u"]
      const words = label.split(/[\s()]+/).filter(w => w && w !== 'as');
      words.forEach(w => equivalents.add(w));
    }

    // Special handling for output / result nodes
    const isOutputNode = node.type === 'table' && (
      node.data?.label?.toLowerCase().includes('output') ||
      node.data?.label?.toLowerCase().includes('result') ||
      node.id.toLowerCase().includes('output') ||
      node.id.toLowerCase().includes('result') ||
      (node.position && node.position.x >= 400)
    );

    if (isOutputNode) {
      ['output', 'result', 'final_output', 'select', 'query', 'final_result'].forEach(s => equivalents.add(s));
    }

    // Register all equivalents in synonymMap so every variation returns the full set of equivalent names
    equivalents.forEach(eq => {
      if (!synonymMap.has(eq)) synonymMap.set(eq, new Set());
      const currentSet = synonymMap.get(eq)!;
      equivalents.forEach(e => currentSet.add(e));
    });
  });

  return synonymMap;
}

/**
 * Resolves column dependencies and highlights using graph traversal based on
 * AI-generated columnDependencies in LineageConfig.
 */
export function resolveHighlights(
  config: LineageConfig | null | undefined,
  hoveredItem: HoveredItem | null | undefined
): ResolvedHighlight {
  const result: ResolvedHighlight = {
    columnKeys: new Set(),
    columnNames: new Set(),
    tableNames: new Set(),
  };

  if (!hoveredItem || !hoveredItem.name) {
    return result;
  }

  const hName = hoveredItem.name.trim().toLowerCase();
  const hTableRaw = hoveredItem.tableName ? hoveredItem.tableName.trim().toLowerCase() : null;

  const synonymMap = buildTableSynonymMap(config?.nodes || []);

  if (hoveredItem.type === 'table') {
    result.tableNames.add(hName);
    const synonyms = synonymMap.get(hName);
    if (synonyms) {
      synonyms.forEach(s => result.tableNames.add(s));
    }
    return result;
  }

  // Type is 'column'
  const columnDeps = config?.columnDependencies || [];
  const adj = new Map<string, Set<string>>();

  const addEdge = (a: string, b: string) => {
    if (!a || !b) return;
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  };

  const makeKey = (t: string, c: string) => `${t.trim().toLowerCase()}::${c.trim().toLowerCase()}`;

  // Populate graph from AI columnDependencies and transformations using table synonyms
  const processEdgeList = (list: { targetTable?: string; targetColumn?: string; sourceColumns?: ColumnSource[] }[]) => {
    list.forEach(item => {
      if (!item.targetTable || !item.targetColumn) return;
      const targetCol = item.targetColumn.trim().toLowerCase();
      const rawTargetTable = item.targetTable.trim().toLowerCase();
      const targetTables = synonymMap.get(rawTargetTable) || new Set([rawTargetTable]);

      (item.sourceColumns || []).forEach(src => {
        if (!src.table || !src.column) return;
        const srcCol = src.column.trim().toLowerCase();
        const rawSrcTable = src.table.trim().toLowerCase();
        const srcTables = synonymMap.get(rawSrcTable) || new Set([rawSrcTable]);

        targetTables.forEach(tTable => {
          const targetKey = makeKey(tTable, targetCol);
          srcTables.forEach(sTable => {
            const srcKey = makeKey(sTable, srcCol);
            addEdge(targetKey, srcKey);
          });
        });
      });
    });
  };

  processEdgeList(columnDeps);
  if (config?.transformations) {
    processEdgeList(config.transformations);
  }

  // Determine starting node keys for BFS traversal
  const startKeys = new Set<string>();

  const hTableSet = hTableRaw
    ? (synonymMap.get(hTableRaw) || new Set([hTableRaw]))
    : null;

  if (hTableSet) {
    hTableSet.forEach(t => {
      startKeys.add(makeKey(t, hName));
    });
  }

  // Search graph keys for matching column name and table synonyms
  adj.forEach((_, key) => {
    const [t, c] = key.split('::');
    if (c === hName && (!hTableSet || hTableSet.has(t))) {
      startKeys.add(key);
    }
  });

  // Search nodes in config if key not in graph
  if (config?.nodes) {
    config.nodes.forEach(node => {
      const nodeLabel = (node.data?.label || node.id).toLowerCase();
      const nodeTables = synonymMap.get(nodeLabel) || new Set([nodeLabel]);

      if (!hTableSet || Array.from(nodeTables).some(t => hTableSet.has(t))) {
        (node.data?.columns || []).forEach(col => {
          if (col.toLowerCase() === hName) {
            nodeTables.forEach(t => startKeys.add(makeKey(t, col)));
          }
        });
      }
    });
  }

  // Always seed hovered name & table
  result.columnNames.add(hName);
  if (hTableSet) {
    hTableSet.forEach(t => {
      result.columnKeys.add(makeKey(t, hName));
      result.tableNames.add(t);
    });
  }

  // Perform BFS traversal to find all linked column dependencies
  const visited = new Set<string>();
  const queue: string[] = Array.from(startKeys);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    result.columnKeys.add(current);

    const parts = current.split('::');
    if (parts.length === 2) {
      const [t, c] = parts;
      if (t) {
        result.tableNames.add(t);
        const synonyms = synonymMap.get(t);
        if (synonyms) synonyms.forEach(s => result.tableNames.add(s));
      }
      if (c) {
        result.columnNames.add(c);
      }
    }

    const neighbors = adj.get(current);
    if (neighbors) {
      neighbors.forEach(nbr => {
        if (!visited.has(nbr)) {
          queue.push(nbr);
        }
      });
    }
  }

  return result;
}

