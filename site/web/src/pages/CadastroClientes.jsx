import React, { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Topbar from '../components/Topbar.jsx';
import { http, authHeaders, API_URL } from '../api/http.js';

function onlyDigits(s){return String(s||'').replace(/\D/g,'');}

async function uploadPhoto(clientId, file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${API_URL}/files/clients/${clientId}/photo`, { method:'POST', headers: { ...authHeaders() }, body: fd });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data?.error || 'Falha ao enviar foto');
}

async function uploadDocs(clientId, files) {
  const fd = new FormData();
  for (const f of files) fd.append('files', f);
  const res = await fetch(`${API_URL}/files/clients/${clientId}/docs`, { method:'POST', headers: { ...authHeaders() }, body: fd });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data?.error || 'Falha ao enviar documentos');
}

export default function CadastroClientes() {
  const { openMenu } = useOutletContext();
  const [form, setForm] = useState({
    cpf:'', nome:'', telefone:'',
    cep:'', rua:'', numero:'', bairro:'', cidade:'', uf:'',
    indicacao:'', obs:'',
    optin_whatsapp:true
  });
  const [saving, setSaving] = useState(false);
  const [cepStatus, setCepStatus] = useState({ loading:false, error:'' });
  const lastFetchedCepRef = useRef('');
  const debounceRef = useRef(null);

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [docFiles, setDocFiles] = useState([]);

  function setField(k,v){ setForm(prev=>({...prev,[k]:v})); }

  useEffect(() => {
    if (!photoFile) { setPhotoPreview(''); return; }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  useEffect(() => {
    const cepDigits = onlyDigits(form.cep);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (cepDigits.length !== 8) {
      setCepStatus({ loading:false, error:'' });
      lastFetchedCepRef.current = '';
      return;
    }
    if (lastFetchedCepRef.current === cepDigits) return;

    debounceRef.current = setTimeout(async () => {
      try {
        setCepStatus({ loading:true, error:'' });
        const res = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
        const data = await res.json();
        if (data?.erro) {
          setCepStatus({ loading:false, error:'CEP não encontrado' });
          lastFetchedCepRef.current = '';
          return;
        }
        lastFetchedCepRef.current = cepDigits;
        setCepStatus({ loading:false, error:'' });
        setForm(prev => ({
          ...prev,
          rua: data.logradouro || prev.rua,
          bairro: data.bairro || prev.bairro,
          cidade: data.localidade || prev.cidade,
          uf: data.uf || prev.uf,
        }));
      } catch {
        setCepStatus({ loading:false, error:'Falha ao consultar CEP' });
        lastFetchedCepRef.current = '';
      }
    }, 400);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [form.cep]);

  async function submit(e){
    e.preventDefault();
    if(saving) return;
    setSaving(true);
    try{
      const created = await http.post('/clients', {
        cpf: onlyDigits(form.cpf),
        nome: form.nome,
        telefone: form.telefone,
        cep: form.cep || null,
        rua: form.rua || null,
        numero: form.numero || null,
        bairro: form.bairro || null,
        cidade: form.cidade || null,
        uf: form.uf ? String(form.uf).toUpperCase() : null,
        indicacao: form.indicacao || null,
        obs: form.obs || null,
        optin_whatsapp: !!form.optin_whatsapp
      });

      // ✅ Enviar foto e docs (se houver)
      if (photoFile) await uploadPhoto(created.id, photoFile);
      if (docFiles.length) await uploadDocs(created.id, docFiles);

      alert('Cliente cadastrado!');
      setForm({ cpf:'', nome:'', telefone:'', cep:'', rua:'', numero:'', bairro:'', cidade:'', uf:'', indicacao:'', obs:'', optin_whatsapp:true });
      setPhotoFile(null);
      setDocFiles([]);
      setCepStatus({ loading:false, error:'' });
      lastFetchedCepRef.current = '';
    } catch(err){
      alert('Erro: ' + err.message);
    } finally { setSaving(false); }
  }

  const cepHelp = cepStatus.loading ? 'Consultando CEP...' : (cepStatus.error ? cepStatus.error : '');

  return (
    <div>
      <Topbar title="Cadastro (Cliente/Pessoa)" onMenu={openMenu} />
      <div className="p-4 max-w-[1100px] mx-auto">
        <div className="bg-white border rounded-2xl p-4 shadow-soft">
          <form className="space-y-4" onSubmit={submit}>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><label className="text-sm">CPF</label><input className="w-full border rounded-lg px-3 py-2" value={form.cpf} onChange={e=>setField('cpf',e.target.value)} /></div>
              <div><label className="text-sm">Nome</label><input className="w-full border rounded-lg px-3 py-2" value={form.nome} onChange={e=>setField('nome',e.target.value)} /></div>
              <div><label className="text-sm">Telefone</label><input className="w-full border rounded-lg px-3 py-2" value={form.telefone} onChange={e=>setField('telefone',e.target.value)} /></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-sm">CEP</label>
                <input className={`w-full border rounded-lg px-3 py-2 ${cepStatus.error ? 'border-red-400' : ''}`} value={form.cep} onChange={e=>setField('cep',e.target.value)} placeholder="00000-000" />
                {cepHelp ? <div className={`text-xs mt-1 ${cepStatus.error ? 'text-red-600' : 'text-slate-500'}`}>{cepHelp}</div> : null}
              </div>
              <div className="md:col-span-2"><label className="text-sm">Rua</label><input className="w-full border rounded-lg px-3 py-2" value={form.rua} onChange={e=>setField('rua',e.target.value)} /></div>
              <div><label className="text-sm">Número</label><input className="w-full border rounded-lg px-3 py-2" value={form.numero} onChange={e=>setField('numero',e.target.value)} /></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><label className="text-sm">Bairro</label><input className="w-full border rounded-lg px-3 py-2" value={form.bairro} onChange={e=>setField('bairro',e.target.value)} /></div>
              <div><label className="text-sm">Cidade</label><input className="w-full border rounded-lg px-3 py-2" value={form.cidade} onChange={e=>setField('cidade',e.target.value)} /></div>
              <div><label className="text-sm">UF</label><input className="w-full border rounded-lg px-3 py-2" maxLength={2} value={form.uf} onChange={e=>setField('uf',e.target.value.toUpperCase())} /></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><label className="text-sm">Indicação</label><input className="w-full border rounded-lg px-3 py-2" value={form.indicacao} onChange={e=>setField('indicacao',e.target.value)} /></div>
              <div><label className="text-sm">Obs</label><input className="w-full border rounded-lg px-3 py-2" value={form.obs} onChange={e=>setField('obs',e.target.value)} /></div>
            </div>

            {/* ✅ Foto e Documentos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-2xl p-3">
                <div className="font-semibold">Foto do cliente</div>
                <div className="text-xs text-slate-500 mb-2">PNG/JPG (até 15MB)</div>
                <input type="file" accept="image/*" onChange={e=>setPhotoFile(e.target.files?.[0] || null)} />
                {photoPreview ? (
                  <img src={photoPreview} alt="preview" className="mt-3 w-40 h-40 object-cover rounded-xl border" />
                ) : (
                  <div className="mt-3 text-xs text-slate-400">Sem foto selecionada</div>
                )}
              </div>

              <div className="border rounded-2xl p-3">
                <div className="font-semibold">Anexos de documentos</div>
                <div className="text-xs text-slate-500 mb-2">PDF/JPG/PNG (até 10 arquivos)</div>
                <input type="file" multiple onChange={e=>setDocFiles(Array.from(e.target.files || []))} />
                {docFiles.length ? (
                  <ul className="mt-3 text-sm list-disc pl-5">
                    {docFiles.map((f,i)=>(<li key={i}>{f.name}</li>))}
                  </ul>
                ) : (
                  <div className="mt-3 text-xs text-slate-400">Nenhum documento selecionado</div>
                )}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.optin_whatsapp} onChange={e=>setField('optin_whatsapp',e.target.checked)} /> Opt-in WhatsApp</label>

            <button disabled={saving} className={`px-4 py-2 rounded-lg text-white ${saving?'bg-slate-400':'bg-emerald-600 hover:bg-emerald-700'}`}>{saving?'Salvando...':'Salvar'}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
