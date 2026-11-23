/** Argon2id adapter. Install the native `argon2` package before starting the API. */
export function createArgon2PasswordHasher() {
 let modulePromise;
 const load=()=>modulePromise??=(async()=>{try{return await import('argon2');}catch{throw new Error('The argon2 package is required for UID/password login. Install it with: npm install argon2');}})();
 return {async hash(password){const argon2=await load();return argon2.hash(password,{type:argon2.argon2id,memoryCost:19456,timeCost:2,parallelism:1});},async verify(hash,password){const argon2=await load();return argon2.verify(hash,password);}};
}
