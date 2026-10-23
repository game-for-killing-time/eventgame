import {createRemoteJWKSet,jwtVerify} from 'jose';
const keys=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
export async function verifyIdentity(token,project,now=Date.now(),keyset=keys){
 const {payload}=await jwtVerify(token,keyset,{algorithms:['RS256'],issuer:`https://securetoken.google.com/${project}`,audience:project,currentDate:new Date(now)});
 if(!payload.sub||typeof payload.sub!=='string'||payload.sub.length>128||typeof payload.iat!=='number'||payload.iat>now/1000||typeof payload.auth_time!=='number'||payload.auth_time>now/1000)throw Error('登入驗證失敗。');
 return {uid:payload.sub,provider:payload.firebase?.sign_in_provider||''};
}
