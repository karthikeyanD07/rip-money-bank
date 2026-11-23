import {createX42Service} from './x42.js';
import {createInternalTransferService} from './internal-transfers.js';
import {createPeerNetworkService} from './peer-network.js';
import {createSessionService} from './sessions.js';
import {createKycService} from './kyc.js';
import {createBeneficiaryService} from './beneficiaries.js';
import {createPortfolioService} from './portfolio.js';
import {createLoanService} from './loans-basic.js';
import {createAuthenticationService} from './authentication.js';
import {createKycStorageService} from './kyc-storage.js';
import {resolveBankByIfsc} from './bank-registry.js';
export function createBankSystem({db,sharedDb,storage,bankId,peerSecrets={},passwordHasher}) {
 const sessions=createSessionService({db});
 const x42=createX42Service({db,bankId});
 const auth=passwordHasher?createAuthenticationService({db,bankId,sessions,passwordHasher}):null;
 const kyc=createKycService({db,bankId});
 const kycStorage=storage?createKycStorageService({db,bucket:storage}):null;
 const beneficiaries=createBeneficiaryService({db,sharedDb});
 const internalTransfers=createInternalTransferService({db,bankId});
 const peers=createPeerNetworkService({db,sharedDb,x42,bankId,peerSecrets});
 const portfolio=createPortfolioService({db});
 const loans=createLoanService({db});
 return {bankId,db,sharedDb,sessions,x42,auth,kyc,kycStorage,beneficiaries,internalTransfers,peers,portfolio,loans,directory:{resolve:(ifsc)=>resolveBankByIfsc(sharedDb,ifsc)}};
}
