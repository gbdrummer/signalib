import { SIGNAL_BRAND } from './constants.js'

export default Object.defineProperty(SignalibSignal, Symbol.hasInstance, {
  value: v => !!v && v[SIGNAL_BRAND] === true
})

function SignalibSignal () {
  throw new TypeError('SignalibSignal is not constructible')
}
