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

---

## 🔮 2. Próximos Passos & Sugestões de Melhorias

### 🤖 Adaptadores e Fontes de Dados
- [ ] **Implementação do `ClaudeCodeAdapter`**:
  - [ ] Implementar a lógica real no método `get_stats()` do [db_reader.py](file:///home/abner/code/token-monitor/db_reader.py#L238-L266) para ler os históricos do Claude Code salvos no formato `.jsonl` em `~/.claude/projects/<url-encoded-path>/sessions/`.
- [ ] **Mapeamento de Histórico do Aider**:
  - [ ] Validar e aprimorar a extração de dados nos históricos de chat do Aider CLI (`.aider.chat.history.md`).

### 📊 Recursos do Dashboard (Frontend)
- [ ] **💵 Conversão Tarifária para Real (BRL - R$)**:
  - [ ] Adicionar suporte a um fator de conversão de câmbio (USD/BRL) configurável na interface de preços, permitindo exibir todos os custos consolidados diretamente em Reais (R$).
- [ ] **📥 Exportação de Relatórios (CSV)**:
  - [ ] Adicionar botões para exportar as tabelas de detalhamento de projetos e histórico de uso como arquivos CSV locais.
- [ ] **📅 Filtros de Período Customizados (Date Range)**:
  - [ ] Adicionar seletores de data (`<input type="date">`) no painel para filtrar os KPIs e gráficos de acordo com um intervalo de tempo flexível.

### ⚡ Otimização de Performance
- [ ] **Cache em Memória no Backend**:
  - [ ] Salvar os resultados do processamento das bases de dados em cache no Express, recalculando os dados apenas quando o timestamp de última modificação (`mtime`) dos arquivos SQLite no diretório do AIOX sofrer alteração, reduzindo o custo de execução de subprocessos Python.
