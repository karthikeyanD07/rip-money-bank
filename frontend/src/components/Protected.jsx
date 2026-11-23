import {Navigate,Outlet} from 'react-router-dom';
import {useAuth} from '../app/AuthContext';
export default function Protected({admin=false}) { const {user,loading}=useAuth(); if(loading)return <div className="loading">Securing your session…</div>; if(!user)return <Navigate to="/login" replace/>; if(admin&&!['ADMIN','SUPER_ADMIN'].includes(user.role))return <Navigate to="/customer" replace/>; if(!admin&&['ADMIN','SUPER_ADMIN'].includes(user.role))return <Navigate to="/admin" replace/>; return <Outlet/>; }
