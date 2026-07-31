/**
 * OperationsEngine — the LCOS composition facade. Wires the lcis-core engine + the eight
 * operations services and composes them into one operations report that answers the canonical
 * questions ("what is healthy / degraded / failing / changed / at risk / to investigate?").
 *
 * Pure composition over lcis-core + the LCOS services — no new engine, no duplicated logic.
 * LCOS observes; it never executes, mutates, or deploys.
 */
import { type LcisEngine, getEngine } from '@letbuyy/lcis-core';
import { CommerceOperationsService } from './commerce/index';
import { CustomerOperationsService } from './customer/index';
import { DeploymentOperationsService } from './deployment/index';
import { ForecastOperationsService } from './forecast/index';
import { IncidentOperationsService } from './incident/index';
import { MerchantOperationsService } from './merchant/index';
import { RuntimeOperationsService } from './runtime/index';
import { SecurityOperationsService } from './security/index';
import {
  OperationalHealthCalculator,
  defaultNow,
  operations,
  type AreaReport,
  type CommerceReport,
  type CustomerReport,
  type DeploymentReport,
  type ForecastReport,
  type IncidentReport,
  type MerchantReport,
  type OperationsReport,
  type RuntimeReport,
  type SecurityOpsReport,
} from './shared/index';

function uniqCap(xs: string[], cap = 12): string[] {
  return [...new Set(xs)].slice(0, cap);
}

export interface OperationsEngine {
  readonly core: LcisEngine;
  readonly runtimeOps: RuntimeOperationsService;
  readonly commerceOps: CommerceOperationsService;
  readonly merchantOps: MerchantOperationsService;
  readonly customerOps: CustomerOperationsService;
  readonly deploymentOps: DeploymentOperationsService;
  readonly incidentOps: IncidentOperationsService;
  readonly securityOps: SecurityOperationsService;
  readonly forecastOps: ForecastOperationsService;
  runtime(): RuntimeReport;
  commerce(): CommerceReport;
  merchant(): MerchantReport;
  customer(): CustomerReport;
  deployment(): DeploymentReport;
  incident(): IncidentReport;
  security(): SecurityOpsReport;
  forecast(): ForecastReport;
  /** The composite operations report — answers "what is happening right now?". */
  operationsReport(): OperationsReport;
}

export interface OperationsEngineOptions {
  readonly core?: LcisEngine;
  readonly now?: () => string;
}

class OperationsEngineImpl implements OperationsEngine {
  readonly core: LcisEngine;
  readonly runtimeOps: RuntimeOperationsService;
  readonly commerceOps: CommerceOperationsService;
  readonly merchantOps: MerchantOperationsService;
  readonly customerOps: CustomerOperationsService;
  readonly deploymentOps: DeploymentOperationsService;
  readonly incidentOps: IncidentOperationsService;
  readonly securityOps: SecurityOperationsService;
  readonly forecastOps: ForecastOperationsService;
  private readonly now: () => string;
  private readonly healthCalc = new OperationalHealthCalculator();

  constructor(opts: OperationsEngineOptions = {}) {
    this.core = opts.core ?? getEngine();
    this.now = opts.now ?? defaultNow;
    this.runtimeOps = new RuntimeOperationsService(this.core, this.now);
    this.commerceOps = new CommerceOperationsService(this.core, this.now);
    this.merchantOps = new MerchantOperationsService(this.core, this.now);
    this.customerOps = new CustomerOperationsService(this.core, this.now);
    this.deploymentOps = new DeploymentOperationsService(this.core, this.now);
    this.incidentOps = new IncidentOperationsService(this.core, this.now);
    this.securityOps = new SecurityOperationsService(this.core, this.now);
    this.forecastOps = new ForecastOperationsService(this.core, this.now);
  }

  runtime(): RuntimeReport {
    return this.runtimeOps.generateRuntimeReport();
  }
  commerce(): CommerceReport {
    return this.commerceOps.generateCommerceReport();
  }
  merchant(): MerchantReport {
    return this.merchantOps.generateMerchantReport();
  }
  customer(): CustomerReport {
    return this.customerOps.generateCustomerReport();
  }
  deployment(): DeploymentReport {
    return this.deploymentOps.generateDeploymentReport();
  }
  incident(): IncidentReport {
    return this.incidentOps.generateIncidentReport();
  }
  security(): SecurityOpsReport {
    return this.securityOps.generateSecurityReport();
  }
  forecast(): ForecastReport {
    return this.forecastOps.generateForecastReport();
  }

  operationsReport(): OperationsReport {
    const runtime = this.runtime();
    const commerce = this.commerce();
    const merchant = this.merchant();
    const customer = this.customer();
    const deployment = this.deployment();
    const incident = this.incident();
    const security = this.security();
    const forecast = this.forecast();
    const all: readonly AreaReport[] = [runtime, commerce, merchant, customer, deployment, incident, security, forecast];

    const allFindings = all.flatMap((r) => r.findings);
    const allSignals = all.flatMap((r) => r.signals);
    const health = this.healthCalc.forArea('overall', allFindings, allSignals);

    const answers = {
      healthy: uniqCap(all.filter((r) => r.health.band === 'healthy').map((r) => `${r.area} healthy`)),
      degraded: uniqCap(all.filter((r) => r.health.band === 'degraded').map((r) => `${r.area} degraded`)),
      failing: uniqCap(all.filter((r) => r.health.band === 'failing').map((r) => `${r.area} failing`)),
      changed: uniqCap(deployment.findings.map((f) => `[deployment] ${f.title}`)),
      atRisk: uniqCap(
        allFindings.filter((f) => f.severity === 'critical' || f.severity === 'high').map((f) => `[${f.area}] ${f.title}`),
      ),
      investigate: uniqCap([
        ...allFindings
          .filter((f) => f.status === 'CONNECTED' && (f.severity === 'critical' || f.severity === 'high'))
          .map((f) => `[${f.area}] ${f.title} (${f.subject})`),
        ...(allSignals.some((s) => s.status === 'NOT_CONNECTED')
          ? ['Wire live telemetry adapters to confirm runtime/commerce/customer signals (NOT_CONNECTED)']
          : []),
      ]),
    };

    const evidence = all.flatMap((r) => r.evidence.slice(0, 1));
    const connected = allSignals.filter((s) => s.status === 'CONNECTED').length;
    const notConnected = allSignals.filter((s) => s.status !== 'CONNECTED').length;
    return operations(
      {
        runtime,
        commerce,
        merchant,
        customer,
        deployment,
        incident,
        security,
        forecast,
        health,
        answers,
        summary:
          `Operations: ${answers.failing.length} failing, ${answers.degraded.length} degraded, ` +
          `${answers.atRisk.length} at-risk finding(s); ${connected} live signal(s) connected, ` +
          `${notConnected} NOT_CONNECTED. ${answers.investigate.length} item(s) to investigate.`,
      },
      { evidence, now: this.now, liveConnected: false },
    );
  }
}

export function createOperationsEngine(opts?: OperationsEngineOptions): OperationsEngine {
  return new OperationsEngineImpl(opts);
}

let shared: OperationsEngine | null = null;

/** Process-wide singleton LCOS engine (reuses the lcis-core singleton + its warm graph). */
export function getOperationsEngine(opts?: OperationsEngineOptions): OperationsEngine {
  if (shared === null) shared = createOperationsEngine(opts);
  return shared;
}

/** Reset the singleton (tests only). */
export function resetOperationsEngine(): void {
  shared = null;
}
