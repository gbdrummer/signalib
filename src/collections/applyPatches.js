const PATCH_APPLICATOR = Symbol('tracer.patchApplicator')

export function attachPatchApplicator (target, applicator) {
  Object.defineProperty(target, PATCH_APPLICATOR, { value: applicator })
  return target
}

export function getPatchOperation (patch, index, collectionType) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new TypeError(`${collectionType} patch at index ${index} must be an object`)
  }

  if (typeof patch.op !== 'string') {
    throw new TypeError(`${collectionType} patch at index ${index} must have a string op`)
  }

  return patch.op
}

export function unsupportedPatchOperation (collectionType, patch, index) {
  throw new TypeError(`${collectionType} patch operation "${patch.op}" at index ${index} is not supported`)
}

export default function applyPatches (target, patches) {
  if (!Array.isArray(patches)) throw new TypeError('applyPatches(target, patches) expects patches to be an array')

  const applicator = target?.[PATCH_APPLICATOR]
  if (typeof applicator !== 'function') {
    throw new TypeError('applyPatches(target, patches) expects target to be a writable Tracer collection signal')
  }

  return applicator(patches)
}
