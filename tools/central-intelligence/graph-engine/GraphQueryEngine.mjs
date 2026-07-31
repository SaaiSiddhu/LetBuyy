/**
 * LCIS Graph Intelligence Engine — GraphQueryEngine
 * Executes GraphRAG global/local queries and parses results into structured JSON.
 * GraphRAG is a hidden implementation detail; never expose it to callers.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GRAPHRAG_ROOT = path.join(__dirname, 'graphrag');
const QUERY_TIMEOUT_MS = 60_000; // 60 s per query

/**
 * Run a graphrag query and return parsed output.
 * @param {string} question
 * @param {'global'|'local'} method
 * @returns {{success:boolean,answer:string,entities:string[],method:string,raw:string,error?:string}}
 */
function runQuery(question, method) {
  const result = spawnSync(
    'python3',
    ['-m', 'graphrag', 'query', '--root', GRAPHRAG_ROOT, '--method', method, '--query', question],
    {
      timeout: QUERY_TIMEOUT_MS,
      encoding: 'utf8',
      env: { ...process.env },
    }
  );

  const raw = (result.stdout || '').trim();
  const stderr = (result.stderr || '').trim();

  if (result.status !== 0) {
    return {
      success: false,
      answer: '',
      entities: [],
      method,
      raw,
      error: stderr || `graphrag query exited with code ${result.status}`,
    };
  }

  // Extract the answer body — GraphRAG prints "SUCCESS: Global Search Response:" or "SUCCESS: Local Search Response:"
  // then the actual answer on subsequent lines.
  const successPattern = /SUCCESS:\s*(?:Global|Local)\s+Search\s+Response:\s*/i;
  let answer = raw;
  const matchIdx = raw.search(successPattern);
  if (matchIdx !== -1) {
    answer = raw.slice(matchIdx).replace(successPattern, '').trim();
  }

  // Extract entity names mentioned — crude heuristic: bold markdown tokens.
  const entityMatches = [...answer.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1].trim());
  const entities = [...new Set(entityMatches)];

  return { success: true, answer, entities, method, raw };
}

class GraphQueryEngine {
  /**
   * Run a global community-level query (broad, synthesised across entire graph).
   * @param {string} question
   */
  queryGlobal(question) {
    return runQuery(question, 'global');
  }

  /**
   * Run a local entity-level query (precise, anchored to nearby nodes).
   * @param {string} question
   */
  queryLocal(question) {
    return runQuery(question, 'local');
  }

  /**
   * Find a named entity and return its description and relationships.
   * @param {string} name
   */
  findEntity(name) {
    return runQuery(`What is ${name}? Describe its role, relationships, and importance.`, 'local');
  }

  /**
   * Return the blast-radius impact of changing an entity.
   * @param {string} entityName
   */
  getImpact(entityName) {
    return runQuery(
      `What breaks if ${entityName} fails or changes? List all affected systems, services, merchants, and payments.`,
      'local'
    );
  }

  /**
   * Return all direct dependencies of an entity.
   * @param {string} entityName
   */
  getDependencies(entityName) {
    return runQuery(
      `What does ${entityName} depend on? List all upstream services, tables, RPCs, queues, and external systems.`,
      'local'
    );
  }

  /**
   * Return all entities that directly or indirectly relate to the given entity.
   * @param {string} entityName
   */
  getRelationships(entityName) {
    return runQuery(
      `List all entities, systems, and domains that have a relationship with ${entityName}. Include type of relationship.`,
      'local'
    );
  }

  /**
   * Health check: verify graphrag CLI is reachable and index is built.
   * @returns {{healthy:boolean,indexRoot:string,error?:string}}
   */
  healthCheck() {
    const result = spawnSync('python3', ['-m', 'graphrag', '--help'], {
      timeout: 10_000,
      encoding: 'utf8',
    });
    const indexRoot = GRAPHRAG_ROOT;
    if (result.status !== 0) {
      return { healthy: false, indexRoot, error: 'graphrag CLI not reachable' };
    }
    return { healthy: true, indexRoot };
  }

  /**
   * General-purpose query with explicit method selection.
   * @param {string} question
   * @param {'global'|'local'} method
   */
  query(question, method) {
    if (method !== 'global' && method !== 'local') {
      return {
        success: false,
        answer: '',
        entities: [],
        method,
        raw: '',
        error: `Unknown method "${method}". Must be "global" or "local".`,
      };
    }
    return runQuery(question, method);
  }
}

export default new GraphQueryEngine();
