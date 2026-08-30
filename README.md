# Signalib

Signalib is a JavaScript state library built on **signals** and **reactive collections** (Array, Object, Map, Set) with **explicit dependency tracking**.

- **Explicit signal dependencies:** you decide which signals should cause a calculation to update by using a tracked read.
- **Reactive Arrays, Objects, Maps, and Sets:** watch whole collections, structural changes, and dynamic Map entries or Set values.
- **Patches and history:** collection mutations return forward and inverse records that can be inspected, replayed, or recorded for undo and redo.

[![CI](https://github.com/gbdrummer/signalib/actions/workflows/ci.yml/badge.svg)](https://github.com/gbdrummer/signalib/actions/workflows/ci.yml)

## Why Signalib

Reactive code is easier to understand when you can answer a simple question: “What changes will make this update?”

The [TC39 Signals proposal](https://github.com/tc39/proposal-signals) and many signal libraries answer that question automatically by watching every signal read while a calculation runs. That can be convenient, but it also means a read hidden inside a helper function can quietly change what the calculation follows. The calculation may start updating for a new reason even though the calculation itself did not change.

Signalib makes those connections deliberate. An ordinary read just gets the current value; only an explicit tracked read tells Signalib to update a calculation when that value changes. This takes a little more typing, but it prevents hidden reads from creating unexpected reactivity.

Signalib brings the same clarity to collections. You can watch an entire Array, Object, Map, or Set, or only structural details such as length, keys, size, or Set values. Maps and Sets also expose stable signals for individual entries or values. Each edit returns a record of what changed and how to reverse it. Those records can be inspected, replayed, or passed to the included history helper for undo and redo.

## Installation

Signalib is ESM-only. TypeScript declarations are included for editor support and type checking; the runtime implementation remains JavaScript.

```sh
npm install signalib
```

```js
import {
  applyPatches,
  batch,
  createHistory,
  overridable,
  signal
} from 'signalib'
```

## Quick example

This example watches one user in a Map and keeps a record of the change:

```js
import { signal } from 'signalib'

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

`users.key('ada')` is a signal just for Ada's entry. Code watching it is notified when Ada changes, but not when an unrelated user changes. The mutation also returns a read-only record of the edit and its reverse.

## Explicit dependency tracking

When one value is calculated from other signals, the library needs to know which changes should run that calculation again. A signal that causes the calculation to run again is called a dependency.

In an automatically tracked system, every signal read while the calculation runs may become a dependency—even a read hidden inside another function. If that helper later starts reading a theme, locale, feature flag, or other setting, the calculation may begin updating for a new reason even though its own code did not change.

When you create a derived signal, Signalib gives its calculation a small helper function, usually named `$`. Signalib then offers two clearly different kinds of reads:

- **`someSignal.getValue()`** means “give me the value right now.”
- **`$(someSignal)`** means “give me the value and update this calculation when it changes.”

Here, the label follows `firstName`. It also reads the current `theme` when the calculation runs, but a theme change does not cause that calculation to run:

```js
const firstName = signal('Ada')
const theme = signal('light')

function readTheme () {
  return theme.getValue()
}

const label = signal($ => {
  return `${$(firstName)} (${readTheme()})`
})

label.subscribe(change => {
  if (change.kind === 'update') console.log(change.nextValue)
})

firstName.setValue('Grace') // logs: Grace (light)
theme.setValue('dark')      // logs nothing
```

The `theme` read cannot secretly make `label` follow `theme`, even though it happens inside a helper called by the calculation. This prevents “spooky action at a distance,” where a small change deep in a helper unexpectedly changes when distant code runs.

If the label should follow both values, say so directly:

```js
const themedLabel = signal($ => {
  return `${$(firstName)} (${$(theme)})`
})
```

This requires a little more typing than automatic tracking. In return, it is impossible for an ordinary read to create an unexpected dependency: if there is no `$()` call, that signal will not trigger the calculation.

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

`displayName` always depends on `useNickname`. It depends on either `nickname` or `name` according to the branch taken during its latest computation; Signalib updates those subscriptions when the branch changes.

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
import { signal } from 'signalib'

const users = signal.map([
  ['ada', { name: 'Ada' }]
])

users.mutate(map => {
  map.set('grace', { name: 'Grace' })
})

users.has('ada') // true
users.get('grace') // { name: 'Grace' }
users.size.getValue() // 2
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
selectedIds.size.getValue() // 1
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

Derived collections expose their readonly collection APIs and structural signals, but not `setValue()` or `mutate()`.

## Fine-grained collection signals

Collection signals let consumers observe structural or entry-level state without subscribing to every collection update.

| Collection | Structural signals | Stable entry signal |
| --- | --- | --- |
| Array | `length` | — |
| Object | `keys`, `size` | — |
| Map | `keys`, `size` | `key(key)` → `{ present, value }` |
| Set | `values`, `size` | `value(value)` → `{ present }` |

For example, a user directory can expose whole-collection changes, structural changes, one user's entry, derived state, and mutation records independently:

```js
import { signal } from 'signalib'

const users = signal.map([
  ['ada', { name: 'Ada' }]
])

const ada = users.key('ada')
const userCount = signal($ => $(users.size))

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

logUpdates('keys:', users.keys)
logUpdates('size:', users.size)
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
import { signal } from 'signalib'

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
import { applyPatches, signal } from 'signalib'

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

`createHistory({ target })` connects a writable Signalib collection directly to the patch-based history engine:

```js
import { createHistory, signal } from 'signalib'

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

Undo and redo validate their complete patch list before mutation. If collection state commits and a subscriber then throws, the error is rethrown while the history stacks still move to reflect the committed state.

For custom patch formats, the lower-level generic engine is available from `signalib/history`:

```js
import createHistory from 'signalib/history'
```

See the generic engine's [standalone documentation](./src/history/README.md).

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

Signalib is currently alpha software. The core architecture is usable and covered by runtime and type-level tests, but public APIs may still change as the collection, patch, and history models are refined.

Experimentation and early adoption are welcome. The most useful feedback at this stage concerns:

- API ergonomics and places where explicitness becomes cumbersome.
- Real-world reactive collection use cases.
- Patch formats, ordering, and inverse semantics.
- History and undo/redo behavior.
- Performance characteristics and edge cases.

Please [open an issue](https://github.com/gbdrummer/signalib/issues) with a focused example or use case.
