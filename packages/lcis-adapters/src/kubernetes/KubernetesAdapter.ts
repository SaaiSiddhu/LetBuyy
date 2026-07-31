/**
 * KubernetesAdapter — READ-ONLY observer of a Kubernetes cluster.
 *
 * Reads: cluster version, namespaces, pods (page 1), deployments (page 1).
 * Uses the injected ReadOnlyHttpClient (GET only).
 * No mutation is possible — the interface exposes only this.http.get(...).
 *
 * Honesty contract:
 *  - Credentials absent → NOT_CONNECTED, names KUBE_API_URL and KUBE_TOKEN.
 *  - KUBE_TOKEN goes only into the Authorization header; it is never cited in evidence.
 *  - Pod and Deployment lists are paginated; only the first page (limit=100) is observed.
 *    This is stated honestly in the evidence detail.
 *  - Confidence capped at 0.85 (page-1 observation only; cluster state may have more).
 */
import { type Evidence } from '@letbuyy/lcis-core';
import {
  AdapterBase,
  type AdapterDeps,
  type AdapterMetadata,
  EvidenceBuilder,
  type GatherResult,
  type LiveFact,
  type VerificationFinding,
} from '../shared/index';
import {
  KubeVersionResponseSchema,
  KubeNamespaceListSchema,
  KubePodListSchema,
  KubeDeploymentListSchema,
  type KubePod,
  type KubeDeployment,
  type KubernetesPayload,
} from './types';

const SOURCE = 'Kubernetes API server';

export class KubernetesAdapter extends AdapterBase {
  constructor(deps: AdapterDeps) {
    super(deps);
  }

  metadata(): AdapterMetadata {
    return {
      name: 'kubernetes',
      displayName: 'Kubernetes',
      requiredEnv: ['KUBE_API_URL', 'KUBE_TOKEN'],
      capabilities: ['version', 'namespaces', 'pods', 'deployments'],
      sourceOfTruth: SOURCE,
    };
  }

  // ── Probe ─────────────────────────────────────────────────────────────────────

  protected async probe(): Promise<void> {
    const base = this.creds.value('KUBE_API_URL');
    const token = this.creds.value('KUBE_TOKEN');
    const raw = await this.http.get(`${base}/version`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const parsed = KubeVersionResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        'Kubernetes /version: unexpected response shape — KUBE_API_URL or KUBE_TOKEN may be invalid',
      );
    }
  }

  // ── Gather ────────────────────────────────────────────────────────────────────

  protected async gather(): Promise<GatherResult> {
    const base = this.creds.value('KUBE_API_URL');
    const token = this.creds.value('KUBE_TOKEN');
    const headers = { Authorization: `Bearer ${token}` };
    const ev: Evidence[] = [];

    // ── Version ───────────────────────────────────────────────────────────────
    const versionRaw = await this.http.get(`${base}/version`, { headers });
    const versionParsed = KubeVersionResponseSchema.safeParse(versionRaw);
    if (!versionParsed.success) {
      throw new Error(
        `Kubernetes /version: invalid response shape — ${versionParsed.error.issues[0]?.message ?? 'parse error'}`,
      );
    }
    const gitVersion = versionParsed.data.gitVersion;
    ev.push(EvidenceBuilder.observed('kubernetes.version', `gitVersion=${gitVersion}`, SOURCE));

    // ── Namespaces ────────────────────────────────────────────────────────────
    const nsRaw = await this.http.get(`${base}/api/v1/namespaces`, { headers });
    const nsParsed = KubeNamespaceListSchema.safeParse(nsRaw);
    if (!nsParsed.success) {
      throw new Error(
        `Kubernetes /api/v1/namespaces: invalid response shape — ${nsParsed.error.issues[0]?.message ?? 'parse error'}`,
      );
    }
    const namespaces = nsParsed.data.items.map((ns) => ns.metadata.name);
    ev.push(
      EvidenceBuilder.observed('kubernetes.namespaces', `${namespaces.length} namespace(s)`, SOURCE),
    );

    // ── Pods (page 1, limit=100) ───────────────────────────────────────────────
    const podsRaw = await this.http.get(`${base}/api/v1/pods?limit=100`, { headers });
    const podsParsed = KubePodListSchema.safeParse(podsRaw);
    if (!podsParsed.success) {
      throw new Error(
        `Kubernetes /api/v1/pods: invalid response shape — ${podsParsed.error.issues[0]?.message ?? 'parse error'}`,
      );
    }
    const pods: KubePod[] = podsParsed.data.items;
    const podsContinue = podsParsed.data.metadata?.continue;
    ev.push(
      EvidenceBuilder.observed(
        'kubernetes.pods',
        `${pods.length} pod(s) — page 1 only (limit=100)${podsContinue ? '; additional pages NOT CONNECTED (paginated API)' : ''}`,
        SOURCE,
      ),
    );

    // ── Deployments (page 1, limit=100) ───────────────────────────────────────
    const deploymentsRaw = await this.http.get(
      `${base}/apis/apps/v1/deployments?limit=100`,
      { headers },
    );
    const deploymentsParsed = KubeDeploymentListSchema.safeParse(deploymentsRaw);
    if (!deploymentsParsed.success) {
      throw new Error(
        `Kubernetes /apis/apps/v1/deployments: invalid response shape — ${deploymentsParsed.error.issues[0]?.message ?? 'parse error'}`,
      );
    }
    const deployments: KubeDeployment[] = deploymentsParsed.data.items;
    const deploymentsContinue = deploymentsParsed.data.metadata?.continue;
    ev.push(
      EvidenceBuilder.observed(
        'kubernetes.deployments',
        `${deployments.length} deployment(s) — page 1 only (limit=100)${deploymentsContinue ? '; additional pages NOT CONNECTED (paginated API)' : ''}`,
        SOURCE,
      ),
    );

    // ── Normalise facts for CorrelationEngine ─────────────────────────────────
    const facts: LiveFact[] = [];

    // Namespace facts
    for (const nsName of namespaces) {
      facts.push({
        adapter: 'kubernetes',
        kind: 'k8s-namespace',
        subject: nsName,
        detail: `Kubernetes namespace "${nsName}"`,
        at: null,
        evidence: [EvidenceBuilder.observed(`kubernetes.namespace.${nsName}`, `name=${nsName}`, SOURCE)],
      });
    }

    // Pod facts
    for (const pod of pods) {
      const ns = pod.metadata.namespace ?? 'unknown';
      const name = pod.metadata.name;
      const phase = pod.status?.phase ?? 'unknown';
      const subject = `${ns}/${name}`;
      facts.push({
        adapter: 'kubernetes',
        kind: 'k8s-pod',
        subject,
        detail: `Pod "${name}" in namespace "${ns}" phase=${phase}`,
        at: pod.metadata.creationTimestamp ?? null,
        evidence: [
          EvidenceBuilder.observed(
            `kubernetes.pod.${subject}`,
            `phase=${phase}`,
            SOURCE,
          ),
        ],
      });
    }

    // Deployment facts
    for (const dep of deployments) {
      const ns = dep.metadata.namespace ?? 'unknown';
      const name = dep.metadata.name;
      const replicas = dep.status?.replicas ?? 0;
      const readyReplicas = dep.status?.readyReplicas ?? 0;
      const subject = `${ns}/${name}`;
      facts.push({
        adapter: 'kubernetes',
        kind: 'k8s-deployment',
        subject,
        detail: `Deployment "${name}" in namespace "${ns}" replicas=${replicas} readyReplicas=${readyReplicas}`,
        at: dep.metadata.creationTimestamp ?? null,
        evidence: [
          EvidenceBuilder.observed(
            `kubernetes.deployment.${subject}`,
            `replicas=${replicas} readyReplicas=${readyReplicas}`,
            SOURCE,
          ),
        ],
      });
    }

    const payload: KubernetesPayload = { gitVersion, namespaces, pods, deployments, facts };

    return {
      payload,
      evidence: ev,
      // 0.85: pod and deployment lists are page-1 only; full cluster state may differ.
      confidence: 0.85,
    };
  }

  // ── Checks ────────────────────────────────────────────────────────────────────

  protected async checks(payload: unknown): Promise<readonly VerificationFinding[]> {
    const p = payload as KubernetesPayload;
    const findings: VerificationFinding[] = [];

    // ── pod-not-running: Failed/Unknown → high; Pending → medium ─────────────
    for (const pod of p.pods) {
      const ns = pod.metadata.namespace ?? 'unknown';
      const name = pod.metadata.name;
      const phase = pod.status?.phase;
      const subject = `${ns}/${name}`;

      if (phase === 'Failed' || phase === 'Unknown') {
        findings.push({
          kind: 'pod-not-running',
          severity: 'high',
          subject,
          detail: `Pod "${name}" in namespace "${ns}" is in phase ${phase}. Investigate logs and events immediately.`,
          evidence: [
            EvidenceBuilder.observed(
              `kubernetes.pod.${subject}`,
              `phase=${phase}`,
              SOURCE,
            ),
          ],
        });
      } else if (phase === 'Pending') {
        findings.push({
          kind: 'pod-not-running',
          severity: 'medium',
          subject,
          detail: `Pod "${name}" in namespace "${ns}" is in phase Pending. It may be waiting for resources or image pull.`,
          evidence: [
            EvidenceBuilder.observed(
              `kubernetes.pod.${subject}`,
              `phase=Pending`,
              SOURCE,
            ),
          ],
        });
      }
    }

    // ── deployment-unready: readyReplicas < replicas ──────────────────────────
    for (const dep of p.deployments) {
      const ns = dep.metadata.namespace ?? 'unknown';
      const name = dep.metadata.name;
      const subject = `${ns}/${name}`;
      const replicas = dep.status?.replicas;
      const readyReplicas = dep.status?.readyReplicas ?? 0;

      // Only flag when replicas is explicitly set (i.e. the deployment has a desired count)
      if (replicas !== undefined && readyReplicas < replicas) {
        findings.push({
          kind: 'deployment-unready',
          severity: 'high',
          subject,
          detail: `Deployment "${name}" in namespace "${ns}" has ${readyReplicas}/${replicas} ready replicas. Pods may be failing or still rolling out.`,
          evidence: [
            EvidenceBuilder.observed(
              `kubernetes.deployment.${subject}`,
              `replicas=${replicas} readyReplicas=${readyReplicas}`,
              SOURCE,
            ),
          ],
        });
      }
    }

    // ── k8s-inventory: info summary ───────────────────────────────────────────
    findings.push({
      kind: 'k8s-inventory',
      severity: 'info',
      subject: 'kubernetes-cluster',
      detail: `Kubernetes cluster inventory (page 1): ${p.namespaces.length} namespace(s), ${p.pods.length} pod(s), ${p.deployments.length} deployment(s). Server version: ${p.gitVersion}.`,
      evidence: [
        EvidenceBuilder.observed(
          'kubernetes.inventory',
          `namespaces=${p.namespaces.length} pods=${p.pods.length} deployments=${p.deployments.length} gitVersion=${p.gitVersion}`,
          SOURCE,
        ),
      ],
    });

    return findings;
  }

  protected snapshotTtlMs(): number {
    return 30_000; // 30 s — cluster state changes frequently
  }
}
