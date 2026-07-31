/**
 * DockerAdapter — READ-ONLY observer of a local or remote Docker Engine.
 *
 * Reads: /version (probe), /containers/json?all=true, /images/json, /info.
 * Uses the injected ReadOnlyHttpClient (GET only).
 * No mutation is possible — the interface exposes only this.http.get(...).
 *
 * Honesty contract:
 *  - Credentials absent (DOCKER_API_URL not set) → NOT_CONNECTED.
 *  - DOCKER_API_URL is the base URL and acts as the credential; it is NEVER
 *    emitted in evidence or logs — only referred to as 'DOCKER_API_URL host'.
 *  - Auth via the URL itself (e.g. unix socket proxy, token-in-URL, or mTLS
 *    proxy): no extra Authorization header is added.
 *  - Container metrics (CPU, memory, network) NOT CONNECTED — require
 *    GET /containers/{id}/stats which is a streaming endpoint.
 *  - Image layer details NOT CONNECTED — require GET /images/{id}/json per image.
 *  - Confidence capped at 0.90 (only first page of containers/images observed;
 *    Docker Engine returns all by default but pagination is not guaranteed).
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
  DockerContainersResponseSchema,
  DockerImagesResponseSchema,
  DockerInfoSchema,
  DockerVersionSchema,
  type DockerContainer,
  type DockerImage,
  type DockerInfo,
  type DockerPayload,
} from './types';

const SOURCE = 'Docker Engine API';

/** Normalise a container name: strip the leading slash Docker adds. */
function normaliseContainerName(names: readonly string[]): string {
  const first = names[0];
  if (!first) return '(unnamed)';
  return first.startsWith('/') ? first.slice(1) : first;
}

/** Return the display name for an image: first RepoTag, or the Id prefix (12 chars). */
function imageSubject(image: DockerImage): string {
  const tag = image.RepoTags?.[0];
  if (tag && tag !== '<none>:<none>') return tag;
  return image.Id.startsWith('sha256:') ? image.Id.slice(7, 19) : image.Id.slice(0, 12);
}

/** True when an image has no meaningful repo tags. */
function isUntagged(image: DockerImage): boolean {
  if (!image.RepoTags || image.RepoTags.length === 0) return true;
  return image.RepoTags.every((t) => t === '<none>:<none>' || t === '<none>');
}

export class DockerAdapter extends AdapterBase {
  constructor(deps: AdapterDeps) {
    super(deps);
  }

  metadata(): AdapterMetadata {
    return {
      name: 'docker',
      displayName: 'Docker Engine',
      requiredEnv: ['DOCKER_API_URL'],
      capabilities: ['containers', 'images', 'engine-info'],
      sourceOfTruth: SOURCE,
    };
  }

  // ── Probe ──────────────────────────────────────────────────────────────────

  protected async probe(): Promise<void> {
    const base = this.creds.value('DOCKER_API_URL');
    // base goes only into the URL — never into evidence or logs.
    const raw = await this.http.get(`${base}/version`);
    const parsed = DockerVersionSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `Docker Engine /version: unexpected response shape — ${parsed.error.issues[0]?.message ?? 'parse error'}`,
      );
    }
  }

  // ── Gather ─────────────────────────────────────────────────────────────────

  protected async gather(): Promise<GatherResult> {
    const base = this.creds.value('DOCKER_API_URL');
    const ev: Evidence[] = [];

    // ── Containers ──────────────────────────────────────────────────────────
    const containersRaw = await this.http.get(`${base}/containers/json?all=true`);
    const containersParsed = DockerContainersResponseSchema.safeParse(containersRaw);
    if (!containersParsed.success) {
      throw new Error(
        `Docker Engine /containers/json: invalid response shape — ${containersParsed.error.issues[0]?.message ?? 'parse error'}`,
      );
    }
    const containers: DockerContainer[] = containersParsed.data;
    ev.push(
      EvidenceBuilder.observed(
        'docker.containers',
        `${containers.length} container(s) observed from DOCKER_API_URL host`,
        SOURCE,
      ),
    );

    // ── Images ──────────────────────────────────────────────────────────────
    const imagesRaw = await this.http.get(`${base}/images/json`);
    const imagesParsed = DockerImagesResponseSchema.safeParse(imagesRaw);
    if (!imagesParsed.success) {
      throw new Error(
        `Docker Engine /images/json: invalid response shape — ${imagesParsed.error.issues[0]?.message ?? 'parse error'}`,
      );
    }
    const images: DockerImage[] = imagesParsed.data;
    ev.push(
      EvidenceBuilder.observed(
        'docker.images',
        `${images.length} image(s) observed from DOCKER_API_URL host`,
        SOURCE,
      ),
    );

    // ── Info ────────────────────────────────────────────────────────────────
    let info: DockerInfo = {};
    try {
      const infoRaw = await this.http.get(`${base}/info`);
      const infoParsed = DockerInfoSchema.safeParse(infoRaw);
      if (infoParsed.success) {
        info = infoParsed.data;
        const running = info.ContainersRunning ?? 'unknown';
        const stopped = info.ContainersStopped ?? 'unknown';
        ev.push(
          EvidenceBuilder.observed(
            'docker.info',
            `engine info: ContainersRunning=${running} ContainersStopped=${stopped}`,
            SOURCE,
          ),
        );
      } else {
        ev.push(
          EvidenceBuilder.observed(
            'docker.info',
            'engine info /info parse error — skipped; ContainersRunning/ContainersStopped NOT CONNECTED',
            SOURCE,
          ),
        );
      }
    } catch {
      // /info failure must not block the rest of the gather
      ev.push(
        EvidenceBuilder.observed(
          'docker.info',
          '/info fetch failed — NOT CONNECTED; ContainersRunning/ContainersStopped unavailable',
          SOURCE,
        ),
      );
    }

    ev.push(
      EvidenceBuilder.observed(
        'docker.note',
        'Container metrics (CPU/memory/network) NOT CONNECTED — require streaming /stats endpoint',
        SOURCE,
      ),
    );

    // ── Normalise facts for CorrelationEngine ─────────────────────────────
    const facts: LiveFact[] = [];
    const nowIso = this.now();

    for (const c of containers) {
      const subject = normaliseContainerName(c.Names);
      facts.push({
        adapter: 'docker',
        kind: 'container',
        subject,
        detail: `Container "${subject}" image=${c.Image} state=${c.State} status=${c.Status}`,
        at: nowIso,
        evidence: [
          EvidenceBuilder.observed(
            `docker.container.${subject}`,
            `state=${c.State} status=${c.Status} image=${c.Image}`,
            SOURCE,
          ),
        ],
      });
    }

    for (const img of images) {
      const subject = imageSubject(img);
      facts.push({
        adapter: 'docker',
        kind: 'image',
        subject,
        detail: `Image "${subject}" size=${img.Size} untagged=${isUntagged(img)}`,
        at: nowIso,
        evidence: [
          EvidenceBuilder.observed(
            `docker.image.${subject}`,
            `size=${img.Size} repoTags=${JSON.stringify(img.RepoTags ?? null)}`,
            SOURCE,
          ),
        ],
      });
    }

    const payload: DockerPayload = { containers, images, info, facts };

    return {
      payload,
      evidence: ev,
      // 0.90: we read all containers + images in a single call (Docker Engine
      // returns all by default) but container metrics are NOT CONNECTED.
      confidence: 0.9,
    };
  }

  // ── Checks ─────────────────────────────────────────────────────────────────

  protected async checks(payload: unknown): Promise<readonly VerificationFinding[]> {
    const p = payload as DockerPayload;
    const findings: VerificationFinding[] = [];

    // ── container-stopped (medium) — State === 'exited' ──────────────────
    for (const c of p.containers) {
      if (c.State === 'exited') {
        const subject = normaliseContainerName(c.Names);
        findings.push({
          kind: 'container-stopped',
          severity: 'medium',
          subject,
          detail: `Container "${subject}" (image=${c.Image}) has exited. Status: ${c.Status}.`,
          evidence: [
            EvidenceBuilder.observed(
              `docker.container.${subject}`,
              `state=exited status=${c.Status}`,
              SOURCE,
            ),
          ],
        });
      }
    }

    // ── container-restarting (high) — State === 'restarting' ─────────────
    for (const c of p.containers) {
      if (c.State === 'restarting') {
        const subject = normaliseContainerName(c.Names);
        findings.push({
          kind: 'container-restarting',
          severity: 'high',
          subject,
          detail: `Container "${subject}" (image=${c.Image}) is in a restart loop. Status: ${c.Status}.`,
          evidence: [
            EvidenceBuilder.observed(
              `docker.container.${subject}`,
              `state=restarting status=${c.Status}`,
              SOURCE,
            ),
          ],
        });
      }
    }

    // ── image-untagged (low) — RepoTags null or empty ─────────────────────
    for (const img of p.images) {
      if (isUntagged(img)) {
        const subject = imageSubject(img);
        findings.push({
          kind: 'image-untagged',
          severity: 'low',
          subject,
          detail: `Image "${subject}" has no repo tags — it may be a dangling layer or an unreferenced build artifact.`,
          evidence: [
            EvidenceBuilder.observed(
              `docker.image.${subject}`,
              `repoTags=${JSON.stringify(img.RepoTags ?? null)} size=${img.Size}`,
              SOURCE,
            ),
          ],
        });
      }
    }

    // ── engine-inventory (info) — summary ────────────────────────────────
    {
      const runningCount = p.containers.filter((c) => c.State === 'running').length;
      const exitedCount = p.containers.filter((c) => c.State === 'exited').length;
      const restartingCount = p.containers.filter((c) => c.State === 'restarting').length;
      const untaggedCount = p.images.filter(isUntagged).length;

      findings.push({
        kind: 'engine-inventory',
        severity: 'info',
        subject: 'docker-engine',
        detail:
          `Docker Engine inventory: ${p.containers.length} container(s) ` +
          `(running=${runningCount} exited=${exitedCount} restarting=${restartingCount}), ` +
          `${p.images.length} image(s) (untagged=${untaggedCount}).`,
        evidence: [
          EvidenceBuilder.observed(
            'docker.inventory',
            `containers=${p.containers.length} images=${p.images.length}`,
            SOURCE,
          ),
        ],
      });
    }

    return findings;
  }

  protected snapshotTtlMs(): number {
    return 30_000; // 30 s — container state changes frequently
  }
}
