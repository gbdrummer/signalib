# Signalib generic history engine

The `signalib/history` subpath exports the generic patch-based history engine used by Signalib's integrated collection history. It can manage any state model that represents edits as patch bundles:

```text
{
  patches: Patch[],
  inversePatches: Patch[],
  meta?: any
}
```

For writable Signalib collections, prefer the integrated root export. It supplies patch application, validation, and batching automatically:

```js
import { createHistory, signal } from 'signalib'

const todos = signal.array([])
const history = createHistory({ target: todos, limit: 100 })

const change = todos.mutate(array => {
  array.push({ id: 1, title: 'Write docs' })
})

history.record(change)
history.undo()
history.redo()
```

Use the generic subpath for custom patch formats or non-Signalib state:

```js
import createHistory from 'signalib/history'

const state = { count: 0 }

const history = createHistory({
  applyPatches: patches => {
    for (const patch of patches) state[patch.key] = patch.value
  },
  limit: 100
})
```

## API

### `createHistory(options)`

Options:

- **`applyPatches(patches)`** (required): applies a complete patch list to application state.
- **`limit`** (optional, default `Infinity`): maximum number of undo steps. `0` disables recording.
- **`validatePatches(patches)`** (optional): validates a complete undo or redo list without mutating state.
- **`validateBundle(bundle, context)`** (optional): validates both directions of a normalized bundle without mutating state. `context` is `"record"` when the edit has already occurred and `"perform"` when the edit has not yet occurred.
- **`batch(callback)`** (optional): wraps patch application and history stack movement. This is useful when state notifications are deferred until the callback returns.

The integrated root API supplies all three optional correctness hooks. Generic consumers only need them when their patch format or notification model requires the corresponding guarantees.

The returned history object exposes:

- `record(bundle): boolean`
- `perform(bundle): boolean`
- `transaction(callback): any`
- `undo(count = 1): boolean`
- `redo(count = 1): boolean`
- `clear(): void`
- `getStacks(): { past, future }`
- `subscribe(callback): () => void`
- `canUndo` and `canRedo` getters

## Recording and performing

`record(bundle)` validates, normalizes, and stores an edit that application code has already performed. Recording a new edit clears the redo stack.

`perform(bundle)` is a convenience operation that:

1. normalizes and validates the complete bundle;
2. applies its forward patches;
3. records the already-normalized bundle.

Invalid bundle structure therefore cannot modify state. With `validateBundle`, semantic errors in either the forward or inverse patch list are also rejected before mutation.

`record()` returns `false` while undo or redo is applying, preventing feedback loops. `perform()` throws if called during history application.

## Transactions and clear

`transaction(callback)` groups every retained `record()` call into one undo step. Nested transactions join the outer transaction.

```js
history.transaction(() => {
  history.record(bundleA)
  history.record(bundleB)
})
```

Calling `clear()` empties past history, future history, and bundles currently pending in a transaction. It does not cancel or reset the active transaction context. Records made after `clear()` remain grouped by the surrounding transaction, and history-state notification remains deferred to the outer transaction boundary.

## Undo, redo, and errors

Undo applies a step's inverse patches in reverse bundle order. Redo applies its forward patches in bundle order. Each step is presented to `applyPatches` as one combined list.

The integrated Signalib API batches the complete operation. If state commits successfully and a collection subscriber then throws, the subscriber error remains visible to the caller and history stacks still move to reflect the committed state. If validation or patch application fails before mutation, both state and stacks remain unchanged.

The generic engine cannot infer whether an arbitrary `applyPatches` callback threw before or after mutating custom state. A generic integration whose notifications can throw after commit should supply a `batch` hook that defers those errors until its callback returns. Otherwise, `applyPatches` should throw only before committing state.

## Immutability

History storage is protected from external mutation:

- normalized bundle objects are frozen;
- patch arrays and inverse-patch arrays are copied and frozen;
- object patches are shallow-copied and frozen;
- step objects and their bundle arrays are frozen;
- `getStacks()` returns frozen snapshot arrays.

Patch payload values are not recursively cloned or frozen. `meta` is attached as-is and remains caller-owned; mutating it cannot replace the stored bundle, patch arrays, or history steps, but consumers should treat metadata as application data rather than immutable history structure.

## State subscriptions

`history.subscribe(callback)` immediately receives the current `{ canUndo, canRedo }` state and then runs only when either flag changes. Notification continues across subscriber failures and rethrows the first error after all subscribers have run.
