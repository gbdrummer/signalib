# Tracer

Tracer is a predictable reactive-state library for JavaScript built around explicit dependencies, fine-grained reactive collections, and first-class mutation patches.

[![CI](https://github.com/gbdrummer/tracer/actions/workflows/ci.yml/badge.svg)](https://github.com/gbdrummer/tracer/actions/workflows/ci.yml)

> Signals for JavaScript where dependencies are explicit and collection mutations are data.

Tracer includes ordinary writable and derived signals, but its collection model is the main idea. Maps and Sets expose stable signals for individual entries or values, while every collection type exposes structural signals such as keys, size, or length where appropriate.

## Why Tracer

Tracer treats a state change as inspectable data, not merely a notification. A collection mutation can update reactive consumers while also producing forward and inverse patches that can drive undo/redo and debugging directly, or serve as a foundation for persistence and synchronization.

Its core design choices are:

- **Explicit dependency reads:** only a deliberate tracking-function call can create a reactive edge. Ordinary reads cannot produce "spooky action at a distance."
- **Fine-grained collections:** observe a whole collection, its structure, or one stable key/value signal.
- **Structured mutations:** mutate through focused Map, Set, array, and object APIs instead of implicit Proxy behavior.
- **Forward and inverse patches:** inspect what changed and describe how to reverse it.
- **History-ready state:** record patch bundles for transactions, undo, redo, and redo invalidation after new edits.

## Installation

Tracer is ESM-only. TypeScript declarations are included for editor support and type checking; the runtime implementation remains JavaScript.

```sh
npm install @gbdrummer/tracer
```

```js
import {
  applyPatches,
  batch,
  createHistory,
  overridable,
  signal
} from '@gbdrummer/tracer'
```

## Quick example

This example observes one Map entry and captures the mutation as data:

```js
import { signal } from '@gbdrummer/tracer'

const users = signal.map()
const ada = users.key('ada')

ada.subscribe(change => {
  if (change.kind === 'init') return
  console.log(change.nextValue)
})

const change = users.mutate(map => {
  map.set('ada', { name: 'Ada' })
})

console.log(change.patches)
// [{ op: 'set', key: 'ada', value: { name: 'Ada' } }]

console.log(change.inversePatches)
// [{ op: 'delete', key: 'ada' }]
```

`users.key('ada')` is a stable signal for that entry, so it reacts when Ada changes without reacting to unrelated users. The same mutation updates relevant whole-collection and structural subscribers and returns an immutable description of the change.

## Explicit dependencies

Tracer deliberately separates an ordinary value read from a reactive dependency read:

```js
const firstName = signal('Ada')
const lastName = signal('Lovelace')

const example = signal($ => {
  const untracked = firstName.getValue() // read the current value
  const tracked = $(lastName)            // read and register a dependency

  return `${untracked} ${tracked}`
})
```

The function passed to `signal()` receives a tracking function, conventionally named `$`.

- **`signal.getValue()`** reads the current value.
- **`$(signal)`** reads the value and registers the current computation as dependent on it.

This distinction is a hard invariant, not a naming convention. `getValue()` never consults an ambient reactive context. A plain read cannot create a dependency just because it happened deep inside a helper called by a derived computation:

```js
const locale = signal('en')

function readLocale () {
  return locale.getValue()
}

const greeting = signal($ => {
  return `${readLocale()}: Hello, ${$(firstName)}`
})
```

`greeting` depends on `firstName`, but not `locale`. Moving `readLocale()` into or out of another helper cannot silently change the reactive graph. If `locale` should invalidate `greeting`, that relationship must appear explicitly as `$(locale)`.

Explicit tracking is more verbose than implicit tracking. In return, it rules out unexpected reactivity caused by incidental reads: if there is no tracking-function call, there is no reactive edge.

## Writable signals

Pass a non-function value to `signal()` to create a writable signal:

```js
const count = signal(0)

count.getValue() // 0
count.setValue(1)
count.setValue(value => value + 1)
count.getValue() // 2
```

A writable signal exposes:

- **`getValue()`**: reads the current value.
- **`setValue(nextOrUpdater)`**: updates the value and returns `true` if it changed.
- **`subscribe(callback)`**: subscribes to changes and returns an unsubscribe function.

Subscriptions receive an immediate `init` change followed by `update` changes:

```js
const unsubscribe = count.subscribe(change => {
  console.log(change.kind, change.nextValue)
})

unsubscribe()
```

Change objects have this shape:

```text
{
  kind: 'init' | 'update',
  nextValue: any,
  previousValue: any,
  meta?: any
}
```

`init` changes have `previousValue === undefined`. Collection updates use `meta` to publish their patch bundle.

## Derived signals

Pass a function to `signal()` to create a readonly derived signal:

```js
const firstName = signal('Ada')
const lastName = signal('Lovelace')

const fullName = signal($ => `${$(firstName)} ${$(lastName)}`)

fullName.getValue() // 'Ada Lovelace'
```

Derived dependencies can follow control flow while remaining explicit:

```js
const useNickname = signal(false)
const name = signal('Ada')
const nickname = signal('Enchantress of Numbers')

const displayName = signal($ => {
  return $(useNickname) ? $(nickname) : $(name)
})
```

`displayName` always depends on `useNickname`. It depends on either `nickname` or `name` according to the branch taken during its latest computation; Tracer updates those subscriptions when the branch changes.

Derived signals have two subscription modes:

- **Cold:** with no subscribers, a derived signal holds no upstream subscriptions and recomputes when `getValue()` is called.
- **Hot:** with subscribers, it subscribes to current dependencies, recomputes when they change, and tears those subscriptions down when its final subscriber leaves.

Derived signals expose `getValue()` and `subscribe(callback)`. They do not expose `setValue()`.

## Batching

Use `batch(fn)` to coalesce multiple updates into one notification per affected signal:

```js
const count = signal(0)

count.subscribe(change => {
  if (change.kind === 'init') return
  console.log(change.previousValue, change.nextValue)
})

batch(() => {
  count.setValue(1)
  count.setValue(2)
  count.setValue(3)
})

// Logs once: 0 3
```

Nested batches compose. Pending notifications still flush if the batch callback throws, and the error is then rethrown.

## Reactive collections

Collections use explicit mutation APIs rather than proxies or snapshot diffing. Writable arrays, objects, Maps, and Sets share this contract:

- **`getValue()`** returns a frozen snapshot or readonly view.
- **`setValue(nextOrUpdater)`** replaces the complete collection value.
- **`mutate(callback)`** applies granular edits atomically and returns a patch bundle, or `null` when no operation was recorded.
- **`subscribe(callback)`** observes whole-collection changes.

If a mutation callback throws, its working copy is discarded without committing or notifying.

### Arrays

```js
const items = signal.array(['a', 'b'])

items.mutate(array => {
  array.push('c')
  array.set(0, 'A')
})

items.getValue() // frozen ['A', 'b', 'c']
```

Array mutators are `push`, `pop`, `unshift`, `shift`, `splice`, and `set(index, value)`.

### Objects

```js
const person = signal.object({
  name: 'Ada',
  age: 36
})

person.mutate(object => {
  object.set('name', 'Grace')
  object.assign({ role: 'programmer' })
  object.delete('age')
})
```

Object mutators are `has`, `get`, `set`, `delete`, and `assign`.

### Maps

```js
import { signal } from '@gbdrummer/tracer'

const users = signal.map([
  ['ada', { name: 'Ada' }]
])

users.mutate(map => {
  map.set('grace', { name: 'Grace' })
})

users.has('ada') // true
users.get('grace') // { name: 'Grace' }
users.size // 2
```

Map mutators are `has`, `get`, `set`, `delete`, `clear`, `keys`, `values`, and `entries`.

### Sets

```js
const selectedIds = signal.set(['a'])

selectedIds.mutate(set => {
  set.add('b')
  set.delete('a')
})

selectedIds.has('b') // true
selectedIds.size // 1
```

Set mutators are `has`, `add`, `delete`, `clear`, `keys`, `values`, and `entries`.

### Derived collections

Each collection factory also accepts a derived computation:

```js
const first = signal('Ada')
const second = signal('Grace')

const names = signal.array($ => [$(first), $(second)])
const nameSet = signal.set($ => [$(first), $(second)])
const profile = signal.object($ => ({ name: $(first) }))
const profileMap = signal.map($ => [['name', $(first)]])
```

Derived collections expose their readonly collection APIs and reactive indexes, but not `setValue()` or `mutate()`.

## Fine-grained collection indexes

Collection indexes let consumers observe structural or entry-level state without subscribing to every collection update.

| Collection | Structural signals | Stable entry signal |
| --- | --- | --- |
| Array | `index.length` | — |
| Object | `index.keys`, `index.size` | — |
| Map | `index.keys`, `index.size` | `key(key)` → `{ present, value }` |
| Set | `index.values`, `index.size` | `value(value)` → `{ present }` |

For example, a user directory can expose whole-collection changes, structural changes, one user's entry, derived state, and mutation records independently:

```js
import { signal } from '@gbdrummer/tracer'

const users = signal.map([
  ['ada', { name: 'Ada' }]
])

const ada = users.key('ada')
const userCount = signal($ => $(users.index.size))

function logUpdates (label, source) {
  source.subscribe(change => {
    if (change.kind === 'init') return
    console.log(label, change.nextValue)
  })
}

users.subscribe(change => {
  if (change.kind === 'init') return
  console.log('whole collection changed')
  console.log('patches:', change.meta.patches)
  console.log('inverse patches:', change.meta.inversePatches)
})

logUpdates('keys:', users.index.keys)
logUpdates('size:', users.index.size)
logUpdates('Ada:', ada)
logUpdates('derived user count:', userCount)

users.mutate(map => {
  map.set('grace', { name: 'Grace' })
})

// Updates: whole collection (with its patch), keys, size, and userCount.
// No Ada update: that entry did not change.

users.mutate(map => {
  map.set('ada', { name: 'Ada Lovelace' })
})

// Updates: whole collection (with its patch) and Ada.
// No keys, size, or userCount update: the structure did not change.

users.key('ada') === ada // true: the entry signal is stable
```

Adding Grace updates structural observers without notifying Ada's entry signal. Updating Ada then notifies her entry signal without notifying structural observers. `users.key('ada')` also returns a stable signal rather than allocating a new reactive identity for each lookup.

Consumers can therefore subscribe at the narrowest useful granularity:

- **Whole collection:** react to every committed collection change.
- **Structure:** react only when keys, values, size, or length change.
- **Individual entry:** react only when one Map entry or Set membership changes.
- **Derived state:** explicitly compose the relevant collection signals into another value.
- **Mutation record:** inspect the forward and inverse patches attached to the whole-collection change.

## Mutations and patches

Stored collection mutations return immutable forward and inverse patch bundles. The operations are ordinary data that describe both what changed and how to undo it:

```js
import { signal } from '@gbdrummer/tracer'

const users = signal.map()

const result = users.mutate(map => {
  map.set('ada', { name: 'Ada' })
})

console.log(result)
// {
//   patches: [
//     { op: 'set', key: 'ada', value: { name: 'Ada' } }
//   ],
//   inversePatches: [
//     { op: 'delete', key: 'ada' }
//   ]
// }
```

The same patch data is published to whole-collection subscribers as `change.meta`, so observers can inspect mutations without owning the code that performed them.

Patch bundles, patch arrays, and patch objects are frozen. Inverse patches are recorded in the order required to reverse a multi-operation mutation. When mutations occur inside `batch()`, their patch metadata composes into the same batched notification.

## Applying patches

Use `applyPatches(target, patches)` to replay either side of a collection patch bundle without writing an application-specific opcode interpreter:

```js
import { applyPatches, signal } from '@gbdrummer/tracer'

const users = signal.map()

const result = users.mutate(map => {
  map.set('ada', { name: 'Ada' })
})

users.get('ada') // { name: 'Ada' }

applyPatches(users, result.inversePatches)
users.has('ada') // false: the previous state is restored

applyPatches(users, result.patches)
users.get('ada') // { name: 'Ada' }: the change is replayed
```

No opcode switch is needed in application code. Patch application supports every patch format emitted by writable arrays, objects, Maps, and Sets. It uses their normal reactive mutation paths, batches multi-operation bundles, updates structural and stable key/value signals, and returns `true` when the target changed.

Invalid targets, malformed patches, and unsupported operations throw clear errors before any patch is applied.

## History and undo/redo

`createHistory({ target })` connects a writable Tracer collection directly to the patch-based history engine:

```js
import { createHistory, signal } from '@gbdrummer/tracer'

const todos = signal.array([])
const history = createHistory({ target: todos, limit: 100 })

function mutateTodos (fn) {
  const change = todos.mutate(fn)
  if (change) history.record(change)
  return change
}

mutateTodos(array => {
  array.push({ id: 1, title: 'Explain patches' })
})

history.undo() // todos is empty again
history.redo() // restores the todo
```

Use `history.transaction(fn)` to group several recorded mutation bundles into one undo step. Recording a new edit after `undo()` invalidates the redo stack.

The lower-level `tracer-history` engine remains generic for applications with custom patch formats. See its [standalone documentation](./src/history/README.md).

## Advanced features

### Overridable signals

`overridable(baseSignal)` creates a writable wrapper that follows another signal until explicitly overridden:

```js
const serverValue = signal('light')
const localValue = overridable(serverValue)

localValue.getValue() // 'light'

localValue.setValue('dark')
localValue.getValue() // 'dark'
localValue.isOverridden // true

localValue.clearOverride()
localValue.getValue() // follows serverValue again
```

Overridable signals expose `getValue()`, `setValue()`, `clearOverride()`, `isOverridden`, and `subscribe()`.

### API summary

```text
signal(value)
signal($ => value)

signal.array(array)
signal.array($ => array)

signal.object(object)
signal.object($ => object)

signal.map(entriesOrMap?)
signal.map($ => entriesOrMap)

signal.set(valuesOrSet?)
signal.set($ => valuesOrSet)

batch(fn)
overridable(signal)
applyPatches(collection, patches)
createHistory({ target, limit? })
```

### Design guarantees

- Dependencies are created only by explicit tracking-function calls.
- Derived signals and derived collections are readonly.
- Cold derived values retain no upstream subscriptions.
- Collection snapshots/views and patch bundles are frozen.
- Collection mutations use explicit APIs rather than proxies or diffing.
- `subscribe(callback)` always sends an initial `init` change.

## Project status

Tracer is currently alpha software. The core architecture is usable and covered by runtime and type-level tests, but public APIs may still change as the collection, patch, and history models are refined.

Experimentation and early adoption are welcome. The most useful feedback at this stage concerns:

- API ergonomics and places where explicitness becomes cumbersome.
- Real-world reactive collection use cases.
- Patch formats, ordering, and inverse semantics.
- History and undo/redo behavior.
- Performance characteristics and edge cases.

Please [open an issue](https://github.com/gbdrummer/tracer/issues) with a focused example or use case.
