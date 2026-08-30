import {
  applyValidatedPatches,
  validatePatchBundle,
  validatePatches
} from './collections/applyPatches.js'
import { batch } from './core/queue.js'
import createPatchHistory from './history/index.js'

export default function createHistory ({ target, limit = Infinity } = {}) {
  try {
    validatePatches(target, [])
  } catch {
    throw new TypeError('createHistory({ target }) expects target to be a writable Tracer collection signal')
  }

  return createPatchHistory({
    applyPatches: patches => applyValidatedPatches(target, patches),
    validatePatches: patches => validatePatches(target, patches),
    validateBundle: (bundle, context) => validatePatchBundle(target, bundle, context),
    batch,
    limit
  })
}
