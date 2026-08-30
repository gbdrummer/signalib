import createHistory, {
  type PatchBundle
} from '../src/history/index.js'

interface SetPatch {
  readonly op: 'set'
  readonly key: string
  readonly value: number
}

const state: Record<string, number> = {}
const history = createHistory<SetPatch>({
  applyPatches: patches => {
    for (const patch of patches) state[patch.key] = patch.value
  },
  limit: 50
})

const bundle: PatchBundle<SetPatch> = {
  patches: [{ op: 'set', key: 'count', value: 1 }],
  inversePatches: [{ op: 'set', key: 'count', value: 0 }]
}

history.perform(bundle)
history.undo()
history.redo()
history.subscribe((next, previous) => {
  const canUndo: boolean = next.canUndo
  const previousCanRedo: boolean | undefined = previous?.canRedo
  void canUndo
  void previousCanRedo
})

// @ts-expect-error generic history patches retain their value type
history.record({ patches: [{ op: 'set', key: 'count', value: 'wrong' }], inversePatches: [] })
