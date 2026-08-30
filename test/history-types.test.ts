import createHistory, {
  type PatchBundle
} from '@gbdrummer/signalib/history'

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
  validatePatches: patches => {
    for (const patch of patches) {
      const value: number = patch.value
      void value
    }
  },
  validateBundle: (candidate, context) => {
    const patch: SetPatch | undefined = candidate.patches[0]
    const phase: 'record' | 'perform' = context
    void patch
    void phase
  },
  batch: callback => callback(),
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

// @ts-expect-error generic validation hooks retain the patch type
createHistory<SetPatch>({ applyPatches: () => {}, validatePatches: (patches: readonly string[]) => patches })
