import type { RuntimeHealthContract } from './operations-runtime';
import { runtimeOverallHealth } from './operations-runtime';

export interface RuntimeAlertRule {
  alertName: string;
  runtimeName: string;
  metricName: string;
  threshold: number;
  comparison: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
  severity: 'info' | 'warning' | 'critical';
  runbook: string;
}

export interface RuntimeAlertEvaluation {
  alertName: string;
  firing: boolean;
  severity: RuntimeAlertRule['severity'];
  observedValue: number;
  reason: string;
}

export interface OperationalIncidentMetadata {
  incidentId: string;
  title: string;
  severity: 'sev1' | 'sev2' | 'sev3' | 'sev4';
  affectedRuntimes: string[];
  affectedTenants: string[];
  startedAt: string;
  status: 'investigating' | 'mitigating' | 'resolved';
  runbook: string;
}

export function evaluateRuntimeAlert(rule: RuntimeAlertRule, observedValue: number): RuntimeAlertEvaluation {
  const firing =
    rule.comparison === 'gt'
      ? observedValue > rule.threshold
      : rule.comparison === 'gte'
        ? observedValue >= rule.threshold
        : rule.comparison === 'lt'
          ? observedValue < rule.threshold
          : rule.comparison === 'lte'
            ? observedValue <= rule.threshold
            : observedValue === rule.threshold;

  return {
    alertName: rule.alertName,
    firing,
    severity: rule.severity,
    observedValue,
    reason: firing ? `${rule.metricName} crossed ${rule.comparison} ${rule.threshold}` : `${rule.metricName} is within threshold`,
  };
}

export function summarizeRuntimeHealth(runtimeName: string, dependencies: RuntimeHealthContract['dependencies']): RuntimeHealthContract {
  return {
    runtimeName,
    status: runtimeOverallHealth(dependencies),
    checkedAt: new Date().toISOString(),
    dependencies,
  };
}

export class ObservabilityOperationsRuntime {
  evaluateAlert(rule: RuntimeAlertRule, observedValue: number): RuntimeAlertEvaluation {
    return evaluateRuntimeAlert(rule, observedValue);
  }

  health(runtimeName: string, dependencies: RuntimeHealthContract['dependencies']): RuntimeHealthContract {
    return summarizeRuntimeHealth(runtimeName, dependencies);
  }
}
