export interface PatchBundle<Patch = unknown, Meta = unknown> {
  readonly patches: readonly Patch[]
  readonly inversePatches: readonly Patch[]
  readonly meta?: Meta
}

export interface HistoryState {
  readonly canUndo: boolean
  readonly canRedo: boolean
}

export interface HistoryStep<Patch, Meta = unknown> {
  readonly bundles: readonly PatchBundle<Patch, Meta>[]
}

export interface HistoryStacks<Patch, Meta = unknown> {
  readonly past: readonly HistoryStep<Patch, Meta>[]
  readonly future: readonly HistoryStep<Patch, Meta>[]
}

export interface History<Patch = unknown, Meta = unknown> {
  readonly canUndo: boolean
  readonly canRedo: boolean
  record(bundle: PatchBundle<Patch, Meta>): boolean
  perform(bundle: PatchBundle<Patch, Meta>): boolean
  transaction<Result>(callback: () => Result): Result
  undo(count?: number): boolean
  redo(count?: number): boolean
  clear(): void
  getStacks(): HistoryStacks<Patch, Meta>
  subscribe(callback: (nextState: HistoryState, previousState: HistoryState | undefined) => void): () => void
}

export interface CreateHistoryOptions<Patch, Meta = unknown> {
  readonly applyPatches: (patches: readonly Patch[]) => unknown
  readonly limit?: number
}

export default function createHistory<Patch = unknown, Meta = unknown>(options: CreateHistoryOptions<Patch, Meta>): History<Patch, Meta>
