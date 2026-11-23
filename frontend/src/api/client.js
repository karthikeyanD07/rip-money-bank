const BASE = '/api/v1';
let csrfToken = sessionStorage.getItem('rip.csrf') || '';
export function setCsrfToken(value) { csrfToken = value || ''; if (csrfToken) sessionStorage.setItem('rip.csrf', csrfToken); else sessionStorage.removeItem('rip.csrf'); }
export async function api(path, options={}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  const rawBinary = typeof Blob !== 'undefined' && options.body instanceof Blob;
  if (options.body && !(options.body instanceof FormData) && !rawBinary) headers.set('content-type','application/json');
  if (!['GET','HEAD','OPTIONS'].includes(method) && csrfToken) headers.set('x-csrf-token',csrfToken);
  if (options.idempotencyKey) headers.set('idempotency-key',options.idempotencyKey);
  const response = await fetch(`${BASE}${path}`, { ...options, method, headers, credentials:'include', body: options.body && typeof options.body !== 'string' && !(options.body instanceof FormData) && !rawBinary ? JSON.stringify(options.body) : options.body });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) { const error = new Error(data.message || data.error || `Request failed (${response.status})`); error.status=response.status; error.code=data.error; throw error; }
  return data;
}
export const formatINR = minor => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format((Number(minor)||0)/100);
export const formatDate = value => { const d=value?.seconds?new Date(value.seconds*1000):new Date(value); return Number.isNaN(d.getTime())?'—':d.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}); };
