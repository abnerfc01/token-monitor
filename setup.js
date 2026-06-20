const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

console.log('🏁 Iniciando configuração do WSL Token Monitor...');

const homeDir = os.homedir();
const projectDir = __dirname;
const nodePath = process.execPath;

// 1. Criar a pasta de serviços do systemd se não existir
const systemdDir = path.join(homeDir, '.config/systemd/user');
if (!fs.existsSync(systemdDir)) {
  fs.mkdirSync(systemdDir, { recursive: true });
}

// 2. Definir o conteúdo do token-monitor.service
const serviceContent = `[Unit]
Description=WSL Token Monitor
After=network.target

[Service]
Type=simple
WorkingDirectory=${projectDir}
ExecStart=${nodePath} server.js
Restart=on-failure
RestartSec=5
Environment=PATH=/usr/bin:/usr/local/bin:${path.dirname(nodePath)}
Environment=PORT=3030

[Install]
WantedBy=default.target
`;

const servicePath = path.join(systemdDir, 'token-monitor.service');
fs.writeFileSync(servicePath, serviceContent, 'utf-8');
console.log(`✅ Arquivo de serviço criado em: ${servicePath}`);

// 3. Criar arquivo .env se não existir
const envPath = path.join(projectDir, '.env');
const envExamplePath = path.join(projectDir, '.env.example');
if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
  fs.copyFileSync(envExamplePath, envPath);
  console.log(`✅ Arquivo de configuração .env criado a partir de .env.example`);
} else if (fs.existsSync(envPath)) {
  console.log(`ℹ️ Arquivo .env já existe, mantendo configurações atuais.`);
}

// 4. Recarregar systemd e ativar o serviço
try {
  console.log('🔄 Atualizando daemon do systemd...');
  execSync('systemctl --user daemon-reload', { stdio: 'inherit' });
  
  console.log('🔌 Habilitando inicialização automática do monitor...');
  execSync('systemctl --user enable token-monitor', { stdio: 'inherit' });
  
  console.log('🚀 Iniciando/Reiniciando serviço...');
  execSync('systemctl --user restart token-monitor', { stdio: 'inherit' });
  
  console.log('\n==================================================');
  console.log('✨ WSL Token Monitor configurado e ativo com sucesso!');
  console.log('👉 Acesse no navegador: http://localhost:3030');
  console.log('==================================================');
} catch (err) {
  console.error('\n❌ Erro ao ativar o serviço no systemd:', err.message);
  console.log('Você pode precisar iniciar o servidor manualmente com: npm start');
}
