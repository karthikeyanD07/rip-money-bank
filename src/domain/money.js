import {fail} from './errors.js';
export function rupeesToPaise(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) fail('INVALID_AMOUNT','Amount must be greater than zero.');
  const scaled = value * 100, rounded = Math.round(scaled);
  if (!Number.isSafeInteger(rounded) || Math.abs(scaled-rounded) > 1e-7) fail('INVALID_AMOUNT','Amount may have at most two decimal places.');
  return rounded;
}
export function assertPaise(value, {allowZero=false}={}) {
  if (!Number.isSafeInteger(value) || (allowZero ? value < 0 : value <= 0)) fail('INVALID_AMOUNT','Money must be represented as integer paise.');
  return value;
}
export const paiseToRupees = value => { assertPaise(value,{allowZero:true}); return Number((value/100).toFixed(2)); };
