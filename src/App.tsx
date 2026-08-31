import { Activity, Bot, Boxes, CircleDollarSign, MessageCircle, RefreshCcw, Users } from 'lucide-react'

const cards = [
  { label: 'Clientes ativos', value: '0', icon: Users },
  { label: 'Produtos', value: '0', icon: Boxes },
  { label: 'Renovações próximas', value: '0', icon: RefreshCcw },
  { label: 'Conversas hoje', value: '0', icon: MessageCircle },
]

export default function App() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brandMark">N</div><div><strong>NEXO AI</strong><span>MVP 0.1</span></div></div>
        <nav>
          <button className="active"><Activity size={18}/>Visão geral</button>
          <button><Users size={18}/>Clientes</button>
          <button><Boxes size={18}/>Produtos</button>
          <button><MessageCircle size={18}/>WhatsApp</button>
          <button><Bot size={18}/>Automações</button>
        </nav>
        <div className="status"><span></span> Base online</div>
      </aside>

      <main>
        <header>
          <div><p className="eyebrow">CENTRAL OPERACIONAL</p><h1>Boa noite 👋</h1><p>Este é o primeiro painel funcional do NEXO AI.</p></div>
          <div className="pill">MVP em construção</div>
        </header>

        <section className="grid">
          {cards.map(({label,value,icon:Icon}) => <article className="card" key={label}><div className="cardIcon"><Icon size={20}/></div><div><span>{label}</span><strong>{value}</strong></div></article>)}
        </section>

        <section className="two">
          <article className="panel assistant">
            <div className="panelTitle"><div><Bot size={20}/><strong>Assistente NEXO</strong></div><span>Em breve: IA</span></div>
            <div className="heroMessage"><h2>O que você quer fazer hoje?</h2><p>Quando conectarmos a inteligência, você poderá consultar clientes, renovações e comandar ações daqui.</p></div>
            <div className="composer"><input disabled placeholder="Ex.: Quem vence esta semana?" /><button disabled>Enviar</button></div>
          </article>

          <article className="panel">
            <div className="panelTitle"><div><CircleDollarSign size={20}/><strong>Primeiro marco</strong></div></div>
            <div className="flow">
              <div><b>1</b><span>WhatsApp envia mensagem</span></div>
              <div><b>2</b><span>Evolution chama o webhook</span></div>
              <div><b>3</b><span>NEXO identifica e registra</span></div>
              <div><b>4</b><span>Resposta volta ao WhatsApp</span></div>
            </div>
          </article>
        </section>

        <section className="panel events">
          <div className="panelTitle"><div><Activity size={20}/><strong>Atividade recente</strong></div><span>Tempo real em breve</span></div>
          <div className="empty"><div className="pulse"></div><strong>Aguardando o primeiro evento</strong><p>Quando o webhook da Evolution receber uma mensagem, ela aparecerá aqui.</p></div>
        </section>
      </main>
    </div>
  )
}
