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

### 1. Instalar as Dependências
Navegue até a pasta do projeto e instale as dependências do Node.js:
```bash
cd /home/abnerfc01/src/token-monitor
npm install
```

### 2. Inicializar o Serviço de Monitoramento
O monitor está configurado para rodar sob o gerenciador de serviços do Linux (`systemd`) no escopo do usuário. 

* Para iniciar o monitor agora:
  ```bash
  systemctl --user start token-monitor
  ```
* Para verificar se o serviço está ativo e rodando sem erros:
  ```bash
  systemctl --user status token-monitor
  ```

*O serviço está habilitado para inicializar automaticamente sempre que o WSL/Linux for iniciado.*

---

## 🌐 Como Acessar

Com o serviço rodando, abra o navegador no Windows e acesse:
👉 **[http://localhost:3030](http://localhost:3030)**

*Caso o redirecionamento automático do WSL apresente problemas, consulte o IP do seu WSL no status do serviço e acesse através do IP, ex: `http://172.x.x.x:3030`.*

---

## 🔄 Gerenciando o Serviço no WSL

Use os seguintes comandos no terminal do WSL para controlar o monitor de tokens:

* **Parar o serviço**: `systemctl --user stop token-monitor`
* **Reiniciar o serviço (útil após alterações)**: `systemctl --user restart token-monitor`
* **Ver logs em tempo real**: `journalctl --user -u token-monitor -f`
* **Desativar a inicialização automática no boot**: `systemctl --user disable token-monitor`
