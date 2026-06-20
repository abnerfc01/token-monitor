# WSL Token Monitor

Um painel web moderno com visual *glassmorphic* e tema escuro projetado especificamente para ambientes WSL / Linux, permitindo escanear os históricos locais de diferentes assistentes de IA (CLI e IDE) e consolidar o consumo de tokens e a estimativa de custos financeiros agrupados por projeto de software.

---

## 🚀 Principais Funcionalidades

* **Multi-Ferramentas (Modular)**: Suporta múltiplos assistentes de IA através de uma arquitetura de adaptadores no backend:
  * **Google Antigravity / AIOX**: Coleta automática de bancos de dados SQLite da CLI e da IDE.
  * **Claude Code**: Estrutura pronta para capturar arquivos de sessão de log em formato JSON.
  * **Aider CLI**: Escaneamento recursivo e estimativa de tokens a partir do arquivo `.aider.chat.history.md` nos seus projetos.
* **Inicialização Automática com o Sistema**: Configurado como um serviço de usuário do `systemd` para iniciar junto com o WSL / Linux.
* **Consolidação Financeira**: Agrupa custos por projeto e por modelo de IA com base em tabelas de preços customizáveis.
* **Gráficos Dinâmicos**: Visualização interativa utilizando Chart.js para distribuição de custos por projeto e consumo de tokens.

---

## 📁 Estrutura de Arquivos

* [server.js](file:///home/abnerfc01/src/token-monitor/server.js): Servidor REST backend em Node.js (Express).
* [db_reader.py](file:///home/abnerfc01/src/token-monitor/db_reader.py): Script em Python estruturado em **Adaptadores** para decodificar Protobuf e extrair estatísticas de várias IAs.
* [package.json](file:///home/abnerfc01/src/token-monitor/package.json): Dependências do projeto e scripts npm.
* [public/](file:///home/abnerfc01/src/token-monitor/public/): Frontend da aplicação (HTML, CSS e JavaScript).
* [docs/manual.md](file:///home/abnerfc01/src/token-monitor/docs/manual.md): Manual detalhado de implantação, funcionamento e guia explicativo da interface web.
* [docs/guide.md](file:///home/abnerfc01/src/token-monitor/docs/guide.md): Guia técnico explicando o banco de dados interno e regras de agregação.

---

## 🛠️ Como Iniciar e Configurar

### 1. Instalação e Configuração Automática
Navegue até a pasta do projeto, instale as dependências e execute o script de configuração:
```bash
cd /home/abnerfc01/src/token-monitor
npm install
npm run setup
```
O comando `npm run setup` irá:
* Detectar o diretório de instalação e o executável do Node.js de forma dinâmica.
* Gerar e registrar o serviço `token-monitor.service` no `systemd` do usuário.
* Criar uma cópia do arquivo `.env` para você personalizar caso necessário.
* Iniciar o serviço em segundo plano habilitado para boot automático.

### 2. Configurações Avançadas (.env)
Você pode personalizar o comportamento do monitor no arquivo `.env` gerado no diretório raiz:
* `PORT`: Altera a porta do servidor web (Padrão: `3030`).
* `PROJECTS_ROOT`: Caminho base para buscar projetos do Aider CLI (Padrão: `~/src`).
* `ADDITIONAL_CONVERSATIONS_DIRS`: Lista de pastas separadas por vírgula contendo históricos (`.db`) de outras máquinas (ex: diretórios sincronizados via Dropbox, OneDrive ou mounts de rede).

---

## 🌐 Como Acessar

Com o serviço rodando, abra o navegador no Windows e acesse:
👉 **[http://localhost:3030](http://localhost:3030)**

---

## 💻 Suporte a Múltiplas Máquinas e Usuários

* **Caminhos Dinâmicos**: O monitor utiliza expansão dinâmica de caminhos (`~`) para resolver a pasta home de qualquer usuário no Linux/WSL, permitindo que a aplicação seja instalada e funcione em qualquer ambiente sem necessidade de alterar o código-fonte.
* **Consolidação de Múltiplos WSLs / Computadores**: Você pode copiar bancos de dados `.db` de conversas do AIOX/Antigravity de outras máquinas para uma pasta sincronizada e mapeá-la na variável `ADDITIONAL_CONVERSATIONS_DIRS` no seu `.env`. O monitor agrupará tudo no mesmo painel.
* **Fuzzy Matching por Nome do Projeto (Basename)**: Se o caminho absoluto de um projeto diferir entre duas máquinas (ex: `/home/user1/src/meu-app` vs `/home/user2/projetos/meu-app`), o monitor usará o nome da pasta final (`meu-app`) como fallback de correspondência automática.

---

## 🔄 Gerenciando o Serviço no WSL

Use os seguintes comandos no terminal do WSL para controlar o monitor de tokens:

* **Verificar o status**: `systemctl --user status token-monitor`
* **Parar o serviço**: `systemctl --user stop token-monitor`
* **Reiniciar o serviço (útil após alterar o .env)**: `systemctl --user restart token-monitor`
* **Ver logs em tempo real**: `journalctl --user -u token-monitor -f`
* **Desativar a inicialização automática no boot**: `systemctl --user disable token-monitor`
