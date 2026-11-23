import {fail} from '../domain/errors.js';
export function assertSafeEnvironment(env=process.env) {
  if(env.NODE_ENV==='production' && env.USE_EMULATORS==='true') fail('UNSAFE_ENV','Emulators cannot be used in production.');
  if(env.USE_EMULATORS!=='true' && (!env.PRIVATE_SERVICE_ACCOUNT || !env.SHARED_SERVICE_ACCOUNT)) {
    fail('MISSING_CREDENTIALS','Both private and shared service-account files are required outside emulator mode.');
  }
  if(env.PRIVATE_FIREBASE_PROJECT_ID && env.PRIVATE_FIREBASE_PROJECT_ID===env.SHARED_FIREBASE_PROJECT_ID) {
    fail('PROJECT_SEPARATION_REQUIRED','Private and shared Firebase projects must be different.');
  }
}
