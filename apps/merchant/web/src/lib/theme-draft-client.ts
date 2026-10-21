type JsonRecord = Record<string, unknown>

// N4 draft transport: one queue and immutable retry intent per loaded editor.
// Kept app-local; schemas and persisted revision authority remain canonical.
type DraftAck = { version: number; currentVersion: number; savedAt?: string; release?: JsonRecord; replayed?: boolean }
type PublicationRecovery = { scope: string; storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> }
type PublicationIntent = { baseVersion: number; idempotencyKey: string }
type DraftIntent = { draftConfig: JsonRecord; baseVersion: number; idempotencyKey: string }
export class ThemeDraftConflictError extends Error {
    constructor(message = 'The theme draft changed. Review the latest saved version.') { super(message); this.name = 'ConflictError' }
}
export class ThemeDraftValidationError extends Error {}
export class ThemeDraftClient {
    private queue: Promise<unknown> = Promise.resolve()
    private pending: DraftIntent | null = null
    private pendingPublish: (PublicationIntent & { send?: (intent: PublicationIntent) => Promise<DraftAck> }) | null = null
    private recoveryError: Error | null = null
    private savedSignature: string | null
    private lastAck: DraftAck
    private alive = true
    paused = false
    constructor(public version: number, private sendSave: (intent: DraftIntent) => Promise<DraftAck>, config: JsonRecord,
        public hasDraft: boolean, private keyFactory = () => crypto.randomUUID(), public readonly actorId?: string, public readonly storeId?: string, private recovery?: PublicationRecovery) {
        if (!Number.isInteger(version) || version < 0) throw new Error('The current draft revision is missing.')
        this.savedSignature = version > 0 ? JSON.stringify(config) : null
        this.lastAck = { version, currentVersion: version }
        if (recovery) {
            try {
                if (!actorId || !storeId || !recovery.scope) throw new Error('The publication recovery context is missing.')
                const raw = recovery.storage.getItem(this.recoveryKey!)
                if (raw !== null) {
                    const value = JSON.parse(raw) as Record<string, unknown>
                    if (!value || Object.keys(value).sort().join(',') !== 'actorId,baseVersion,idempotencyKey,scope,storeId,version'
                        || value.version !== 1 || value.scope !== recovery.scope || value.actorId !== actorId || value.storeId !== storeId
                        || !Number.isInteger(value.baseVersion) || Number(value.baseVersion) < 1 || typeof value.idempotencyKey !== 'string'
                        || value.idempotencyKey.length < 8 || value.idempotencyKey.length > 200 || value.idempotencyKey.trim() !== value.idempotencyKey || /[\x00-\x1f\x7f]/.test(value.idempotencyKey)) {
                        throw new Error('The pending publication metadata could not be confirmed. Keep it for recovery before publishing again.')
                    }
                    this.pendingPublish = { baseVersion: Number(value.baseVersion), idempotencyKey: value.idempotencyKey }
                }
            } catch (error) { this.recoveryError = error instanceof Error ? error : new Error('Publication recovery storage is unavailable.') }
        }
    }
    private get recoveryKey() { return this.recovery ? `letbuyy:theme-publication:v1:${this.recovery.scope}` : null }
    private persistPublication(intent: PublicationIntent) {
        if (this.recovery) this.recovery.storage.setItem(this.recoveryKey!, JSON.stringify({ version: 1, scope: this.recovery.scope,
            actorId: this.actorId, storeId: this.storeId, baseVersion: intent.baseVersion, idempotencyKey: intent.idempotencyKey }))
    }
    private clearPublication() {
        if (this.recovery) this.recovery.storage.removeItem(this.recoveryKey!)
        this.pendingPublish = null
    }
    get hasPendingPublication() { return this.pendingPublish !== null }
    dispose() { this.alive = false }
    private assertAlive() { if (!this.alive) throw new Error('The loaded editor changed. Reload before saving.') }
    private enqueue<T>(task: () => Promise<T>): Promise<T> {
        const next = this.queue.then(task)
        this.queue = next.then(() => undefined, () => undefined)
        return next
    }
    private confirmAck(ack: DraftAck, base: number) {
        if (!Number.isInteger(ack.version) || ack.version !== base + 1 || !Number.isInteger(ack.currentVersion)) {
            throw new Error('No confirmed draft receipt was returned. Retry this request.')
        }
        if (ack.currentVersion !== ack.version) throw new ThemeDraftConflictError()
    }
    private async sendPending(): Promise<DraftAck> {
        const intent = this.pending!
        try {
            this.assertAlive()
            const ack = await this.sendSave(intent)
            this.assertAlive()
            this.confirmAck(ack, intent.baseVersion)
            this.pending = null
            this.version = ack.version
            this.savedSignature = JSON.stringify(intent.draftConfig)
            this.lastAck = ack
            this.hasDraft = true
            return ack
        } catch (error) {
            if (error instanceof ThemeDraftConflictError) { this.pending = null; this.paused = true }
            if (error instanceof ThemeDraftValidationError) this.pending = null
            throw error
        }
    }
    save(config: JsonRecord, replacementVersion?: number, ensurePreviewDraft = false): Promise<DraftAck> {
        const snapshot = JSON.parse(JSON.stringify(config)) as JsonRecord
        return this.enqueue(async () => {
            this.assertAlive()
            if (this.pendingPublish) throw new Error('Recover the previous publication before saving newer edits.')
            if (replacementVersion !== undefined) {
                if (!Number.isInteger(replacementVersion) || replacementVersion < 0) throw new Error('Review a current draft version before replacing it.')
                if (!this.pending) {
                    this.version = replacementVersion
                    this.paused = false
                    this.savedSignature = null
                }
            }
            if (this.paused) throw new ThemeDraftConflictError()
            if (this.pending) await this.sendPending()
            if (JSON.stringify(snapshot) === this.savedSignature && (!ensurePreviewDraft || this.hasDraft)) return this.lastAck
            this.pending = { draftConfig: snapshot, baseVersion: this.version, idempotencyKey: this.keyFactory() }
            return this.sendPending()
        })
    }
    publish(send: (intent: { baseVersion: number; idempotencyKey: string }) => Promise<DraftAck>): Promise<DraftAck> {
        return this.enqueue(async () => {
            this.assertAlive()
            if (this.recoveryError) throw this.recoveryError
            if (this.paused || this.pending) throw new ThemeDraftConflictError('Recover the current draft save before publishing.')
            if (!this.pendingPublish) {
                if (!this.hasDraft || this.version < 1) throw new Error('Save a draft before publishing.')
                const captured = { baseVersion: this.version, idempotencyKey: this.keyFactory(), send }
                this.persistPublication(captured)
                this.pendingPublish = captured
            }
            const intent = this.pendingPublish
            intent.send ??= send
            try {
                const ack = await intent.send({ baseVersion: intent.baseVersion, idempotencyKey: intent.idempotencyKey })
                this.assertAlive()
                if (!Number.isInteger(ack.version) || ack.version !== intent.baseVersion + 1 || !Number.isInteger(ack.currentVersion)
                    || typeof ack.replayed !== 'boolean' || (ack.currentVersion > ack.version && !ack.replayed)
                    || ack.currentVersion < ack.version || ack.currentVersion < this.version) {
                    throw new Error('No confirmed publication receipt was returned. Recover the same request.')
                }
                this.clearPublication()
                this.version = ack.currentVersion
                this.lastAck = ack
                // The historical receipt confirms publication, but cannot clear a
                // newer draft. Pause until the merchant reviews canonical state.
                this.paused = ack.currentVersion > ack.version
                if (!this.paused) this.hasDraft = false
                return ack
            } catch (error) {
                if (error instanceof ThemeDraftConflictError) { this.clearPublication(); this.paused = true }
                if (error instanceof ThemeDraftValidationError) this.clearPublication()
                throw error
            }
        })
    }
}
// End N4 draft transport.
