type JsonRecord = Record<string, unknown>

// N4 draft transport: one queue and immutable retry intent per loaded editor.
// Kept app-local; schemas and persisted revision authority remain canonical.
type DraftAck = { version: number; currentVersion: number; savedAt?: string; release?: JsonRecord }
type DraftIntent = { draftConfig: JsonRecord; baseVersion: number; idempotencyKey: string }
export class ThemeDraftConflictError extends Error {
    constructor(message = 'The theme draft changed. Review the latest saved version.') { super(message); this.name = 'ConflictError' }
}
export class ThemeDraftValidationError extends Error {}
export class ThemeDraftClient {
    private queue: Promise<unknown> = Promise.resolve()
    private pending: DraftIntent | null = null
    private pendingPublish: { baseVersion: number; idempotencyKey: string; send: (intent: { baseVersion: number; idempotencyKey: string }) => Promise<DraftAck> } | null = null
    private savedSignature: string | null
    private lastAck: DraftAck
    private alive = true
    paused = false
    constructor(public version: number, private sendSave: (intent: DraftIntent) => Promise<DraftAck>, config: JsonRecord,
        public hasDraft: boolean, private keyFactory = () => crypto.randomUUID()) {
        if (!Number.isInteger(version) || version < 0) throw new Error('The current draft revision is missing.')
        this.savedSignature = version > 0 ? JSON.stringify(config) : null
        this.lastAck = { version, currentVersion: version }
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
    save(config: JsonRecord, replacementVersion?: number): Promise<DraftAck> {
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
            if (JSON.stringify(snapshot) === this.savedSignature) return this.lastAck
            this.pending = { draftConfig: snapshot, baseVersion: this.version, idempotencyKey: this.keyFactory() }
            return this.sendPending()
        })
    }
    publish(send: (intent: { baseVersion: number; idempotencyKey: string }) => Promise<DraftAck>): Promise<DraftAck> {
        return this.enqueue(async () => {
            this.assertAlive()
            if (this.paused || this.pending) throw new ThemeDraftConflictError('Recover the current draft save before publishing.')
            if (!this.pendingPublish) {
                if (!this.hasDraft || this.version < 1) throw new Error('Save a draft before publishing.')
                this.pendingPublish = { baseVersion: this.version, idempotencyKey: this.keyFactory(), send }
            }
            const intent = this.pendingPublish
            try {
                const ack = await intent.send({ baseVersion: intent.baseVersion, idempotencyKey: intent.idempotencyKey })
                this.assertAlive()
                this.confirmAck(ack, intent.baseVersion)
                this.pendingPublish = null
                this.version = ack.version
                this.lastAck = ack
                this.hasDraft = false
                return ack
            } catch (error) {
                if (error instanceof ThemeDraftConflictError) { this.pendingPublish = null; this.paused = true }
                if (error instanceof ThemeDraftValidationError) this.pendingPublish = null
                throw error
            }
        })
    }
}
// End N4 draft transport.
