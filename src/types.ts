/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Project {
  id: string;
  name: string;
  createdAt: string;
}

export interface Query {
  id: string;
  projectId: string;
  name: string;
  description: string;
  sqlText: string;
  datasourceType: string;
  metadata: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface DiagramVersion {
  id: string;
  queryId: string;
  jsonConfig: string; // JSON string of LineageConfig
  isActive: boolean;
  promptUsed: string;
  versionNumber: number;
  createdAt: string;
}

export interface LineageNode {
  id: string;
  type: 'table' | 'subquery' | 'source' | string;
  data: {
    label: string;
    columns: string[];
    type?: string;
    [key: string]: any;
  };
  position: { x: number; y: number };
}

export interface LineageEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
  style?: Record<string, any>;
  labelStyle?: Record<string, any>;
  labelBgStyle?: Record<string, any>;
  labelBgPadding?: [number, number];
  [key: string]: any;
}

export interface LineageConfig {
  nodes: LineageNode[];
  edges: LineageEdge[];
}

export interface HoveredItem {
  type: 'table' | 'column';
  name: string;
  tableName?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}
