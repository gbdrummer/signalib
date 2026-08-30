
# tracer-history

Generic patch-based history tracker.

`tracer-history` is a small, framework-agnostic history primitive for anything that can express its updates as **patch bundles**:

```js
{
  patches: Patch[],
  inversePatches: Patch[],
  meta?: any
}
```

When used directly, you provide `applyPatches(patches)`. `tracer-history` handles:

- recording bundles
- grouping multiple bundles into a single undo step via `transaction(fn)`
- `undo()` / `redo()`
- state notifications (`canUndo` / `canRedo`)

This package is ESM-only (`"type": "module"`).

Tracer collection users normally do not need to provide a patch applicator. The integrated API exported by `@gbdrummer/tracer` accepts the collection as its target and uses Tracer's `applyPatches()` internally:

```js
import { createHistory, signal } from '@gbdrummer/tracer'

const todos = signal.array([])
const history = createHistory({ target: todos, limit: 100 })

const change = todos.mutate(array => {
  array.push({ id: 1, title: 'Write docs' })
})

history.record(change)
history.undo()
history.redo()
```

## Installation / Import

```js
import createHistory from 'tracer-history'
```

## API

### `createHistory({ applyPatches, limit })`

```js
const history = createHistory({
  applyPatches: patches => {
    // ...apply these patches to your app state...
  },
  limit: 100
})
```

- **`applyPatches: (patches: Patch[]) => void`** (required)
  - Called by `undo()` and `redo()` (and by `perform()`) to mutate your state.
- **`limit: number`** (optional, default `Infinity`)
  - Max number of undo *steps* stored in `past`.
  - `0` disables recording.

Returns a `history` object with:

- `history.record(bundle): boolean`
- `history.perform(bundle): boolean`
- `history.transaction(fn): any`
- `history.undo(count = 1): boolean`
- `history.redo(count = 1): boolean`
- `history.clear(): void`
- `history.getStacks(): { past, future }`
- `history.subscribe(cb): () => void`
- `history.canUndo` (getter)
- `history.canRedo` (getter)

## Bundles and immutability

When you call `record(bundle)` (or `perform(bundle)`), the bundle is normalized before storing:

- `patches` and `inversePatches` must both be arrays.
- Each element of `patches` / `inversePatches` is shallow-cloned (if it’s an object) and frozen.
- The patch arrays themselves are frozen.
- `meta` is attached as-is (`meta` is not cloned).

This makes stored history steps stable and prevents later accidental mutation of recorded patches.

## Recording

### `history.record({ patches, inversePatches, meta? })`

Records a bundle as a new undo step.

- Returns `true` if the bundle was accepted for recording.
- Returns `false` if history is currently applying (`undo` / `redo`), or if `limit === 0`.

Calling `record()` clears the redo stack (`future`).

### `history.perform({ patches, inversePatches, meta? })`

Convenience method:

1. calls your `applyPatches(patches)`
2. calls `record(bundle)`

Notes:

- Throws if called while `undo()`/`redo()` is applying history.
- Useful when you want the “do the thing” and “record the thing” to be one operation.

## Transactions (grouping)

### `history.transaction(fn)`

`transaction(fn)` groups multiple `record()` calls into a single undo step.

```js
history.transaction(() => {
  history.record(bundleA)
  history.record(bundleB)
})
```

Behavior:

- While inside a transaction, `record()` buffers bundles instead of immediately pushing a step.
- On the outermost transaction exit, buffered bundles are committed as one step.
- The redo stack (`future`) is cleared at transaction end.

## Undo / Redo

### `history.undo(count = 1)`

- Applies `inversePatches` for the most recent step.
- If the step contains multiple bundles (from a transaction), their `inversePatches` are applied in reverse bundle order.
- Returns `true` if anything was undone.

### `history.redo(count = 1)`

- Re-applies patches from the future stack.
- If the step contains multiple bundles, their `patches` are applied in bundle order.
- Returns `true` if anything was redone.

Both `undo()` and `redo()` temporarily enter an “applying” mode. During that time:

- `record()` returns `false`
- `perform()` throws

This prevents feedback loops where applying history would create new history.

## State + subscriptions

### `history.canUndo`, `history.canRedo`

Boolean getters.

### `history.subscribe((nextState, previousState) => void)`

Subscribe to `{ canUndo, canRedo }` changes.

- The callback is called immediately with `(getState(), undefined)`.
- It is called again only when `canUndo` or `canRedo` actually changes.
- Returns an unsubscribe function.

If a subscriber throws during notification, `tracer-history` will:

- continue notifying other subscribers
- rethrow the first error after finishing

## Introspection

### `history.getStacks()`

Returns a snapshot:

```js
{
  past: [{ bundles: Bundle[] }, ...],
  future: [{ bundles: Bundle[] }, ...]
}
```

Each step is shallow-copied, and `bundles` arrays are copied. (Bundle objects inside are the stored frozen bundles.)

## Integration patterns

### Integrating with Tracer

Tracer collection mutations already produce `{ patches, inversePatches }` bundles.

Use the integrated `createHistory({ target })` facade so application code never has to interpret collection patch operations:

```js
import { createHistory, signal } from '@gbdrummer/tracer'

const todos = signal.array([])
const history = createHistory({ target: todos, limit: 100 })

function mutateWithHistory (fn) {
  const bundle = todos.mutate(fn)
  if (!bundle) return
  history.record(bundle)
}

mutateWithHistory(m => m.push({ id: 1, title: 'Write docs' }))
history.undo()
history.redo()
```

The key invariant is: **when history applies patches during undo/redo, do not record them as new edits**. The history engine enforces this by making `record()` a no-op during application.
