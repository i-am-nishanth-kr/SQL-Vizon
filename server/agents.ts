import { generateText, LanguageModel } from 'ai';
import { LineageConfig, ColumnTransformation, ColumnDependency, LineageNode, LineageEdge } from '../src/types';

/**
 * Strips <think>...</think> reasoning blocks, markdown code fences, and extracts pure JSON.
 */
export function cleanJsonText(text: string): string {
  // 1. Remove closed <think>...</think> blocks (including multiline)
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '');

  // 2. If an unclosed <think> tag exists, remove up to the first JSON bracket/brace
  if (cleaned.toLowerCase().includes('<think>')) {
    cleaned = cleaned.replace(/<think>[\s\S]*?(?=[{\[])/gi, '');
    cleaned = cleaned.replace(/<think>[\s\S]*/gi, '');
  }

  // 3. Remove markdown code block wrappers
  cleaned = cleaned.replace(/```json/gi, '').replace(/```/g, '').trim();

  // 4. Extract content between first '{' and last '}' or first '[' and last ']'
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');

  if (firstBrace !== -1 && lastBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  } else if (firstBracket !== -1 && lastBracket !== -1) {
    cleaned = cleaned.substring(firstBracket, lastBracket + 1);
  }

  return cleaned.trim();
}

export function parseModelJson(text: string): any {
  const cleaned = cleanJsonText(text);
  return JSON.parse(cleaned);
}

/**
 * Agent 1: SQL AST & Entity Extraction Agent
 * Extracts physical source tables, CTEs, subqueries, and output projection structures.
 */
export async function runEntityExtractionAgent(model: LanguageModel, sql: string, userInstruction?: string) {
  const prompt = `You are Agent 1: SQL AST & Entity Extraction Specialist.
Analyze the following SQL query and identify:
1. All physical source tables referenced in FROM and JOIN clauses.
2. All CTEs (WITH clause) and inline subqueries.
3. The final SELECT projection table (label: "output").
4. For each identified table/CTE/output, list ALL exposed column names.

SQL Query:
${sql}
${userInstruction ? `User Note: ${userInstruction}` : ''}

Output strictly valid JSON with format:
{
  "tables": [
    { "id": "customers", "label": "customers", "type": "source", "columns": ["customer_id", "first_name", "last_name", "email"] },
    { "id": "output", "label": "output", "type": "table", "columns": ["customer_id", "customer_name", "total_spent"] }
  ]
}`;

  const { text } = await generateText({ model, prompt });
  return parseModelJson(text);
}

/**
 * Agent 2: Column Lineage & Transformation Analysis Agent
 * Analyzes multi-layer column calculations, concatenations, aggregations, and expressions.
 */
export async function runTransformationAnalysisAgent(
  model: LanguageModel,
  sql: string,
  structureJson: any,
  userInstruction?: string
) {
  const prompt = `You are Agent 2: Multi-Layer Column Lineage & Transformation Specialist.
Given the SQL query and its structure summary below, perform deep column-level lineage and transformation analysis.

SQL Query:
${sql}

Extracted Query Structure:
${JSON.stringify(structureJson, null, 2)}
${userInstruction ? `User Instructions: ${userInstruction}` : ''}

Task:
For EVERY column in the final "output" table (and intermediate CTEs/subqueries if any), determine:
1. Column Dependencies: The exact underlying source table columns that feed into this column.
2. Column Transformation details:
   - "targetTable": Name of table/CTE/output.
   - "targetColumn": Name of target column.
   - "transformationType": One of ['concatenation', 'aggregation', 'calculation', 'case_conditional', 'cast', 'window_function', 'direct', 'custom'].
   - "expression": The exact SQL formula or expression (e.g., "CONCAT(c.first_name, ' ', c.last_name)" or "SUM(o.amount)").
   - "description": Clear natural language explanation of the transformation (e.g., "Concatenates first_name and last_name from customers table with a space separator to form customer_name.").
   - "sourceColumns": Array of { "table": "source_table_name", "column": "source_column_name" }.

Examples of transformation descriptions:
- Concatenation: "Concatenates 'first_name' and 'last_name' from 'customers' table to create 'customer_name'."
- Aggregation: "Calculates total amount spent by summing 'total_amount' from 'orders' table."
- Calculation: "Multiplies 'unit_price' and 'quantity' from 'order_items' table."
- Direct: "Direct projection of 'email' from 'customers' table."

Output strictly valid JSON:
{
  "columnDependencies": [
    {
      "targetTable": "output",
      "targetColumn": "customer_name",
      "sourceColumns": [
        { "table": "customers", "column": "first_name" },
        { "table": "customers", "column": "last_name" }
      ]
    }
  ],
  "transformations": [
    {
      "targetTable": "output",
      "targetColumn": "customer_name",
      "transformationType": "concatenation",
      "expression": "CONCAT(c.first_name, ' ', c.last_name)",
      "description": "Concatenates first_name and last_name from customers table with a space separator to form full customer name.",
      "sourceColumns": [
        { "table": "customers", "column": "first_name" },
        { "table": "customers", "column": "last_name" }
      ]
    },
    {
      "targetTable": "output",
      "targetColumn": "total_spent",
      "transformationType": "aggregation",
      "expression": "SUM(o.total_amount)",
      "description": "Calculates total order amount spent using SUM(total_amount) grouped by customer.",
      "sourceColumns": [
        { "table": "orders", "column": "total_amount" }
      ]
    }
  ]
}`;

  const { text } = await generateText({ model, prompt });
  return parseModelJson(text);
}

/**
 * Agent 3: Lineage Graph Synthesizer & Layout Agent
 * Assembles nodes, edges, position layout, columnDependencies, and transformations into LineageConfig.
 */
export async function runGraphSynthesizerAgent(
  model: LanguageModel,
  sql: string,
  structureJson: any,
  transformationJson: any,
  userInstruction?: string
): Promise<LineageConfig> {
  const prompt = `You are Agent 3: Lineage Graph Synthesizer & Visual Layout Specialist.
Synthesize the extracted query structure and transformation details into a complete, pristine React Flow LineageConfig JSON diagram layout.

SQL Query:
${sql}

Structure:
${JSON.stringify(structureJson, null, 2)}

Transformations & Column Lineage:
${JSON.stringify(transformationJson, null, 2)}
${userInstruction ? `User Note: ${userInstruction}` : ''}

Requirements:
1. Create "nodes" array:
   - Assign source tables x: 0 (spaced y: 0, 180, 360, etc.).
   - Assign CTEs / subqueries x: 320 (spaced y: 0, 180, etc.).
   - Assign final output table x: 650 (y: 50).
   - Each node MUST have:
     "id": "table_name",
     "type": "table" (or "source" or "subquery"),
     "position": { "x": number, "y": number },
     "data": { "label": "table_name", "columns": ["col1", "col2", ...] }
2. Create "edges" array connecting tables based on FROM/JOIN logic:
   - "id": "e_source_target", "source": "source_node_id", "target": "target_node_id", "label": "JOIN condition or FROM".
3. Include "columnDependencies" array verbatim or cleaned.
4. Include "transformations" array verbatim or cleaned.

Output strictly valid raw JSON with format:
{
  "nodes": [
    {
      "id": "users",
      "type": "table",
      "position": { "x": 0, "y": 0 },
      "data": { "label": "users", "columns": ["id", "first_name", "last_name", "email"] }
    },
    {
      "id": "output",
      "type": "table",
      "position": { "x": 650, "y": 0 },
      "data": { "label": "output", "columns": ["user_id", "customer_name", "total_spent"] }
    }
  ],
  "edges": [...],
  "columnDependencies": [...],
  "transformations": [...]
}`;

  const { text } = await generateText({ model, prompt });
  return parseModelJson(text);
}

/**
 * Orchestrator: Runs the Multi-Agent AI Pipeline
 */
export async function executeMultiAgentLineagePipeline(
  model: LanguageModel,
  sql: string,
  userInstruction?: string
): Promise<LineageConfig> {
  try {
    // Step 1: Agent 1 extracts query entities & columns
    const structureJson = await runEntityExtractionAgent(model, sql, userInstruction);

    // Step 2: Agent 2 analyzes transformations & multi-layer column dependencies
    const transformationJson = await runTransformationAnalysisAgent(model, sql, structureJson, userInstruction);

    // Step 3: Agent 3 synthesizes nodes, edges, layout, and exports final LineageConfig
    const finalConfig = await runGraphSynthesizerAgent(model, sql, structureJson, transformationJson, userInstruction);

    return finalConfig;
  } catch (error) {
    console.warn('Multi-agent pipeline failed or timed out, falling back to single-pass pipeline:', error);

    // Fallback: Single-pass structured generation
    const fallbackPrompt = `You are an expert SQL lineage and multi-layer column transformation analysis engine.
Parse the SQL query and generate a complete LineageConfig JSON including table nodes, edges, columnDependencies, and detailed column transformations.

SQL Query:
${sql}
${userInstruction ? `User Note: ${userInstruction}` : ''}

Output Schema:
{
  "nodes": [
    {
      "id": "customers",
      "type": "table",
      "data": { "label": "customers", "columns": ["first_name", "last_name"] },
      "position": { "x": 0, "y": 0 }
    },
    {
      "id": "output",
      "type": "table",
      "data": { "label": "output", "columns": ["customer_name", "total_spent"] },
      "position": { "x": 650, "y": 0 }
    }
  ],
  "edges": [
    { "id": "e1", "source": "customers", "target": "output", "label": "JOIN" }
  ],
  "columnDependencies": [
    {
      "targetTable": "output",
      "targetColumn": "customer_name",
      "sourceColumns": [
        { "table": "customers", "column": "first_name" },
        { "table": "customers", "column": "last_name" }
      ]
    }
  ],
  "transformations": [
    {
      "targetTable": "output",
      "targetColumn": "customer_name",
      "transformationType": "concatenation",
      "expression": "CONCAT(first_name, ' ', last_name)",
      "description": "Concatenates first_name and last_name from customers table.",
      "sourceColumns": [
        { "table": "customers", "column": "first_name" },
        { "table": "customers", "column": "last_name" }
      ]
    }
  ]
}

Output ONLY valid JSON without markdown code blocks.`;

    const { text } = await generateText({ model, prompt: fallbackPrompt });
    return parseModelJson(text);
  }
}

