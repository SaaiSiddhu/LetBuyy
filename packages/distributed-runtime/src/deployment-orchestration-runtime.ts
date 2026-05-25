import type { RuntimeDeploymentTopology, RuntimeStartupStep } from './deployment-topology-runtime';
import { buildRuntimeStartupPlan } from './deployment-topology-runtime';

export interface DeploymentOrchestrationStage {
  environment: 'local' | 'dev' | 'staging' | 'production';
  stageName: string;
  order: number;
  requiredGates: string[];
  runtimeRoots: string[];
}

export interface DeploymentOrchestrationPlan {
  environment: DeploymentOrchestrationStage['environment'];
  stages: DeploymentOrchestrationStage[];
  activation: RuntimeStartupStep[];
}

export function buildDeploymentOrchestrationPlan(
  environment: DeploymentOrchestrationStage['environment'],
  topology: RuntimeDeploymentTopology,
  stages: DeploymentOrchestrationStage[],
): DeploymentOrchestrationPlan {
  const orderedStages = [...stages].sort((left, right) => {
    if (left.order !== right.order) return left.order - right.order;
    return left.stageName.localeCompare(right.stageName);
  });
  const activation = buildRuntimeStartupPlan(topology);
  const knownRuntimeRoots = new Set(topology.nodes.map((node) => node.runtimeRoot));

  for (const stage of orderedStages) {
    if (stage.environment !== environment) {
      throw new Error(`Deployment stage ${stage.stageName} belongs to ${stage.environment}, not ${environment}`);
    }
    if (stage.requiredGates.length === 0) {
      throw new Error(`Deployment stage ${stage.stageName} must declare gates`);
    }
    for (const runtimeRoot of stage.runtimeRoots) {
      if (!knownRuntimeRoots.has(runtimeRoot)) {
        throw new Error(`Deployment stage ${stage.stageName} references unknown runtime root ${runtimeRoot}`);
      }
    }
  }

  return {
    environment,
    stages: orderedStages,
    activation,
  };
}

export function assertDeploymentActivationOrdered(plan: DeploymentOrchestrationPlan): void {
  let previousOrder = -Infinity;
  for (const step of plan.activation) {
    if (step.startupOrder < previousOrder) {
      throw new Error(`Deployment activation order regressed at ${step.runtimeName}`);
    }
    previousOrder = step.startupOrder;
  }
}
