export const COLLECTIONS = Object.freeze({
  users:'users', emailRegistry:'email_registry', sessions:'sessions', kycRequests:'kyc_requests', accounts:'accounts',
  beneficiaries:'beneficiaries', transfers:'transfers', ledgerEntries:'ledger_entries',
  transferLimits:'transfer_limits', dailyUsage:'daily_usage', idempotencyKeys:'idempotency_keys',
  interbankInbox:'interbank_inbox', loans:'loans', portfolios:'portfolios',
  notificationOutbox:'notification_outbox', auditLogs:'audit_logs'
});
export const ACCOUNT_STATUS = Object.freeze({PENDING:'PENDING', ACTIVE:'ACTIVE', HOLD:'HOLD', CLOSED:'CLOSED'});
export const TRANSFER_STATUS = Object.freeze({PENDING:'PENDING', COMPLETED:'COMPLETED', REJECTED:'REJECTED', FAILED:'FAILED'});
export function assertMinor(value, field='amountMinor') {
  if (!Number.isSafeInteger(value) || value <= 0) throw Object.assign(new Error(`${field} must be a positive safe integer in paise.`), {code:'INVALID_AMOUNT'});
  return value;
}
export function availableBalance(account) {
  const posted = account?.postedBalanceMinor, held = account?.heldMinor;
  if (!Number.isSafeInteger(posted) || posted < 0 || !Number.isSafeInteger(held) || held < 0 || held > posted) {
    throw Object.assign(new Error('Account balance invariant violated.'), {code:'BALANCE_INVARIANT'});
  }
  return posted - held;
}
