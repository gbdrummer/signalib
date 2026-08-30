import applyPatches from './collections/applyPatches.js'
import createPatchHistory from './history/index.js'

export default function createHistory ({ target, limit = Infinity } = {}) {
  try {
    applyPatches(target, [])
  } catch {
    throw new TypeError('createHistory({ target }) expects target to be a writable Tracer collection signal')
  }

  return createPatchHistory({
    applyPatches: patches => applyPatches(target, patches),
    limit
  })
}
