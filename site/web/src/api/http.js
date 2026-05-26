const API = import.meta.env.VITE_API_URL || 'http://localhost:3333';

export function getToken(){return localStorage.getItem('token');}
export function setToken(t){localStorage.setItem('token',t);}
export function clearToken(){localStorage.removeItem('token');}

export function authHeaders(){
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path,{method='GET',body,headers={},auth=true}={}){
  const h={'Content-Type':'application/json',...headers};
  if(auth){const token=getToken(); if(token) h.Authorization=`Bearer ${token}`;}
  const res=await fetch(`${API}${path}`,{method,headers:h,body:body?JSON.stringify(body):undefined});
  const isJson=(res.headers.get('content-type')||'').includes('application/json');
  const data=isJson?await res.json():await res.text();
  if(!res.ok) throw new Error(data?.error||data?.message||'Erro');
  return data;
}

export const http={
  get:(p,o)=>request(p,{...o,method:'GET'}),
  post:(p,b,o)=>request(p,{...o,method:'POST',body:b}),
  put:(p,b,o)=>request(p,{...o,method:'PUT',body:b}),
  del:(p,o)=>request(p,{...o,method:'DELETE'})
};

export const API_URL = API;
