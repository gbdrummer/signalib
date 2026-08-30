export const SIGNAL_BRAND: unique symbol

export interface InitChange<T, Meta = unknown> {
  readonly kind: 'init'
  readonly nextValue: T
  readonly previousValue: undefined
  readonly meta?: Meta
}

export interface UpdateChange<T, Meta = unknown> {
  readonly kind: 'update'
  readonly nextValue: T
  readonly previousValue: T
  readonly meta?: Meta
}

export type SignalChange<T, Meta = unknown> = InitChange<T, Meta> | UpdateChange<T, Meta>
export type Unsubscribe = () => boolean

export interface TracerSignal<T = unknown, Meta = unknown> {
  readonly [SIGNAL_BRAND]: true
  readonly [Symbol.toStringTag]: string
  getValue(): T
  subscribe(callback: (change: SignalChange<T, Meta>) => void): Unsubscribe
}

export interface WritableSignal<T> extends TracerSignal<T> {
  setValue(next: T | ((previous: T) => T)): boolean
}

export type DerivedSignal<T> = TracerSignal<T>

export interface Track {
  <T>(dependency: TracerSignal<T, any>): T
}

export interface ArraySetPatch<T> {
  readonly op: 'set'
  readonly index: number
  readonly value: T
}

export interface ArraySplicePatch<T> {
  readonly op: 'splice'
  readonly index: number
  readonly deleteCount: number
  readonly items: readonly T[]
}

export interface ArrayReplacePatch<T> {
  readonly op: 'replace'
  readonly value: readonly T[]
}

export type ArrayPatch<T> = ArraySetPatch<T> | ArraySplicePatch<T> | ArrayReplacePatch<T>

export interface ObjectSetPatch {
  readonly op: 'set'
  readonly key: string
  readonly value: unknown
}

export interface ObjectDeletePatch {
  readonly op: 'delete'
  readonly key: string
}

export interface ObjectReplacePatch<T extends object = Record<string, unknown>> {
  readonly op: 'replace'
  readonly value: Readonly<T>
}

export type ObjectPatch<T extends object = Record<string, unknown>> = ObjectSetPatch | ObjectDeletePatch | ObjectReplacePatch<T>

export interface MapSetPatch<K, V> {
  readonly op: 'set'
  readonly key: K
  readonly value: V
}

export interface MapDeletePatch<K> {
  readonly op: 'delete'
  readonly key: K
}

export interface MapClearPatch {
  readonly op: 'clear'
}

export interface MapReplacePatch<K, V> {
  readonly op: 'replace'
  readonly entries: readonly (readonly [K, V])[]
}

export type MapPatch<K, V> = MapSetPatch<K, V> | MapDeletePatch<K> | MapClearPatch | MapReplacePatch<K, V>

export interface SetAddPatch<T> {
  readonly op: 'add'
  readonly value: T
}

export interface SetDeletePatch<T> {
  readonly op: 'delete'
  readonly value: T
}

export interface SetClearPatch {
  readonly op: 'clear'
}

export interface SetReplacePatch<T> {
  readonly op: 'replace'
  readonly values: readonly T[]
}

export type SetPatch<T> = SetAddPatch<T> | SetDeletePatch<T> | SetClearPatch | SetReplacePatch<T>

export type CollectionPatch = ArrayPatch<unknown> | ObjectPatch | MapPatch<unknown, unknown> | SetPatch<unknown>

export interface PatchBundle<Patch> {
  readonly patches: readonly Patch[]
  readonly inversePatches: readonly Patch[]
  readonly meta?: unknown
}

export type MutationResult<Patch> = PatchBundle<Patch> | null

export interface ArrayMutator<T> {
  readonly length: number
  push(...items: T[]): number
  pop(): T | undefined
  unshift(...items: T[]): number
  shift(): T | undefined
  splice(start: number, deleteCount?: number, ...items: T[]): T[]
  set(index: number, value: T): boolean
}

export interface SignalArray<T> extends TracerSignal<readonly T[], PatchBundle<ArrayPatch<T>>> {
  setValue(next: readonly T[] | ((previous: readonly T[]) => readonly T[])): boolean
  mutate(callback: (array: ArrayMutator<T>) => void): MutationResult<ArrayPatch<T>>
  readonly index: {
    readonly length: TracerSignal<number>
  }
}

export interface DerivedSignalArray<T> extends TracerSignal<readonly T[]> {
  readonly index: {
    readonly length: TracerSignal<number>
  }
}

export interface ObjectMutator<T extends object> {
  has(key: string): boolean
  get<K extends string>(key: K): K extends keyof T ? T[K] : unknown
  set<K extends string>(key: K, value: K extends keyof T ? T[K] : unknown): boolean
  delete(key: string): boolean
  assign(partial: Partial<T> & Record<string, unknown>): boolean
}

export interface SignalObject<T extends object> extends TracerSignal<Readonly<T>, PatchBundle<ObjectPatch<T>>> {
  setValue(next: T | ((previous: Readonly<T>) => T)): boolean
  mutate(callback: (object: ObjectMutator<T>) => void): MutationResult<ObjectPatch<T>>
  readonly index: {
    readonly keys: TracerSignal<readonly string[]>
    readonly size: TracerSignal<number>
  }
}

export interface DerivedSignalObject<T extends object> extends TracerSignal<Readonly<T>> {
  readonly index: {
    readonly keys: TracerSignal<readonly string[]>
    readonly size: TracerSignal<number>
  }
}

export interface MapEntry<V> {
  readonly present: boolean
  readonly value: V | undefined
}

export type MapInput<K, V> = ReadonlyMap<K, V> | Iterable<readonly [K, V]>

export interface MapMutator<K, V> {
  readonly size: number
  has(key: K): boolean
  get(key: K): V | undefined
  set(key: K, value: V): boolean
  delete(key: K): boolean
  clear(): boolean
  entries(): IterableIterator<[K, V]>
  keys(): IterableIterator<K>
  values(): IterableIterator<V>
}

export interface SignalMap<K, V> extends TracerSignal<ReadonlyMap<K, V>, PatchBundle<MapPatch<K, V>>> {
  setValue(next: MapInput<K, V> | ((previous: ReadonlyMap<K, V>) => MapInput<K, V>)): boolean
  mutate(callback: (map: MapMutator<K, V>) => void): MutationResult<MapPatch<K, V>>
  key(key: K): TracerSignal<MapEntry<V>>
  readonly index: {
    readonly keys: TracerSignal<readonly K[]>
    readonly size: TracerSignal<number>
  }
  has(key: K): boolean
  get(key: K): V | undefined
  readonly size: number
}

export interface DerivedSignalMap<K, V> extends TracerSignal<ReadonlyMap<K, V>> {
  key(key: K): TracerSignal<MapEntry<V>>
  readonly index: {
    readonly keys: TracerSignal<readonly K[]>
    readonly size: TracerSignal<number>
  }
  has(key: K): boolean
  get(key: K): V | undefined
  readonly size: number
}

export interface SetEntry {
  readonly present: boolean
}

export type SetInput<T> = ReadonlySet<T> | Iterable<T>

export interface SetMutator<T> {
  readonly size: number
  has(value: T): boolean
  add(value: T): boolean
  delete(value: T): boolean
  clear(): boolean
  values(): IterableIterator<T>
  keys(): IterableIterator<T>
  entries(): IterableIterator<[T, T]>
}

export interface SignalSet<T> extends TracerSignal<ReadonlySet<T>, PatchBundle<SetPatch<T>>> {
  setValue(next: SetInput<T> | ((previous: ReadonlySet<T>) => SetInput<T>)): boolean
  mutate(callback: (set: SetMutator<T>) => void): MutationResult<SetPatch<T>>
  value(value: T): TracerSignal<SetEntry>
  readonly index: {
    readonly values: TracerSignal<readonly T[]>
    readonly size: TracerSignal<number>
  }
  has(value: T): boolean
  readonly size: number
}

export interface DerivedSignalSet<T> extends TracerSignal<ReadonlySet<T>> {
  value(value: T): TracerSignal<SetEntry>
  readonly index: {
    readonly values: TracerSignal<readonly T[]>
    readonly size: TracerSignal<number>
  }
  has(value: T): boolean
  readonly size: number
}

export interface ArraySignalFactory {
  <T>(compute: (track: Track) => readonly T[]): DerivedSignalArray<T>
  <T>(initialValue: readonly T[]): SignalArray<T>
}

export interface ObjectSignalFactory {
  <T extends object>(compute: (track: Track) => T): DerivedSignalObject<T>
  <T extends object>(initialValue: T): SignalObject<T>
}

export interface MapSignalFactory {
  <K, V>(compute: (track: Track) => MapInput<K, V>): DerivedSignalMap<K, V>
  <K = unknown, V = unknown>(): SignalMap<K, V>
  <K, V>(initialValue: MapInput<K, V>): SignalMap<K, V>
}

export interface SetSignalFactory {
  <T>(compute: (track: Track) => SetInput<T>): DerivedSignalSet<T>
  <T = unknown>(): SignalSet<T>
  <T>(initialValue: SetInput<T>): SignalSet<T>
}

export interface SignalFactory {
  <T>(compute: (track: Track) => T): DerivedSignal<T>
  <T>(initialValue: T): WritableSignal<T>
  readonly array: ArraySignalFactory
  readonly object: ObjectSignalFactory
  readonly map: MapSignalFactory
  readonly set: SetSignalFactory
}

export const signal: SignalFactory

export interface OverridableSignal<T> extends TracerSignal<T> {
  setValue(next: T | ((previous: T) => T)): boolean
  clearOverride(): boolean
  readonly isOverridden: boolean
}

export function overridable<T>(base: TracerSignal<T, any>): OverridableSignal<T>
export function batch<Result>(callback: () => Result): Result
export function isSignal(value: unknown): value is TracerSignal<unknown>

export function applyPatches<T>(target: SignalArray<T>, patches: readonly ArrayPatch<T>[]): boolean
export function applyPatches<T extends object>(target: SignalObject<T>, patches: readonly ObjectPatch<T>[]): boolean
export function applyPatches<K, V>(target: SignalMap<K, V>, patches: readonly MapPatch<K, V>[]): boolean
export function applyPatches<T>(target: SignalSet<T>, patches: readonly SetPatch<T>[]): boolean

export interface HistoryState {
  readonly canUndo: boolean
  readonly canRedo: boolean
}

export interface HistoryStep<Patch> {
  readonly bundles: readonly PatchBundle<Patch>[]
}

export interface HistoryStacks<Patch> {
  readonly past: readonly HistoryStep<Patch>[]
  readonly future: readonly HistoryStep<Patch>[]
}

export interface History<Patch> {
  readonly canUndo: boolean
  readonly canRedo: boolean
  record(bundle: PatchBundle<Patch>): boolean
  perform(bundle: PatchBundle<Patch>): boolean
  transaction<Result>(callback: () => Result): Result
  undo(count?: number): boolean
  redo(count?: number): boolean
  clear(): void
  getStacks(): HistoryStacks<Patch>
  subscribe(callback: (nextState: HistoryState, previousState: HistoryState | undefined) => void): () => void
}

export interface HistoryOptions<Target> {
  readonly target: Target
  readonly limit?: number
}

export function createHistory<T>(options: HistoryOptions<SignalArray<T>>): History<ArrayPatch<T>>
export function createHistory<T extends object>(options: HistoryOptions<SignalObject<T>>): History<ObjectPatch<T>>
export function createHistory<K, V>(options: HistoryOptions<SignalMap<K, V>>): History<MapPatch<K, V>>
export function createHistory<T>(options: HistoryOptions<SignalSet<T>>): History<SetPatch<T>>

export const TracerSignal: {
  readonly prototype: TracerSignal<unknown>
  [Symbol.hasInstance](value: unknown): value is TracerSignal<unknown>
}
