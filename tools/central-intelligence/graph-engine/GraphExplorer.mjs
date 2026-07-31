/**
 * LCIS Graph Intelligence Engine — GraphExplorer
 * High-level exploration API built on top of GraphQueryEngine.
 * Routes questions intelligently between global and local query methods.
 */

import GraphQueryEngine from './GraphQueryEngine.mjs';

/**
 * Determine whether a question is better served by a global or local query.
 * Global: broad, community-level, trend, or "overall" questions.
 * Local: specific entity, "what breaks", "why", incident, or deployment questions.
 * @param {string} question
 * @returns {'global'|'local'}
 */
function routeMethod(question) {
  const q = question.toLowerCase();

  const globalSignals = [
    'overall',
    'architecture',
    'what are the main',
    'summarise',
    'summarize',
    'overview',
    'describe the system',
    'how does the platform',
    'what domains',
    'trends',
    'strategy',
    'all services',
    'entire',
  ];

  const localSignals = [
    'what breaks',
    'impact',
    'dependency',
    'depends on',
    'who owns',
    'owner',
    'incident',
    'deployment',
    'rollback',
    'merchant',
    'customer',
    'payment',
    'order',
    'why was',
    'why is',
    'trace',
    'specific',
    'table',
    'rpc',
    'queue',
    'worker',
    'route',
    'fix',
    'repair',
    'recover',
  ];

  const globalScore = globalSignals.filter((s) => q.includes(s)).length;
  const localScore = localSignals.filter((s) => q.includes(s)).length;

  return localScore >= globalScore ? 'local' : 'global';
}

class GraphExplorer {
  /**
   * Return a plain-language explanation of a named entity.
   * @param {string} name
   * @returns {ReturnType<GraphQueryEngine['queryLocal']>}
   */
  explainEntity(name) {
    return GraphQueryEngine.queryLocal(
      `Explain ${name}: what it is, its purpose, its role in the LetBuyy platform, ` +
        `which domain it belongs to, who owns it, and what depends on it.`
    );
  }

  /**
   * Return blast-radius information: what breaks if the entity fails or changes.
   * @param {string} entityName
   * @returns {ReturnType<GraphQueryEngine['queryLocal']>}
   */
  whatBreaksIf(entityName) {
    return GraphQueryEngine.queryLocal(
      `What breaks if ${entityName} fails, is changed, or is removed? ` +
        `List all affected services, RPCs, tables, queues, workers, deployments, merchants, ` +
        `customers, revenue flows, and downstream systems.`
    );
  }

  /**
   * Explain the architectural reason an entity was built the way it was.
   * @param {string} entityName
   * @returns {ReturnType<GraphQueryEngine['queryGlobal']>}
   */
  whyBuilt(entityName) {
    return GraphQueryEngine.queryGlobal(
      `Why was ${entityName} built this way? What architectural decisions, trade-offs, ` +
        `constraints, or business requirements drove its design?`
    );
  }

  /**
   * Identify which merchants are affected by an ongoing or past incident.
   * @param {string} incidentEntity - entity at the centre of the incident
   * @returns {ReturnType<GraphQueryEngine['queryLocal']>}
   */
  getAffectedMerchants(incidentEntity) {
    return GraphQueryEngine.queryLocal(
      `Which merchants and stores are affected when ${incidentEntity} is failing or degraded? ` +
        `List merchant IDs, store slugs, or tenant groups if known. ` +
        `Describe the customer and revenue impact.`
    );
  }

  /**
   * Trace the downstream impact of a deployment event.
   * @param {string} deploymentId - free-text deployment identifier or name
   * @returns {ReturnType<GraphQueryEngine['queryLocal']>}
   */
  traceDeploymentImpact(deploymentId) {
    return GraphQueryEngine.queryLocal(
      `Trace the impact of deployment "${deploymentId}". ` +
        `What services, workers, queues, tables, merchants, and customers could be affected? ` +
        `What is the rollback strategy if this deployment causes an incident?`
    );
  }

  /**
   * Answer an arbitrary question, routing to global or local based on question shape.
   * @param {string} question
   * @returns {ReturnType<GraphQueryEngine['query']>}
   */
  answerQuestion(question) {
    const method = routeMethod(question);
    return GraphQueryEngine.query(question, method);
  }
}

export default new GraphExplorer();
