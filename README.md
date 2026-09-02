# NEXO

Plataforma de inteligência operacional, atendimento e automação multi-nicho.

## Stack
- React + Vite + TypeScript
- Supabase (Postgres, Auth, RLS e Edge Functions)
- Evolution API / WhatsApp
- Camada de agentes, memória, aprendizado e base de conhecimento

## Núcleo atual
- Atendimento WhatsApp com contexto de conversa
- Identificação de intenção e assunto
- Memória de cliente
- Estado de diálogo e objetivo da conversa
- Agentes especializados: geral, vendas, suporte e financeiro
- Treinamento guiado do negócio por nicho
- Base de conhecimento automática
- Catálogo de produtos e serviços
- CRM e oportunidades comerciais
- Aprendizado a partir de mensagens não resolvidas
- Avaliações automatizadas do entendimento do agente
- Assistente administrativo no painel

## Princípio multi-nicho
O NEXO não presume que toda empresa venda planos ou assinaturas. O vocabulário deve se adaptar ao negócio real: produtos, serviços, consultas, procedimentos, pacotes, cursos, imóveis, orçamentos, agendamentos ou planos quando aplicável.

## Segurança
Nunca commitar service_role, credenciais privadas, API keys da Evolution ou chaves de provedores de IA. Operações privilegiadas devem permanecer no backend e respeitar autenticação, organização e RLS.
