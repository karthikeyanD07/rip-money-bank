
import 'dotenv/config';
import fs from 'node:fs';

import {
  applicationDefault,
  cert,
  initializeApp
} from 'firebase-admin/app';

import { getFirestore } from 'firebase-admin/firestore';

if (process.env.USE_EMULATORS !== 'true') {
  throw new Error(
    'Synthetic seed is emulator-only. Set USE_EMULATORS=true.'
  );
}

const projectId = process.env.PRIVATE_FIREBASE_PROJECT_ID;

if (!projectId) {
  throw new Error('Set PRIVATE_FIREBASE_PROJECT_ID.');
}

process.env.FIREBASE_AUTH_EMULATOR_HOST ||=
  process.env.PRIVATE_AUTH_EMULATOR || '127.0.0.1:9099';

const credentialPath = process.env.PRIVATE_SERVICE_ACCOUNT;

const credential = credentialPath
  ? cert(JSON.parse(fs.readFileSync(credentialPath, 'utf8')))
  : applicationDefault();

const app = initializeApp(
  {
    projectId,
    credential
  },
  'synthetic-seed'
);

const db = getFirestore(app);

const profile = process.env.SEED_PROFILE || 'demo';

const count =
  profile === 'stress'
    ? 250
    : profile === 'development'
      ? 100
      : 20;

const batchLimit = 400;

let batch = db.batch();
let writes = 0;
let committed = 0;

async function flush() {
  if (!writes) {
    return;
  }

  await batch.commit();

  committed += writes;
  batch = db.batch();
  writes = 0;
}

function set(ref, data) {
  batch.set(ref, data);
  writes++;
}

const now = new Date('2026-01-01T00:00:00.000Z');

try {
  for (let i = 1; i <= count; i++) {
    const customerId = `SEED-C-${String(i).padStart(5, '0')}`;
    const uid = `seed-user-${String(i).padStart(5, '0')}`;

    const customerRef = db.collection('customers').doc(customerId);

    set(customerRef, {
      fullName: `Demo Customer ${i}`,
      email: `customer${i}@example.test`,
      phone: `900000${String(i).padStart(4, '0')}`,
      address: `Demo Address ${i}`,
      kycStatus: i % 7 === 0 ? 'PENDING' : 'APPROVED',
      createdAt: now,
      updatedAt: now
    });

    set(db.collection('users').doc(uid), {
      customerId,
      email: `customer${i}@example.test`,
      role: 'CUSTOMER',
      isActive: true,
      synthetic: true,
      createdAt: now
    });

    const accountCount = i % 5 === 0 ? 2 : 1;

    for (let j = 1; j <= accountCount; j++) {
      const accountId =
        `SEED-A-${String(i).padStart(5, '0')}-${j}`;

      const accountNumber =
        Number(`8${String(i).padStart(6, '0')}${j}`);

      const balancePaise =
        100000 + (i * 1250) + (j * 50000);

      const status =
        i % 11 === 0
          ? 'HOLD'
          : i % 9 === 0
            ? 'PENDING'
            : 'APPROVED';

      set(db.collection('accounts').doc(accountId), {
        customerId,
        accountNumber,
        accountType: j === 1 ? 'SAVINGS' : 'CURRENT',
        bankCode: process.env.BANK_CODE || 'B07',
        status,
        balancePaise,
        transferLimitPaise: 1000000,
        currency: 'INR',
        createdAt: now,
        updatedAt: now,
        synthetic: true
      });

      set(
        db.collection('ledger_entries').doc(`${accountId}_OPENING`),
        {
          accountId,
          direction: 'CREDIT',
          amountPaise: balancePaise,
          type: 'OPENING_BALANCE',
          createdAt: now,
          synthetic: true
        }
      );

      for (let k = 1; k <= 3; k++) {
        const txnId =
          `SEED-T-${String(i).padStart(5, '0')}-${j}-${k}`;

        const amount = 1000 * k;
        const createdAt = new Date(
          now.getTime() + k * 60000
        );

        set(db.collection('transactions').doc(txnId), {
          accountId,
          type: k % 2 ? 'DEBIT' : 'CREDIT',
          amountPaise: amount,
          status: 'COMPLETED',
          channel: 'SYNTHETIC',
          createdAt,
          synthetic: true
        });

        set(db.collection('ledger_entries').doc(txnId), {
          accountId,
          direction: k % 2 ? 'DEBIT' : 'CREDIT',
          amountPaise: amount,
          createdAt,
          synthetic: true
        });
      }
    }

    set(db.collection('kyc_records').doc(customerId), {
      customerId,
      status: i % 7 === 0 ? 'PENDING' : 'APPROVED',
      documentStatus: 'SYNTHETIC_METADATA_ONLY',
      synthetic: true,
      createdAt: now
    });

    if (writes >= batchLimit) {
      await flush();
    }
  }

  await flush();

  console.log(
    `Seeded ${count} synthetic customers using ${committed} writes (${profile} profile).`
  );
} finally {
  await app.delete();
}