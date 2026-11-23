
import fs from 'node:fs';

import {
  applicationDefault,
  cert,
  getApps,
  initializeApp
} from 'firebase-admin/app';

import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { assertSafeEnvironment } from './guards.js';

const configuredFirestoreInstances = new WeakSet();

function createCredential(credentialPath) {
  if (!credentialPath) {
    return applicationDefault();
  }

  const serviceAccount = JSON.parse(
    fs.readFileSync(credentialPath, 'utf8')
  );

  return cert(serviceAccount);
}

function appNamed(name, projectId, credentialPath, useEmulators, storageBucket) {
  const existingApp = getApps().find(app => app.name === name);

  if (existingApp) {
    if (existingApp.options.projectId !== projectId) {
      throw new Error(
        `Firebase app "${name}" already exists with a different project ID.`
      );
    }

    return existingApp;
  }

  const options = { projectId };
  if (storageBucket) options.storageBucket = storageBucket;
  if (!useEmulators) options.credential = createCredential(credentialPath);
  return initializeApp(options, name);
}

function configureFirestoreEmulator(db, host) {
  if (configuredFirestoreInstances.has(db)) {
    return;
  }

  db.settings({
    host,
    ssl: false
  });

  configuredFirestoreInstances.add(db);
}


export function connectSharedFirebase(env = process.env) {
  if (!env.SHARED_FIREBASE_PROJECT_ID) throw new Error('SHARED_FIREBASE_PROJECT_ID is required.');
  const useEmulators = env.USE_EMULATORS === 'true';
  if (!useEmulators && !env.DIRECTORY_MAINTAINER_SERVICE_ACCOUNT) throw new Error('DIRECTORY_MAINTAINER_SERVICE_ACCOUNT is required for central directory maintenance.');
  const app = appNamed('shared-directory-maintainer', env.SHARED_FIREBASE_PROJECT_ID, env.DIRECTORY_MAINTAINER_SERVICE_ACCOUNT, useEmulators);
  const sharedDb = getFirestore(app);
  if (useEmulators) configureFirestoreEmulator(sharedDb, env.SHARED_FIRESTORE_EMULATOR || '127.0.0.1:8180');
  return { sharedDb, sharedApp: app };
}

export function connectFirebase(env = process.env) {
  assertSafeEnvironment(env);
  if (!env.PRIVATE_FIREBASE_PROJECT_ID) {
    throw new Error('PRIVATE_FIREBASE_PROJECT_ID is required.');
  }

  if (!env.SHARED_FIREBASE_PROJECT_ID) {
    throw new Error('SHARED_FIREBASE_PROJECT_ID is required.');
  }

  if (env.USE_EMULATORS === 'true') {
    process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= env.PRIVATE_STORAGE_EMULATOR || '127.0.0.1:9199';
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||=
      env.PRIVATE_AUTH_EMULATOR || '127.0.0.1:9099';
  }

  const useEmulators = env.USE_EMULATORS === 'true';
  const privateApp = appNamed(
    'private-bank',
    env.PRIVATE_FIREBASE_PROJECT_ID,
    env.PRIVATE_SERVICE_ACCOUNT,
    useEmulators,
    env.STORAGE_BUCKET
  );

  const sharedApp = appNamed(
    'shared-network',
    env.SHARED_FIREBASE_PROJECT_ID,
    env.SHARED_SERVICE_ACCOUNT,
    useEmulators,
    undefined
  );

  const auth = getAuth(privateApp);
  const db = getFirestore(privateApp);
  const sharedDb = getFirestore(sharedApp);
  const storage = getStorage(privateApp).bucket(env.STORAGE_BUCKET || undefined);

  if (env.USE_EMULATORS === 'true') {
    configureFirestoreEmulator(
      db,
      env.PRIVATE_FIRESTORE_EMULATOR || '127.0.0.1:8080'
    );

    configureFirestoreEmulator(
      sharedDb,
      env.SHARED_FIRESTORE_EMULATOR || '127.0.0.1:8080'
    );
  }

  return {
    auth,
    db,
    sharedDb,
    storage,
    privateApp,
    sharedApp
  };
}