const runImmediately = callback => callback()
const skipValidation = () => {}

export default function createHistory ({
  applyPatches,
  validatePatches = skipValidation,
  validateBundle = skipValidation,
  batch = runImmediately,
  limit = Infinity
} = {}) {
  if (typeof applyPatches !== 'function') throw new TypeError('createHistory({ applyPatches }) expects applyPatches to be a function')
  if (typeof validatePatches !== 'function') throw new TypeError('createHistory({ validatePatches }) expects validatePatches to be a function')
  if (typeof validateBundle !== 'function') throw new TypeError('createHistory({ validateBundle }) expects validateBundle to be a function')
  if (typeof batch !== 'function') throw new TypeError('createHistory({ batch }) expects batch to be a function')
  if (!Number.isFinite(limit)) limit = Infinity
  if (limit < 0) throw new TypeError('createHistory({ limit }) expects limit to be a non-negative number')

  const past = []
  const future = []
  const subscriptions = new Set

  let depth = 0
  let pendingBundles = null
  let isApplying = false

  function cloneAndFreezePatchArray (patches) {
    if (!Array.isArray(patches)) throw new TypeError('Expected patch list to be an array')

    const next = patches.map(patch => {
      if (!patch || typeof patch !== 'object') return patch
      return Object.freeze({ ...patch })
    })

    return Object.freeze(next)
  }

  function normalizeBundle (bundle, context) {
    const patches = bundle?.patches
    const inversePatches = bundle?.inversePatches

    if (!Array.isArray(patches) || !Array.isArray(inversePatches)) {
      throw new TypeError('history bundle expects patches and inversePatches to be arrays')
    }

    const normalized = Object.freeze({
      patches: cloneAndFreezePatchArray(patches),
      inversePatches: cloneAndFreezePatchArray(inversePatches),
      meta: bundle?.meta
    })

    validateBundle(normalized, context)
    return normalized
  }

  function createStep (bundles) {
    return Object.freeze({ bundles: Object.freeze(bundles.slice()) })
  }

  function getState () {
    return {
      canUndo: past.length > 0,
      canRedo: future.length > 0
    }
  }

  function notify (previousState) {
    if (subscriptions.size === 0) return

    const nextState = getState()
    let firstError

    for (const cb of subscriptions) {
      try {
        cb(nextState, previousState)
      } catch (err) {
        firstError ??= err
      }
    }

    if (firstError) throw firstError
  }

  function notifyIfChanged (previousState) {
    const next = getState()
    if (previousState.canUndo === next.canUndo && previousState.canRedo === next.canRedo) return
    notify(previousState)
  }

  function subscribe (cb) {
    if (typeof cb !== 'function') throw new TypeError('history.subscribe(cb) expects cb to be a function')

    subscriptions.add(cb)
    try {
      cb(getState(), undefined)
    } catch (err) {
      subscriptions.delete(cb)
      throw err
    }

    return () => {
      subscriptions.delete(cb)
    }
  }

  function commitPending () {
    if (!pendingBundles || pendingBundles.length === 0) return
    if (limit === 0) {
      pendingBundles = null
      return
    }

    past.push(createStep(pendingBundles))
    pendingBundles = null

    if (past.length > limit) past.splice(0, past.length - limit)
  }

  function recordNormalized (bundle) {
    const previousState = getState()

    if (depth > 0) {
      pendingBundles ??= []
      pendingBundles.push(bundle)
      return true
    }

    if (limit === 0) return false

    past.push(createStep([bundle]))
    if (past.length > limit) past.splice(0, past.length - limit)
    future.length = 0

    notifyIfChanged(previousState)
    return true
  }

  function record (bundle) {
    if (isApplying) return false
    return recordNormalized(normalizeBundle(bundle, 'record'))
  }

  function perform (bundle) {
    if (isApplying) throw new Error('history.perform() cannot be called while applying history')

    const normalized = normalizeBundle(bundle, 'perform')

    return batch(() => {
      applyPatches(normalized.patches)
      return recordNormalized(normalized)
    })
  }

  function transaction (fn) {
    if (typeof fn !== 'function') throw new TypeError('history.transaction(fn) expects fn to be a function')

    const previousState = depth === 0 ? getState() : null
    depth++
    try {
      return fn()
    } finally {
      depth--
      if (depth === 0) {
        commitPending()
        future.length = 0
        previousState && notifyIfChanged(previousState)
      }
    }
  }

  function collectStepPatches (step, direction) {
    const patches = []

    if (direction === 'undo') {
      for (let i = step.bundles.length - 1; i >= 0; i--) {
        patches.push(...step.bundles[i].inversePatches)
      }
      return patches
    }

    for (const bundle of step.bundles) patches.push(...bundle.patches)
    return patches
  }

  function applySteps ({ source, destination, count, direction }) {
    const previousState = getState()
    let didApply = false
    let applyError

    isApplying = true
    try {
      batch(() => {
        while (count-- > 0 && source.length > 0) {
          const step = source[source.length - 1]
          const patches = collectStepPatches(step, direction)

          validatePatches(patches)
          applyPatches(patches)

          source.pop()
          destination.push(step)
          didApply = true
        }
      })
    } catch (err) {
      applyError = err
    } finally {
      isApplying = false
    }

    if (direction === 'redo' && past.length > limit) {
      past.splice(0, past.length - limit)
    }

    let notificationError
    if (didApply) {
      try {
        notifyIfChanged(previousState)
      } catch (err) {
        notificationError = err
      }
    }

    if (applyError) throw applyError
    if (notificationError) throw notificationError
    return didApply
  }

  function undo (count = 1) {
    if (!Number.isInteger(count) || count < 0) throw new TypeError('history.undo(count) expects count to be a non-negative integer')
    if (count === 0 || past.length === 0) return false

    return applySteps({
      source: past,
      destination: future,
      count,
      direction: 'undo'
    })
  }

  function redo (count = 1) {
    if (!Number.isInteger(count) || count < 0) throw new TypeError('history.redo(count) expects count to be a non-negative integer')
    if (count === 0 || future.length === 0) return false

    return applySteps({
      source: future,
      destination: past,
      count,
      direction: 'redo'
    })
  }

  function clear () {
    const previousState = getState()
    past.length = 0
    future.length = 0
    pendingBundles = null

    if (depth === 0) notifyIfChanged(previousState)
  }

  function getStacks () {
    return Object.freeze({
      past: Object.freeze(past.slice()),
      future: Object.freeze(future.slice())
    })
  }

  return Object.defineProperties({}, {
    transaction: { value: transaction },
    record: { value: record },
    perform: { value: perform },
    undo: { value: undo },
    redo: { value: redo },
    clear: { value: clear },
    getStacks: { value: getStacks },
    subscribe: { value: subscribe },

    canUndo: { get: () => past.length > 0 },
    canRedo: { get: () => future.length > 0 }
  })
}
