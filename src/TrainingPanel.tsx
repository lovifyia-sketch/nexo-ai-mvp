import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Brain, CheckCircle2, Loader2, Save, Sparkles } from 'lucide-react'
import { supabase } from './lib/supabase'

type Step = {
  key: string
  title: string
  help: string
  placeholder: string
  multiline?: boolean
}

const steps: Step[] = [
  { key:'business_name', title:'Nome da empresa', help:'Como sua empresa deve ser apresentada ao cliente?', placeholder:'Ex.: Clínica Vida, Imobiliária Horizonte, Studio Bella...' },
  { key:'segment', title:'Nicho / segmento', help:'Qual é o segmento principal da empresa?', placeholder:'Ex.: clínica odontológica, salão de beleza, imobiliária, assistência técnica...' },
  { key:'offer_model', title:'Como você vende', help:'Diga como sua oferta funciona. Não precisa usar linguagem técnica.', placeholder:'Ex.: serviços por agendamento; produtos pronta-entrega; cursos online; imóveis para venda e aluguel...', multiline:true },
  { key:'offers', title:'O que você oferece', help:'Liste os principais produtos, serviços, procedimentos, consultas, pacotes ou outras ofertas.', placeholder:'Ex.: corte feminino, coloração, escova, manicure...', multiline:true },
  { key:'audience', title:'Público principal', help:'Quem normalmente procura sua empresa?', placeholder:'Ex.: mulheres de 25 a 55 anos; pequenas empresas; famílias buscando imóvel...', multiline:true },
  { key:'payments', title:'Formas de pagamento', help:'Como o cliente pode pagar?', placeholder:'Ex.: Pix, cartão, dinheiro, parcelamento em até 3x...', multiline:true },
  { key:'delivery', title:'Entrega / atendimento / execução', help:'Explique como o cliente recebe o produto ou como o serviço acontece.', placeholder:'Ex.: atendimento presencial; entrega em Fortaleza; consulta online; visita técnica...', multiline:true },
  { key:'warranty', title:'Garantia, troca e reembolso', help:'Quais regras precisam ser respeitadas?', placeholder:'Ex.: troca em até 7 dias; sem reembolso após início do serviço...', multiline:true },
  { key:'support', title:'Atendimento e suporte', help:'Como funciona o suporte depois da compra ou contratação?', placeholder:'Ex.: suporte pelo WhatsApp das 8h às 18h...', multiline:true },
  { key:'hours', title:'Horários', help:'Quando sua empresa atende?', placeholder:'Ex.: segunda a sexta, 08h às 18h; sábado até 13h...', multiline:true },
  { key:'location', title:'Localização / área atendida', help:'Onde você atende ou entrega?', placeholder:'Ex.: Fortaleza e região metropolitana; atendimento 100% online...', multiline:true },
  { key:'sales_process', title:'Como comprar, contratar ou agendar', help:'Qual é o próximo passo ideal para o cliente?', placeholder:'Ex.: escolher serviço, informar dia/horário e confirmar agendamento...', multiline:true },
  { key:'differentials', title:'Diferenciais', help:'O que torna sua empresa diferente?', placeholder:'Ex.: atendimento rápido, equipe certificada, entrega no mesmo dia...', multiline:true },
  { key:'policies', title:'Regras importantes', help:'Adicione qualquer regra que o agente nunca pode esquecer.', placeholder:'Ex.: não prometer desconto sem autorização; não confirmar agenda sem verificar disponibilidade...', multiline:true },
  { key:'faq', title:'Dúvidas frequentes', help:'Inclua perguntas e respostas comuns do seu negócio.', placeholder:'Ex.: Precisa agendar? Sim. Aceita Pix? Sim. Faz entrega? Apenas em Fortaleza.', multiline:true },
]

export default function TrainingPanel() {
  const [answers,setAnswers]=useState<Record<string,string>>({})
  const [step,setStep]=useState(0)
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [done,setDone]=useState(false)
  const [message,setMessage]=useState('')

  useEffect(()=>{
    if(!supabase) return
    ;(async()=>{
      const {data,error}=await supabase.functions.invoke('knowledge-ingest',{body:{action:'guided_get'}})
      if(!error && data){
        setAnswers(data.answers||{})
        setStep(Math.min(Number(data.current_step||0),steps.length-1))
        setDone(Boolean(data.completed))
      }
      setLoading(false)
    })()
  },[])

  const current=steps[step]
  const progress=useMemo(()=>Math.round((Object.keys(answers).filter(k=>String(answers[k]||'').trim()).length/steps.length)*100),[answers])

  async function saveCurrent(e?:FormEvent){
    e?.preventDefault()
    if(!supabase || !current) return
    const value=String(answers[current.key]||'').trim()
    if(!value){setMessage('Preencha esta etapa para continuar.');return}
    setSaving(true);setMessage('')
    const {data,error}=await supabase.functions.invoke('knowledge-ingest',{body:{action:'guided_save',step,key:current.key,value}})
    setSaving(false)
    if(error || !data?.ok){setMessage(data?.error||error?.message||'Não foi possível salvar.');return}
    if(step<steps.length-1) setStep(step+1)
  }

  async function complete(){
    if(!supabase) return
    setSaving(true);setMessage('')
    const {data,error}=await supabase.functions.invoke('knowledge-ingest',{body:{action:'guided_complete'}})
    setSaving(false)
    if(error || !data?.ok){setMessage(data?.error||error?.message||'Não foi possível concluir o treinamento.');return}
    setDone(true)
    setMessage(data.message||'Treinamento concluído.')
  }

  if(loading) return <section className="panel trainingPanel"><Loader2 className="spin" /> Carregando treinamento...</section>

  return <section className="panel trainingPanel">
    <div className="trainingHeader">
      <div>
        <p className="eyebrow">CÉREBRO DA EMPRESA</p>
        <h2>Treinar NEXO</h2>
        <p className="muted">Responda como você explicaria seu negócio para um novo funcionário. O NEXO transforma isso em conhecimento automaticamente.</p>
      </div>
      <div className="trainingScore"><Brain size={22}/><strong>{progress}%</strong><span>perfil preenchido</span></div>
    </div>

    {done && <div className="successBox"><CheckCircle2 size={18}/><div><strong>Treinamento ativo</strong><p>Você pode revisar qualquer resposta e concluir novamente para atualizar o conhecimento.</p></div></div>}

    <div className="stepDots">{steps.map((s,i)=><button key={s.key} className={i===step?'on':answers[s.key]?'filled':''} onClick={()=>setStep(i)} title={s.title}>{i+1}</button>)}</div>

    <form onSubmit={saveCurrent} className="trainingForm">
      <div className="stepMeta"><span>Etapa {step+1} de {steps.length}</span><strong>{current.title}</strong><p>{current.help}</p></div>
      {current.multiline
        ? <textarea rows={7} value={answers[current.key]||''} onChange={e=>setAnswers(a=>({...a,[current.key]:e.target.value}))} placeholder={current.placeholder}/>
        : <input value={answers[current.key]||''} onChange={e=>setAnswers(a=>({...a,[current.key]:e.target.value}))} placeholder={current.placeholder}/>
      }
      <div className="trainingActions">
        <button type="button" className="secondaryBtn" disabled={step===0} onClick={()=>setStep(Math.max(0,step-1))}>Voltar</button>
        <button type="submit" className="primary" disabled={saving}>{saving?<Loader2 size={16} className="spin"/>:<Save size={16}/>} Salvar e continuar</button>
        {step===steps.length-1 && <button type="button" className="primary finishBtn" onClick={complete} disabled={saving}><Sparkles size={16}/>Concluir treinamento</button>}
      </div>
    </form>
    {message && <div className={done?'notice':'notice error'}>{message}</div>}
  </section>
}
