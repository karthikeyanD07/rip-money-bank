import {createContext,useContext,useEffect,useMemo,useState} from 'react';
import {api,setCsrfToken} from '../api/client';
const AuthContext=createContext(null);
export function AuthProvider({children}) {
 const [user,setUser]=useState(null),[loading,setLoading]=useState(true);
 useEffect(()=>{api('/auth/me').then(setUser).catch(()=>setUser(null)).finally(()=>setLoading(false));},[]);
 const value=useMemo(()=>({user,loading,async login(email,password){const result=await api('/auth/login',{method:'POST',body:{email,password}});setCsrfToken(result.csrfToken);const me=await api('/auth/me');setUser(me);return me;},async logout(){try{await api('/auth/logout',{method:'POST',body:{}});}finally{setCsrfToken('');setUser(null);}}}),[user,loading]);
 return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth=()=>useContext(AuthContext);
