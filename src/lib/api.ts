import { Project, Query, DiagramVersion, LineageConfig } from '../types';

export const api = {
  // Projects
  async getProjects(): Promise<Project[]> {
    const res = await fetch('/api/projects');
    return res.json();
  },
  async createProject(name: string): Promise<Project> {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return res.json();
  },

  // Queries
  async getQueries(options?: { projectId?: string; search?: string } | string, searchArg?: string): Promise<Query[]> {
    let projectId: string | undefined;
    let search: string | undefined;

    if (typeof options === 'object' && options !== null) {
      projectId = options.projectId;
      search = options.search;
    } else {
      projectId = options as string | undefined;
      search = searchArg;
    }

    const params = new URLSearchParams();
    if (projectId) params.append('projectId', projectId);
    if (search) params.append('search', search);

    const res = await fetch(`/api/queries?${params.toString()}`);
    const data = await res.json();
    return data.map((q: any) => ({
      id: q.id,
      projectId: q.project_id,
      name: q.name,
      description: q.description,
      sqlText: q.sql_text,
      datasourceType: q.datasource_type,
      metadata: typeof q.metadata === 'string' ? JSON.parse(q.metadata || '{}') : (q.metadata || {}),
      createdAt: q.created_at,
      updatedAt: q.updated_at
    }));
  },
  async getQuery(id: string): Promise<Query> {
    const res = await fetch(`/api/queries/${id}`);
    const q = await res.json();
    return {
      id: q.id,
      projectId: q.project_id,
      name: q.name,
      description: q.description,
      sqlText: q.sql_text,
      datasourceType: q.datasource_type,
      metadata: JSON.parse(q.metadata),
      createdAt: q.created_at,
      updatedAt: q.updated_at
    };
  },
  async createQuery(data: Partial<Query>): Promise<{ id: string }> {
    const res = await fetch('/api/queries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async updateQuery(id: string, data: Partial<Query>): Promise<void> {
    await fetch(`/api/queries/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },
  async cloneQuery(id: string): Promise<{ id: string }> {
    const res = await fetch(`/api/queries/${id}/clone`, { method: 'POST' });
    return res.json();
  },
  async deleteQuery(id: string): Promise<void> {
    await fetch(`/api/queries/${id}`, { method: 'DELETE' });
  },

  // Versions
  async getVersions(queryId: string): Promise<DiagramVersion[]> {
    const res = await fetch(`/api/queries/${queryId}/versions`);
    const data = await res.json();
    return data.map((v: any) => ({
      id: v.id,
      queryId: v.query_id,
      jsonConfig: v.json_config,
      isActive: Boolean(v.is_active),
      promptUsed: v.prompt_used,
      versionNumber: v.version_number,
      createdAt: v.created_at
    }));
  },
  async createVersion(queryId: string, jsonConfig: string, promptUsed?: string): Promise<{ id: string; versionNumber: number }> {
    const res = await fetch(`/api/queries/${queryId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonConfig, promptUsed }),
    });
    return res.json();
  },
  async activateVersion(queryId: string, versionId: string): Promise<void> {
    await fetch(`/api/queries/${queryId}/versions/${versionId}/activate`, { method: 'PUT' });
  },
  async updateVersionConfig(versionId: string, jsonConfig: string): Promise<void> {
    const res = await fetch(`/api/versions/${versionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonConfig }),
    });
    if (!res.ok) throw new Error('Failed to update version config');
  },

  // AI
  async parseSql(sql: string, prompt?: string): Promise<LineageConfig> {
    const res = await fetch('/api/ai/parse-sql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, prompt }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to parse SQL');
    }
    return res.json();
  },
  async generateSql(prompt: string): Promise<{ sql: string }> {
    const res = await fetch('/api/ai/generate-sql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to generate SQL');
    }
    return res.json();
  }
};
