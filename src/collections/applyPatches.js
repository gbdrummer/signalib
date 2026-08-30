const PATCH_APPLICATOR = Symbol('signalib.patchApplicator')

export function attachPatchApplicator (target, applicator) {
  Object.defineProperty(target, PATCH_APPLICATOR, { value: applicator })
  return target
}

function getPatchApplicator (target) {
  const applicator = target?.[PATCH_APPLICATOR]
  if (!applicator || typeof applicator.apply !== 'function' || typeof applicator.validate !== 'function') {
    throw new TypeError('applyPatches(target, patches) expects target to be a writable Signalib collection signal')
  }

  return applicator
}

function assertPatchArray (patches) {
  if (!Array.isArray(patches)) throw new TypeError('applyPatches(target, patches) expects patches to be an array')
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

export function validatePatches (target, patches) {
  assertPatchArray(patches)
  return getPatchApplicator(target).validate(patches)
}

export function validatePatchBundle (target, bundle, context = 'perform') {
  const patches = bundle?.patches
  const inversePatches = bundle?.inversePatches

  assertPatchArray(patches)
  assertPatchArray(inversePatches)

  const applicator = getPatchApplicator(target)

  if (context === 'record') {
    const previousValue = applicator.validate(inversePatches)
    applicator.validate(patches, previousValue)
    return
  }

  const nextValue = applicator.validate(patches)
  applicator.validate(inversePatches, nextValue)
}

export function applyValidatedPatches (target, patches) {
  return getPatchApplicator(target).apply(patches)
}

export default function applyPatches (target, patches) {
  validatePatches(target, patches)
  return applyValidatedPatches(target, patches)
}
