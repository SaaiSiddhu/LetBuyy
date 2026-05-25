export type RuntimeDeploymentKind = 'next-app' | 'cloudflare-worker' | 'queue-worker' | 'scheduler' | 'reserved-service' | 'database';

export interface RuntimeDependencyEdge {
  fromRuntime: string;
  toRuntime: string;
  dependencyType: 'api' | 'queue' | 'event-stream' | 'database' | 'cache' | 'telemetry' | 'provider';
  requiredForStartup: boolean;
  healthCheckName: string;
}

export interface RuntimeDeploymentNode {
  runtimeName: string;
  runtimeRoot: string;
  deploymentKind: RuntimeDeploymentKind;
  platform: 'vercel' | 'cloudflare-workers' | 'supabase' | 'reserved' | 'mobile';
  regions: string[];
  startupOrder: number;
  scaling: {
    minInstances: number;
    maxInstances: number;
    concurrency: number;
    scaleMetric: 'request-rate' | 'queue-depth' | 'replay-lag' | 'workflow-lag' | 'manual';
  };
  health: {
    path?: string;
    checkName: string;
    timeoutMs: number;
    degradedAfterFailures: number;
    unavailableAfterFailures: number;
  };
}

export interface RuntimeDeploymentTopology {
  topologyVersion: number;
  generatedFrom: 'runtime-manifests';
  nodes: RuntimeDeploymentNode[];
  dependencies: RuntimeDependencyEdge[];
  telemetry: {
    tracePropagationHeader: 'traceparent';
    correlationHeader: 'X-Request-ID';
    metricsRuntime: string;
  };
}

export interface RuntimeStartupStep {
  runtimeName: string;
  runtimeRoot: string;
  startupOrder: number;
  waitsFor: string[];
  healthCheckName: string;
}

export interface RuntimeDeploymentValidationResult {
  valid: boolean;
  errors: string[];
  startupPlan: RuntimeStartupStep[];
}

export function buildRuntimeStartupPlan(topology: RuntimeDeploymentTopology): RuntimeStartupStep[] {
  return [...topology.nodes]
    .sort((left, right) => {
      if (left.startupOrder !== right.startupOrder) return left.startupOrder - right.startupOrder;
      return left.runtimeName.localeCompare(right.runtimeName);
    })
    .map((node) => ({
      runtimeName: node.runtimeName,
      runtimeRoot: node.runtimeRoot,
      startupOrder: node.startupOrder,
      waitsFor: topology.dependencies
        .filter((edge) => edge.fromRuntime === node.runtimeName && edge.requiredForStartup)
        .map((edge) => edge.toRuntime)
        .sort(),
      healthCheckName: node.health.checkName,
    }));
}

export function validateDeploymentTopology(topology: RuntimeDeploymentTopology): RuntimeDeploymentValidationResult {
  const errors: string[] = [];
  const runtimeNames = new Set(topology.nodes.map((node) => node.runtimeName));
  const runtimeRoots = new Set<string>();

  for (const node of topology.nodes) {
    if (runtimeRoots.has(node.runtimeRoot)) {
      errors.push(`Duplicate runtimeRoot in deployment topology: ${node.runtimeRoot}`);
    }
    runtimeRoots.add(node.runtimeRoot);

    if (node.scaling.minInstances < 0 || node.scaling.maxInstances < node.scaling.minInstances) {
      errors.push(`Invalid scaling range for ${node.runtimeName}`);
    }

    if (node.scaling.concurrency < 1) {
      errors.push(`Invalid runtime concurrency for ${node.runtimeName}`);
    }

    if (node.regions.length === 0) {
      errors.push(`Runtime ${node.runtimeName} must declare at least one deployment region`);
    }
  }

  for (const edge of topology.dependencies) {
    if (!runtimeNames.has(edge.fromRuntime)) errors.push(`Unknown dependency source runtime: ${edge.fromRuntime}`);
    if (!runtimeNames.has(edge.toRuntime)) errors.push(`Unknown dependency target runtime: ${edge.toRuntime}`);
    if (edge.fromRuntime === edge.toRuntime) errors.push(`Runtime cannot depend on itself: ${edge.fromRuntime}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    startupPlan: buildRuntimeStartupPlan(topology),
  };
}

export class DeploymentTopologyRuntime {
  validate(topology: RuntimeDeploymentTopology): RuntimeDeploymentValidationResult {
    return validateDeploymentTopology(topology);
  }

  startupPlan(topology: RuntimeDeploymentTopology): RuntimeStartupStep[] {
    return buildRuntimeStartupPlan(topology);
  }
}
