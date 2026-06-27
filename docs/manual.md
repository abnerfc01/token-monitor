# Manual de Implantação e Funcionamento: WSL Token Monitor (Open-Source)

Este guia contém as instruções passo a passo para implantar, executar em segundo plano e utilizar a aplicação open-source **WSL Token Monitor** no seu ambiente.

---

## 📋 Requisitos do Sistema
* **Node.js**: Versão 18 ou superior instalada no WSL.
* **Python 3**: Com suporte padrão a SQLite (nativo no Linux/WSL).
* **Navegador**: Qualquer navegador moderno no Windows (acessando via localhost).

---

## 🚀 1. Manual de Implantação (Instalação e Execução)

Siga as etapas abaixo no terminal do seu WSL para colocar o projeto para funcionar de forma definitiva.

### Passo 1.1: Instalar as Dependências
Navegue até a pasta do projeto e instale as dependências:
```bash
cd ~/src/token-monitor
npm install
```

### Passo 1.2: Executar Manualmente (Teste)
Para rodar o servidor em modo de desenvolvimento ou teste rápido:
```bash
npm start
```
O servidor começará a rodar em **http://localhost:3030**. Pressione `Ctrl + C` para encerrá-lo.

### Passo 1.3: Executar em Segundo Plano (Background Permanente)
Para que o serviço continue rodando mesmo após fechar o terminal, você tem duas opções recomendadas:

#### Opção A: Usando PM2 (Recomendado para Node.js)
O PM2 é um gerenciador de processos leve para Node.js que reinicia o app automaticamente em caso de falhas.

1. Instale o PM2 globalmente:
   ```bash
   npm install -g pm2
   ```
2. Inicie a aplicação com o PM2 a partir da pasta do projeto:
   ```bash
   cd ~/src/token-monitor
   pm2 start server.js --name "token-monitor"
   ```
3. Salve a lista de processos para persistir:
   ```bash
   pm2 save
   ```
4. Para monitorar os logs do serviço:
   ```bash
   pm2 logs token-monitor
   ```

#### Opção B: Usando o utilitário nohup (Nativo do Linux)
Caso não queira instalar o PM2, use o `nohup` do Linux:
```bash
nohup node server.js > server.log 2>&1 &
```
Isso iniciará o servidor e redirecionará a saída de logs para o arquivo `server.log`.

---

## 💻 2. Manual de Funcionamento (Guia de Uso da Interface)

Com o servidor rodando, abra o navegador no Windows e acesse:
👉 **[http://localhost:3030](http://localhost:3030)**

### ✨ A Interface Premium (Design & Movimento)
O monitor conta com o **Antigravity Design System**, provendo uma interface espacial moderna e interativa:
* **Perspectiva 3D Tilt**: Ao mover o mouse sobre os KPI Cards ou Gráficos, eles se inclinam fisicamente em relação à posição do cursor.
* **Profundidade (Z-axis Pop-out)**: Elementos internos como emojis e valores financeiros saltam da tela ao passar o mouse.
* **Transições GSAP**: As abas e os cards realizam uma transição animada e elástica em cascata (*staggered*) ao serem renderizados.
* **Acessibilidade**: Se o seu sistema operacional estiver configurado com a opção de **redução de movimentos** ativada (`prefers-reduced-motion`), todas as animações dinâmicas e o efeito tilt 3D são desativados de forma automática para garantir uma experiência confortável e segura.

> [!TIP]
> Caso a porta não seja redirecionada automaticamente pelo WSL (ou você queira acessar de outro local na rede), você pode descobrir o IP do seu WSL rodando `ip addr show eth0 | grep inet` no terminal do WSL, ou simplesmente verificando o log de inicialização do servidor, que imprimirá os endereços de acesso, como por exemplo `http://172.x.x.x:3030`.

> [!NOTE]
> Por padrão, o monitor vasculha os arquivos de banco de dados SQLite gerados pelo AIOX no caminho `~/.gemini/antigravity-cli/conversations/`. Ele não altera nem apaga nenhuma das suas conversas originais.

### 2.1 Mapeamento e Cadastro de Projetos
Quando o AIOX é executado, ele armazena o histórico da conversa vinculada à pasta onde você abriu o terminal (ex: `file:///home/<user>/src/resumeai` ou `~/src/resumeai`).

Para mapear esses logs para projetos legíveis:
1. Vá para a aba **Projetos Cadastrados** na barra lateral.
2. No formulário de cadastro, informe:
   * **Nome do Projeto**: Ex: `Resume AI`
   * **Caminho Local (WSL)**: Ex: `/home/<user>/src/resumeai` ou `~/src/resumeai`
3. Clique em **Cadastrar Projeto**.
4. **Mapeamento Automático (Sugestões)**: O sistema escaneia o histórico do AIOX e exibe na parte inferior da página uma lista de pastas ativas não cadastradas. Basta clicar no botão **"Mapear como Projeto"** para cadastrar essa pasta rapidamente.

### 2.2 Painel Geral (Dashboard)
A aba principal traz métricas e gráficos consolidados:
* **Custo Estimado**: Calcula a estimativa financeira somando a quantidade de tokens consumida em cada passo com as tarifas do modelo.
* **Fórmula de Cálculo**:
  $$\text{Custo} = \left(\frac{\text{Tokens de Entrada}}{1.000.000} \times \text{Tarifa Entrada}\right) + \left(\frac{\text{Tokens de Saída}}{1.000.000} \times \text{Tarifa Saída}\right) + \left(\frac{\text{Tokens em Cache Hit}}{1.000.000} \times \text{Tarifa Cache Hit}\right)$$
* **Gráficos**:
  * O gráfico circular exibe a fatia financeira que cada projeto representa no total.
  * O gráfico de barras exibe a divisão de tokens (Entrada, Saída e Cache Hit) consumidos por modelo de IA (como Gemini ou Claude).

### 2.3 Ajustar Tarifas Financeiras (Configurar Preços)
Na aba **Configurar Preços**, você pode editar o preço unitário por milhão (1M) de tokens em dólares (USD).
* O painel já vem pré-configurado com as tabelas de preços oficiais de provedores como Google Gemini e Anthropic Claude.
* Caso os provedores atualizem os preços das APIs, basta atualizar os campos numéricos na tabela e clicar em **Salvar Alterações de Preço**. Os custos históricos e atuais serão recalculados instantaneamente com base nas novas regras de preço.
* Para voltar aos preços iniciais originais do monitor, clique em **Restaurar Valores Padrão**.

### 2.4 Histórico e Detalhamento de Conversas
Na aba **Histórico de Uso**:
1. Você verá a lista completa de todas as conversas salvas no seu WSL.
2. Use o filtro por projeto para listar apenas as interações de uma pasta específica.
3. Clique no botão **🔍 Detalhes** de qualquer linha do histórico para abrir uma janela flutuante com a listagem exata de todos os passos dados no chat daquela conversa, incluindo o modelo usado, tokens e custo estimado de cada turno de pergunta e resposta.

---

## 🛠️ Resolução de Problemas Comuns

### O painel exibe $0.00 de custo para as conversas
* **Causa**: O modelo utilizado na conversa não está listado na tabela de preços.
* **Solução**: Vá na aba **Configurar Preços** e certifique-se de que o modelo usado (ex: `GPT-OSS 120B (Medium)`) possui valores de tarifas configurados maiores que zero.

### O WSL reiniciou e o monitor parou de funcionar
* **Causa**: O WSL encerrou a máquina virtual Linux de background.
* **Solução**: Se você usou o PM2, basta abrir o terminal do WSL e iniciar o PM2 novamente com `pm2 start token-monitor` ou configurar uma tarefa automática no WSL para inicialização permanente.
