# 📋 Checklist de Desenvolvimento: WSL Token Monitor

Este documento serve como um guia de acompanhamento para as tarefas concluídas, as melhorias recentes e os próximos passos sugeridos para o desenvolvimento do projeto.

---

## 🚀 1. Tarefas Concluídas

### 🔌 Infraestrutura e Configuração
- [x] **Integração do Spec Kit**: Clonado o repositório `waveupHQ/spec-kit-antigravity` e configuradas as pastas de fluxos de trabalho (`.agent/workflows/`, `memory/`, `templates/`) no workspace do WSL.
- [x] **Configuração de Idioma Persistente**: Criado o arquivo de regras locais do agente em `.agents/AGENTS.md` para garantir respostas exclusivas em Português Brasileiro (PT-BR).
- [x] **Varredura e Análise de Arquitetura**: Mapeada a estrutura de comunicação entre o script de extração em Python (`db_reader.py`), o servidor Express em Node (`server.js`) e a aplicação cliente baseada em HTML/CSS/JS com Chart.js.

### 💰 Gestão e Atualização de Tarifas
- [x] **Atualização Automática de Preços via Internet**:
  - [x] Criado o endpoint de backend `POST /api/prices/update-auto` em `server.js` integrado à API pública `llm-prices.com`.
  - [x] Implementada correspondência inteligente (fuzzy mapping) que limpa os nomes dos modelos e associa variantes como `Gemini 3.5 Flash (Medium)` ou `Claude Sonnet 4.6 (Thinking)` às suas respectivas tarifas reais.
  - [x] Adicionado o botão **⚡ Atualizar via Internet** no formulário da interface.

### 🎨 Experiência do Usuário (UX/UI)
- [x] **Remoção de Popups Nativos do Navegador**:
  - [x] Desenvolvido um modal de diálogo genérico e promise-based (`dialog-modal`) em `index.html` seguindo o design system do Glassmorphism.
  - [x] Criadas as funções utilitárias `systemAlert` e `systemConfirm` em `app.js`.
  - [x] Substituídas todas as chamadas nativas de `alert()` e `confirm()` no frontend por diálogos internos da aplicação (confirmações de exclusão, avisos de sucesso/erro e mensagens de progresso).
- [x] **Filtros de Período Customizados (Date Range)**:
  - [x] Adicionados seletores de data (`input[type="date"]`) no painel de filtros globais.
  - [x] Implementada lógica de filtragem integrada que recalcula os KPIs, gráficos e a tabela de histórico de acordo com o intervalo selecionado.
  - [x] Adicionados botões de atalho de período rápidos (presets para Hoje, 7D, 30D, Este Mês e Total) com sincronização e iluminação visual ativa.
- [x] **💵 Conversão Tarifária para Real (BRL - R$)**:
  - [x] Exibição do custo total em Reais (R$) no card principal do dashboard.
  - [x] Inclusão do detalhamento correspondente em Dólares (USD) no subtexto (ao lado da contagem de conversas).
  - [x] Campo configurável no menu de preços para definição manual do câmbio e botão para atualização automática de cotação via AwesomeAPI.

---

## 🔮 2. Próximos Passos & Sugestões de Melhorias

### 🤖 Adaptadores e Fontes de Dados
- [x] **Implementação do `ClaudeCodeAdapter`**:
  - [x] Implementar a lógica real no método `get_stats()` do [db_reader.py](file:///home/abner/code/token-monitor/db_reader.py#L238-L266) para ler os históricos do Claude Code salvos no formato `.jsonl` em `~/.claude/projects/<url-encoded-path>/sessions/`.
- [x] **Mapeamento de Histórico do Aider**:
  - [x] Validar e aprimorar a extração de dados nos históricos de chat do Aider CLI (`.aider.chat.history.md`).

### 📊 Recursos do Dashboard (Frontend)
- [x] **📥 Exportação de Relatórios (CSV)**:
  - [x] Adicionar botões para exportar as tabelas de detalhamento de projetos e histórico de uso como arquivos CSV locais.

### ⚡ Otimização de Performance
- [x] **Cache em Memória no Backend**:
  - [x] Salvar os resultados do processamento das bases de dados em cache no Express, recalculando os dados apenas quando o timestamp de última modificação (`mtime`) dos arquivos SQLite no diretório do AIOX sofrer alteração, reduzindo o custo de execução de subprocessos Python.


---

## 🎨 3. Plano de Implementação: Interface Premium (Antigravity Design)

Esse plano visa elevar a interface a uma estética de profundidade espacial, movimentos elásticos orgânicos e riqueza visual tridimensional.

### 🏁 Fase 1: Setup e Importações
- [x] **Preparação do Canvas e Scripts**:
  - [x] Importar a biblioteca GSAP e plugins no [index.html](file:///home/abner/code/token-monitor/public/index.html).
  - [x] Injetar a estrutura de contêineres de luz para suportar efeitos de reflexo de fundo.

### 🔮 Fase 2: Estética Glassmorphic & Aurora BG
- [x] **Polimento Visual do Fundo e das Bordas**:
  - [x] Adicionar elementos de Aurora flutuantes (`.aurora-blob`) no [style.css](file:///home/abner/code/token-monitor/public/style.css) com desfoque e movimentação cíclica lenta.
  - [x] Atualizar painéis `.glass` para usar bordas gradientes luminosas e sombras mais profundas e dispersas (weightlessness).

### 📐 Fase 3: Efeitos de Perspectiva & Tilt 3D
- [x] **Interatividade Espacial**:
  - [x] Implementar manipulador de eventos de mouse em [app.js](file:///home/abner/code/token-monitor/public/app.js) para calcular o ângulo de aproximação do cursor e aplicar rotações 3D reais nos eixos X e Y.
  - [x] Adicionar efeito "pop-out" 3D (Z-axis offset) em emojis de KPI e valores numéricos importantes.

### 🎬 Fase 4: Animações Orgânicas e Gráficos Neon
- [x] **Transições e Estilo de Dados**:
  - [x] Criar animações de entrada escalonadas (*staggered entrance*) ao mudar de abas ou recarregar os dados, usando transições elásticas do GSAP.
  - [x] Atualizar os gráficos no Chart.js para usar gradientes verticais translúcidos e linhas neon com brilho difuso (*shadowBlur*).

