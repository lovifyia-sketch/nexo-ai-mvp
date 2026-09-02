import { FormEvent, useEffect, useState } from 'react'
import { Activity, Bot, Boxes, Brain, CircleDollarSign, LogOut, MessageCircle, RefreshCcw, Settings2, Users, Wifi, WifiOff, X } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import TrainingPanel from './TrainingPanel'

type ConnectResult = {
  ok?: boolean
  error?: string
  instanceName?: string
  state?: string
  connected?: boolean
  qrBase64?: string | null
  pairingCode?: string | null
}

const cards = [
  { label: 'Clientes ativos', value: '0', icon: Users },
  { label: 'Produtos', value: '0', icon: Boxes },
  { label: 'Renovações próximas', value: '0', icon: RefreshCcw },
  { label: 'Conversas hoje', value: '0', icon: MessageCircle },
]

function Auth() {
  const [mode, setMode] = useState<'login'|'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setLoading(true)
    setMessage('')
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })

    if (result.error) setMessage(result.error.message)
    else if (mode === 'signup' && !result.data.session) setMessage('Conta criada. Confira seu e-mail para confirmar o acesso.')
    setLoading(false)
  }

  return <div className="authShell">
    <div className="authCard">
      <div className="brand authBrand"><div className="brandMark">N</div><div><strong>NEXO AI</strong><span>MVP 0.2</span></div></div>
      <p className="eyebrow">CENTRAL OPERACIONAL</p>
      <h1>{mode === 'login' ? 'Entre no NEXO' : 'Crie sua conta'}</h1>
      <p className="muted">Ao entrar, o NEXO verifica automaticamente sua integração do WhatsApp.</p>
      <form onSubmit={submit}>
        <label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="voce@empresa.com" /></label>
        <label>Senha<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} placeholder="••••••••" /></label>
        <button className="primary" disabled={loading}>{loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}</button>
      </form>
      {message && <div className="notice">{message}</div>}
      <button className="linkBtn" onClick={()=>{setMode(mode === 'login' ? 'signup' : 'login');setMessage('')}}>
        {mode === 'login' ? 'Ainda não tenho conta' : 'Já tenho uma conta'}
      </button>
    </div>
  </div>
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [booting, setBooting] = useState(true)
  const [showConnect, setShowConnect] = useState(false)
  const [apiUrl, setApiUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [wa, setWa] = useState<ConnectResult>({ state: 'not_configured', connected: false })
  const [connectError, setConnectError] = useState('')
  const [activeView, setActiveView] = useState<'overview'|'training'>('overview')
  const [assistantInput,setAssistantInput]=useState('')
  const [assistantReply,setAssistantReply]=useState('')
  const [assistantLoading,setAssistantLoading]=useState(false)

  useEffect(() => {
    if (!supabase) { setBooting(false); return }
    supabase.auth.getSession().then(({data}) => {
      setSession(data.session)
      setBooting(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => listener.subscription.unsubscribe()
  }, [])

  async function invokeEvolution(body: Record<string, unknown>) {
    if (!supabase) return null
    const { data, error } = await supabase.functions.invoke('evolution-connect', { body })
    if (error) throw error
    return data as ConnectResult
  }

  useEffect(() => {
    if (!session) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await invokeEvolution({ action: 'connect' })
        if (!cancelled && data) {
          setWa(data)
          if (data.qrBase64 && !data.connected) setShowConnect(true)
        }
      } catch {
        if (!cancelled) setWa({ state: 'not_configured', connected: false })
      }
    })()
    return () => { cancelled = true }
  }, [session?.user.id])

  useEffect(() => {
    if (!session || wa.connected || !wa.instanceName || wa.state !== 'connecting') return
    const timer = window.setInterval(async () => {
      try {
        const data = await invokeEvolution({ action: 'status' })
        if (data) {
          setWa(prev => ({ ...prev, ...data }))
          if (data.connected) setShowConnect(false)
        }
      } catch {}
    }, 4000)
    return () => window.clearInterval(timer)
  }, [session, wa.connected, wa.instanceName, wa.state])

  async function askAssistant(e: FormEvent) {
    e.preventDefault()
    if(!supabase || !assistantInput.trim()) return
    setAssistantLoading(true)
    setAssistantReply('')
    const {data,error}=await supabase.functions.invoke('nexo-assistant',{body:{message:assistantInput.trim()}})
    setAssistantLoading(false)
    if(error || !data?.ok){
      setAssistantReply(data?.error||error?.message||'Não foi possível consultar o NEXO agora.')
      return
    }
    setAssistantReply(data.message||'Pronto.')
    setAssistantInput('')
  }

  async function connect(e: FormEvent) {
    e.preventDefault()
    setConnecting(true)
    setConnectError('')
    try {
      const data = await invokeEvolution({ action: 'connect', apiUrl, apiKey })
      if (data) {
        setWa(data)
        setApiKey('')
        if (data.connected) setShowConnect(false)
      }
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Não foi possível conectar à Evolution.')
    } finally {
      setConnecting(false)
    }
  }

  if (booting) return <div className="loadingScreen">Carregando NEXO...</div>
  if (!session) return <Auth />

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brandMark">N</div><div><strong>NEXO AI</strong><span>MVP 0.2</span></div></div>
        <nav>
          <button className={activeView==='overview'?'active':''} onClick={()=>setActiveView('overview')}><Activity size={18}/>Visão geral</button>
          <button className={activeView==='training'?'active':''} onClick={()=>setActiveView('training')}><Brain size={18}/>Treinar NEXO</button>
          <button><Users size={18}/>Clientes</button>
          <button><Boxes size={18}/>Produtos e serviços</button>
          <button><MessageCircle size={18}/>WhatsApp</button>
          <button><Bot size={18}/>Automações</button>
        </nav>
        <div className="sideBottom">
          <button className="settingsBtn" onClick={()=>setShowConnect(true)}><Settings2 size={17}/>Integração</button>
          <button className="settingsBtn" onClick={()=>supabase?.auth.signOut()}><LogOut size={17}/>Sair</button>
          <div className="status"><span className={wa.connected ? 'green' : 'amber'}></span>{wa.connected ? 'WhatsApp conectado' : 'WhatsApp pendente'}</div>
        </div>
      </aside>

      <main>
        <header>
          <div><p className="eyebrow">CENTRAL OPERACIONAL</p><h1>Boa noite 👋</h1><p>Seu funcionário digital começa aqui.</p></div>
          <button className={wa.connected ? 'connectionBadge connected' : 'connectionBadge'} onClick={()=>setShowConnect(true)}>
            {wa.connected ? <Wifi size={16}/> : <WifiOff size={16}/>}
            {wa.connected ? 'WhatsApp conectado' : 'Conectar WhatsApp'}
          </button>
        </header>

        {activeView === 'training' ? <TrainingPanel /> : <>
        <section className="grid">
          {cards.map(({label,value,icon:Icon}) => <article className="card" key={label}><div className="cardIcon"><Icon size={20}/></div><div><span>{label}</span><strong>{value}</strong></div></article>)}
        </section>

        <section className="two">
          <article className="panel assistant">
            <div className="panelTitle"><div><Bot size={20}/><strong>Assistente NEXO</strong></div><span>Ativo</span></div>
            <div className="heroMessage"><h2>O que você quer fazer hoje?</h2><p>Converse naturalmente com o NEXO para consultar seu negócio ou preparar ações.</p>{assistantReply && <div className="assistantReply">{assistantReply}</div>}</div>
            <form className="composer" onSubmit={askAssistant}><input value={assistantInput} onChange={e=>setAssistantInput(e.target.value)} placeholder="Ex.: Mostre meus produtos e serviços" /><button disabled={assistantLoading || !assistantInput.trim()}>{assistantLoading?'...':'Enviar'}</button></form>
          </article>

          <article className="panel">
            <div className="panelTitle"><div><CircleDollarSign size={20}/><strong>Status do WhatsApp</strong></div></div>
            <div className="waSummary">
              <div className={wa.connected ? 'waIcon ok' : 'waIcon'}>{wa.connected ? <Wifi/> : <WifiOff/>}</div>
              <h3>{wa.connected ? 'Tudo pronto' : wa.instanceName ? 'Aguardando conexão' : 'Ainda não configurado'}</h3>
              <p>{wa.connected ? 'A instância está online e pronta para receber mensagens.' : 'Conecte sua Evolution uma única vez. O NEXO cria e gerencia a instância automaticamente.'}</p>
              {wa.instanceName && <code>{wa.instanceName}</code>}
              {!wa.connected && <button className="primary small" onClick={()=>setShowConnect(true)}>Conectar agora</button>}
            </div>
          </article>
        </section>

        <section className="panel events">
          <div className="panelTitle"><div><Activity size={20}/><strong>Atividade recente</strong></div><span>Webhook ativo</span></div>
          <div className="empty"><div className="pulse"></div><strong>Aguardando o primeiro evento</strong><p>Quando uma mensagem chegar pela Evolution, ela será registrada no NEXO.</p></div>
        </section>
        </>}
      </main>

      {showConnect && <div className="modalBackdrop">
        <div className="modal">
          <button className="closeBtn" onClick={()=>setShowConnect(false)}><X size={18}/></button>
          <p className="eyebrow">INTEGRAÇÃO AUTOMÁTICA</p>
          <h2>{wa.qrBase64 ? 'Escaneie o QR Code' : 'Conectar Evolution API'}</h2>
          {wa.qrBase64 ? <>
            <p className="muted">A instância <b>{wa.instanceName}</b> já foi criada. Agora só falta conectar o WhatsApp.</p>
            <div className="qrWrap"><img src={wa.qrBase64} alt="QR Code do WhatsApp" /></div>
            <div className="qrState"><span></span> Aguardando leitura do QR Code...</div>
            <button className="secondary" onClick={async()=>{try{const d=await invokeEvolution({action:'connect'});if(d)setWa(d)}catch{}}}>Gerar/atualizar QR</button>
          </> : <>
            <p className="muted">Informe a URL e a API Key global da sua Evolution. O NEXO fará o restante sozinho.</p>
            <form onSubmit={connect}>
              <label>URL da Evolution<input value={apiUrl} onChange={e=>setApiUrl(e.target.value)} required placeholder="https://sua-evolution.com" /></label>
              <label>API Key<input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)} required placeholder="Sua API Key global" /></label>
              <button className="primary" disabled={connecting}>{connecting ? 'Criando instância...' : 'Conectar e criar instância'}</button>
            </form>
            {connectError && <div className="notice error">{connectError}</div>}
            <div className="safeNote">🔒 A chave é enviada ao backend e não fica salva no navegador.</div>
          </>}
        </div>
      </div>}
    </div>
  )
}
