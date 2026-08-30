import {
  SignalibSignal,
  applyPatches,
  batch,
  createHistory,
  isSignal,
  overridable,
  signal,
  type ArrayPatch,
  type MapPatch,
  type PatchBundle,
  type SignalMap
} from 'signalib'

const count = signal(0)
count.setValue(1)
count.setValue(previous => previous + 1)
const countValue: number = count.getValue()

const doubled = signal($ => $(count) * 2)
const doubledValue: number = doubled.getValue()
// @ts-expect-error derived signals are readonly
doubled.setValue(4)

count.subscribe(change => {
  const next: number = change.nextValue
  if (change.kind === 'init') {
    const previous: undefined = change.previousValue
    void previous
  } else {
    const previous: number = change.previousValue
    void previous
  }
  return next
})

const result: string = batch(() => 'done')
void result
void countValue
void doubledValue

const localCount = overridable(count)
localCount.setValue(10)
localCount.clearOverride()
const overridden: boolean = localCount.isOverridden
void overridden
// @ts-expect-error clear was renamed to clearOverride
localCount.clear()

const items = signal.array([1, 2, 3])
const arrayChange = items.mutate(array => {
  array.set(0, 10)
  array.splice(1, 1, 20, 30)
  array.push(40)
})

if (arrayChange) {
  const patches: readonly ArrayPatch<number>[] = arrayChange.patches
  applyPatches(items, arrayChange.inversePatches)
  applyPatches(items, patches)
}

const derivedItems = signal.array($ => [$(count)])
const derivedLength: number = derivedItems.length.getValue()
void derivedLength
// @ts-expect-error derived collections are readonly
derivedItems.mutate(array => array.push(2))

const person = signal.object({ name: 'Ada', age: 36 })
person.mutate(object => {
  const age: number = object.get('age')
  object.set('age', age + 1)
  // @ts-expect-error known object keys preserve their value types
  object.set('age', 'old')
  object.set('role', 'programmer')
  object.assign({ name: 'Grace' })
})
const personName: string = person.getValue().name
const personKeys: readonly string[] = person.keys.getValue()
const personSize: number = person.size.getValue()
void personName
void personKeys
void personSize

interface User {
  name: string
  active: boolean
}

const users: SignalMap<string, User> = signal.map<string, User>()
const userChange = users.mutate(map => {
  map.set('ada', { name: 'Ada', active: true })
  map.delete('missing')
})

const ada = users.key('ada')
const maybeUser: User | undefined = ada.getValue().value
const mapKeys: readonly string[] = users.keys.getValue()
const mapSize: number = users.size.getValue()
void maybeUser
void mapKeys
void mapSize

const inferredUsers = signal.map([['ada', { name: 'Ada', active: true }]])
const inferredUser: { name: string, active: boolean } | undefined = inferredUsers.get('ada')
void inferredUser

const derivedCounts = signal.map($ => [['count', $(count)]])
const derivedCount: number | undefined = derivedCounts.get('count')
void derivedCount
// @ts-expect-error derived Maps are readonly
derivedCounts.mutate(map => map.set('count', 2))

if (userChange) {
  const bundle: PatchBundle<MapPatch<string, User>> = userChange
  applyPatches(users, bundle.inversePatches)
  applyPatches(users, bundle.patches)
}

const tags = signal.set<string>()
const tagChange = tags.mutate(set => {
  set.add('signals')
  set.delete('legacy')
})

if (tagChange) {
  applyPatches(tags, tagChange.inversePatches)
  applyPatches(tags, tagChange.patches)
}

const present: boolean = tags.value('signals').getValue().present
const tagValues: readonly string[] = tags.values.getValue()
const tagCount: number = tags.size.getValue()
void present
void tagValues
void tagCount
// @ts-expect-error Set values preserve their generic type
tags.mutate(set => set.add(123))

const history = createHistory({ target: users, limit: 100 })
if (userChange) history.record(userChange)
history.transaction(() => {
  const change = users.mutate(map => map.set('grace', { name: 'Grace', active: true }))
  if (change) history.record(change)
})
history.undo()
history.redo()

// @ts-expect-error scalar signals cannot be collection-history targets
createHistory({ target: count })
// @ts-expect-error Map targets only accept Map patches
applyPatches(users, [{ op: 'add', value: { name: 'Nope', active: false } }])

if (isSignal(users)) {
  const value: unknown = users.getValue()
  void value
}

const branded: boolean = users instanceof SignalibSignal
void branded
