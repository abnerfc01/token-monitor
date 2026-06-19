# WSL Token Monitor

Um painel web moderno com visual *glassmorphic* e tema escuro projetado especificamente para rodar em ambientes WSL / Linux, permitindo escanear os históricos locais do AIOX e consolidar o consumo de tokens e a estimativa de custos financeiros agrupados por projeto de software.

## 📁 Estrutura de Arquivos

* [server.js](file:///home/abnerfc01/src/token-monitor/server.js): Servidor REST backend em Node.js (Express).
* [db_reader.py](file:///home/abnerfc01/src/token-monitor/db_reader.py): Script de leitura SQLite e decodificação Protobuf em Python.
* [package.json](file:///home/abnerfc01/src/token-monitor/package.json): Dependências do projeto e scripts npm.
* [public/index.html](file:///home/abnerfc01/src/token-monitor/public/index.html): Estrutura HTML do painel.
* [public/style.css](file:///home/abnerfc01/src/token-monitor/public/style.css): Estilização moderna escura e translúcida.
* [public/app.js](file:///home/abnerfc01/src/token-monitor/public/app.js): Lógica JavaScript e gráficos interativos Chart.js.

## 📖 Manuais e Guias

* [Manual de Implantação e Funcionamento](file:///home/abnerfc01/src/token-monitor/docs/manual.md): Passos detalhados para rodar em background usando PM2/nohup e guia explicativo de uso da interface web.
* [Guia Técnico do Projeto](file:///home/abnerfc01/src/token-monitor/docs/guide.md): Detalhamento do funcionamento interno, banco de dados SQLite do AIOX e lógica de agregação.

## 🚀 Como Iniciar

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Execute o servidor:
   ```bash
   npm start
   ```

3. Abra no seu navegador Windows:
   👉 **http://localhost:3030**
