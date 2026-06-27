// Global State
let projects = [];
let prices = {};
let usageData = null;
let activeTab = 'dashboard';
let selectedProjectIds = [];
let selectedModels = [];

// Chart Instances (to destroy/recreate on update)
let costChartInstance = null;
let tokensChartInstance = null;
let timeSeriesChartInstance = null;

// Tab Titles and Descriptions
const TAB_INFO = {
  dashboard: {
    title: 'Painel Geral',
    desc: 'Visão em tempo real do consumo de tokens e custos de desenvolvimento.'
  },
  projects: {
    title: 'Projetos Cadastrados',
    desc: 'Adicione ou remova pastas locais e repositórios WSL para monitoramento.'
  },
  prices: {
    title: 'Configurar Preços',
    desc: 'Gerencie os valores cobrados pelas APIs de cada modelo.'
  },
  history: {
    title: 'Histórico de Uso',
    desc: 'Consulte a lista completa de interações e o custo de cada conversa.'
  }
};

// Page Init
document.addEventListener('DOMContentLoaded', () => {
  init();
});

async function init() {
  showLoading(true);
  try {
    await fetchProjects();
    await fetchPrices();
    await fetchData();
  } catch (err) {
    console.error('Error initializing application:', err);
  } finally {
    showLoading(false);
  }
}

// Show/Hide Loading Spinner
function showLoading(show) {
  const overlay = document.getElementById('loading-overlay');
  if (show) {
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
  }
}

// Tab Switching
function switchTab(tabId) {
  activeTab = tabId;
  
  // Update nav buttons classes
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.getElementById(`btn-${tabId}`);
  if (activeBtn) activeBtn.classList.add('active');
  
  // Update main header text
  document.getElementById('current-tab-title').innerText = TAB_INFO[tabId].title;
  document.getElementById('current-tab-desc').innerText = TAB_INFO[tabId].desc;
  
  // Toggle tab sections
  document.querySelectorAll('.tab-content').forEach(section => {
    section.classList.remove('active');
  });
  document.getElementById(`tab-${tabId}`).classList.add('active');
  
  // Refresh UI data on tab open
  if (tabId === 'history') {
    populateHistoryFilter();
    renderHistoryTable();
  } else if (tabId === 'projects') {
    renderProjectsList();
    renderScannerSuggestions();
  } else if (tabId === 'prices') {
    renderPricesTable();
  }
}

// Fetch Functions
async function fetchProjects() {
  const res = await fetch('/api/projects');
  projects = await res.json();
}

async function fetchPrices() {
  const res = await fetch('/api/prices');
  prices = await res.json();
}

async function fetchData() {
  showLoading(true);
  try {
    const res = await fetch('/api/usage');
    usageData = await res.json();
    
    // Refresh GUI Components
    updateKPIs();
    renderDashboardTable();
    renderCharts();
    updateUnregisteredNotice();
    
    // If other tabs are open, update them too
    if (activeTab === 'projects') {
      renderProjectsList();
      renderScannerSuggestions();
    } else if (activeTab === 'history') {
      renderHistoryTable();
    }
  } catch (err) {
    await systemAlert('Erro', 'Erro ao buscar dados. Verifique o servidor local.');
    console.error(err);
  } finally {
    showLoading(false);
  }
}

// Update KPI Metrics Cards
function updateKPIs() {
  if (!usageData || !usageData.byProject) return;
  
  let totalCost = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let totalCached = 0;
  let totalConversations = 0;
  
  const targetProjectKeys = selectedProjectIds.length > 0 
    ? selectedProjectIds 
    : Object.keys(usageData.byProject);
    
  targetProjectKeys.forEach(key => {
    const group = usageData.byProject[key];
    if (group && group.conversations) {
      group.conversations.forEach(conv => {
        let convMatches = false;
        let convInput = 0;
        let convOutput = 0;
        let convCached = 0;
        let convCost = 0;
        
        conv.generations.forEach(gen => {
          const matchesModel = selectedModels.length === 0 || selectedModels.includes(gen.model);
          if (matchesModel) {
            convMatches = true;
            const modelPrice = prices[gen.model] || prices["Gemini 3.5 Flash (Medium)"];
            const inCost = (gen.input_tokens / 1000000) * modelPrice.input;
            const outCost = (gen.output_tokens / 1000000) * modelPrice.output;
            const cachedCost = (gen.cached_tokens / 1000000) * modelPrice.cached;
            
            convCost += (inCost + outCost + cachedCost);
            convInput += gen.input_tokens;
            convOutput += gen.output_tokens;
            convCached += gen.cached_tokens;
          }
        });
        
        if (convMatches) {
          totalCost += convCost;
          totalInput += convInput;
          totalOutput += convOutput;
          totalCached += convCached;
          totalConversations++;
        }
      });
    }
  });
  
  document.getElementById('kpi-total-cost').innerText = `$${totalCost.toFixed(3)}`;
  document.getElementById('kpi-cost-subtext').innerText = `${totalConversations} conversações correspondentes`;
  
  document.getElementById('kpi-input-tokens').innerText = formatNumber(totalInput);
  document.getElementById('kpi-input-subtext').innerText = `Valor bruto: $${((totalInput / 1000000) * 0.075).toFixed(3)} (Base)`;
  
  document.getElementById('kpi-cached-tokens').innerText = formatNumber(totalCached);
  document.getElementById('kpi-cached-subtext').innerText = `Tokens salvos via prompt cache`;
  
  document.getElementById('kpi-output-tokens').innerText = formatNumber(totalOutput);
  document.getElementById('kpi-output-subtext').innerText = `Respostas geradas`;
}

// Render Dashboard Summary Table
function renderDashboardTable() {
  const tbody = document.querySelector('#projects-summary-table tbody');
  tbody.innerHTML = '';
  
  if (!usageData || !usageData.byProject) return;
  
  const targetProjectKeys = selectedProjectIds.length > 0 
    ? selectedProjectIds 
    : Object.keys(usageData.byProject);
    
  targetProjectKeys.forEach(key => {
    const group = usageData.byProject[key];
    if (!group) return;
    
    const isUnregistered = key === 'unregistered';
    const projName = group.project.name;
    const projPath = isUnregistered ? 'N/A' : group.project.path;
    
    // Filter metrics by selected models
    let projectCost = 0;
    let projectInput = 0;
    let projectOutput = 0;
    let projectCached = 0;
    let matchedConvsCount = 0;
    const uniqueModels = new Set();
    
    group.conversations.forEach(conv => {
      let convMatched = false;
      conv.generations.forEach(gen => {
        const matchesModel = selectedModels.length === 0 || selectedModels.includes(gen.model);
        if (matchesModel) {
          convMatched = true;
          if (gen.model) uniqueModels.add(gen.model);
          
          const modelPrice = prices[gen.model] || prices["Gemini 3.5 Flash (Medium)"];
          const inCost = (gen.input_tokens / 1000000) * modelPrice.input;
          const outCost = (gen.output_tokens / 1000000) * modelPrice.output;
          const cachedCost = (gen.cached_tokens / 1000000) * modelPrice.cached;
          
          projectCost += (inCost + outCost + cachedCost);
          projectInput += gen.input_tokens;
          projectOutput += gen.output_tokens;
          projectCached += gen.cached_tokens;
        }
      });
      if (convMatched) {
        matchedConvsCount++;
      }
    });
    
    // If the project doesn't have any matching conversation with the selected models,
    // and a model filter is active, skip rendering this project
    if (selectedModels.length > 0 && matchedConvsCount === 0) {
      return;
    }
    
    const modelsList = uniqueModels.size > 0 
      ? Array.from(uniqueModels).map(m => `<span class="model-badge">${m}</span>`).join(' ') 
      : '<span class="model-badge empty">Nenhum</span>';
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="project-name-td">${projName}</td>
      <td><span class="path-code">${projPath}</span></td>
      <td>${modelsList}</td>
      <td>${matchedConvsCount}</td>
      <td>${formatNumber(projectInput)}</td>
      <td>${formatNumber(projectCached)}</td>
      <td>${formatNumber(projectOutput)}</td>
      <td class="cost-td">$${projectCost.toFixed(3)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Render Graphs using Chart.js
function renderCharts() {
  if (!usageData || !usageData.byProject) return;
  
  // 1. Cost by Project Chart
  const costCtx = document.getElementById('cost-by-project-chart').getContext('2d');
  
  if (costChartInstance) {
    costChartInstance.destroy();
  }
  
  const projectLabels = [];
  const projectCosts = [];
  const backgroundColors = ['#9b5de5', '#00f5d4', '#f15bb5', '#00bbf9', '#ff9f43', '#10ac84', '#57606f'];
  
  const targetProjectKeys = selectedProjectIds.length > 0 
    ? selectedProjectIds 
    : Object.keys(usageData.byProject);
    
  targetProjectKeys.forEach(key => {
    const group = usageData.byProject[key];
    if (!group) return;
    
    let projectCost = 0;
    group.conversations.forEach(conv => {
      conv.generations.forEach(gen => {
        const matchesModel = selectedModels.length === 0 || selectedModels.includes(gen.model);
        if (matchesModel) {
          const modelPrice = prices[gen.model] || prices["Gemini 3.5 Flash (Medium)"];
          const stepCost = ((gen.input_tokens / 1000000) * modelPrice.input) +
                           ((gen.output_tokens / 1000000) * modelPrice.output) +
                           ((gen.cached_tokens / 1000000) * modelPrice.cached);
          projectCost += stepCost;
        }
      });
    });
    
    if (selectedModels.length === 0 || projectCost > 0) {
      projectLabels.push(group.project.name);
      projectCosts.push(parseFloat(projectCost.toFixed(3)));
    }
  });
  
  if (projectCosts.length === 0 || projectCosts.reduce((a, b) => a + b, 0) === 0) {
    projectLabels.push('Sem Dados');
    projectCosts.push(1); // placeholder to show empty state
  }

  costChartInstance = new Chart(costCtx, {
    type: 'doughnut',
    data: {
      labels: projectLabels,
      datasets: [{
        data: projectCosts,
        backgroundColor: backgroundColors.slice(0, projectLabels.length),
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#f8f9fa',
            font: { family: 'Inter', size: 12 }
          }
        }
      }
    }
  });
  
  // 2. Tokens consumed by Model Chart
  const modelCtx = document.getElementById('tokens-by-model-chart').getContext('2d');
  
  if (tokensChartInstance) {
    tokensChartInstance.destroy();
  }
  
  // Group tokens by model name, filtering by active projects and models
  const modelStats = {};
  
  targetProjectKeys.forEach(key => {
    const group = usageData.byProject[key];
    if (!group) return;
    
    group.conversations.forEach(conv => {
      conv.generations.forEach(gen => {
        const model = gen.model;
        const matchesModel = selectedModels.length === 0 || selectedModels.includes(model);
        if (matchesModel) {
          if (!modelStats[model]) {
            modelStats[model] = { input: 0, output: 0, cached: 0 };
          }
          modelStats[model].input += gen.input_tokens;
          modelStats[model].output += gen.output_tokens;
          modelStats[model].cached += gen.cached_tokens;
        }
      });
    });
  });
  
  const models = Object.keys(modelStats);
  const inputDataset = [];
  const cachedDataset = [];
  const outputDataset = [];
  
  models.forEach(model => {
    inputDataset.push(modelStats[model].input);
    cachedDataset.push(modelStats[model].cached);
    outputDataset.push(modelStats[model].output);
  });
  
  tokensChartInstance = new Chart(modelCtx, {
    type: 'bar',
    data: {
      labels: models,
      datasets: [
        {
          label: 'Entrada',
          data: inputDataset,
          backgroundColor: '#9b5de5'
        },
        {
          label: 'Cache (Hit)',
          data: cachedDataset,
          backgroundColor: '#00bbf9'
        },
        {
          label: 'Saída',
          data: outputDataset,
          backgroundColor: '#f15bb5'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#a4b0be', font: { family: 'Inter' } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#a4b0be', font: { family: 'Inter' } }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: '#f8f9fa',
            font: { family: 'Inter' }
          }
        }
      }
    }
  });

  // Render Time Series line chart
  updateTimeSeriesChart();
}

// Notice Box for Unregistered Workspaces
function updateUnregisteredNotice() {
  const noticeBox = document.getElementById('unregistered-notice-box');
  const linksList = document.getElementById('unregistered-links-list');
  
  if (!usageData || !usageData.unregisteredWorkspaces || usageData.unregisteredWorkspaces.length === 0) {
    noticeBox.classList.add('hidden');
    return;
  }
  
  noticeBox.classList.remove('hidden');
  linksList.innerHTML = '';
  
  usageData.unregisteredWorkspaces.forEach(ws => {
    // Show only the last two directories for name suggestion
    const cleanPath = ws.replace('file://', '');
    const parts = cleanPath.split('/');
    const suggestionName = parts.slice(-2).join('/');
    
    const badge = document.createElement('span');
    badge.className = 'suggestion-badge';
    badge.innerHTML = `➕ ${suggestionName}`;
    badge.onclick = () => {
      switchTab('projects');
      document.getElementById('project-name').value = parts[parts.length - 1];
      document.getElementById('project-path').value = cleanPath;
      document.getElementById('project-name').focus();
    };
    linksList.appendChild(badge);
  });
}

// Render Registered Projects List
function renderProjectsList() {
  const list = document.getElementById('registered-projects-list');
  list.innerHTML = '';
  
  if (projects.length === 0) {
    list.innerHTML = '<li class="project-item"><div class="project-item-name">Nenhum projeto cadastrado ainda.</div></li>';
    return;
  }
  
  projects.forEach(p => {
    const li = document.createElement('li');
    li.className = 'project-item';
    li.innerHTML = `
      <div class="project-item-info">
        <span class="project-item-name">${p.name}</span>
        <span class="project-item-path">${p.path}</span>
      </div>
      <button class="btn btn-danger" onclick="deleteProject('${p.id}')">Excluir</button>
    `;
    list.appendChild(li);
  });
}

// Render Suggestions Grid based on scanned database activity
function renderScannerSuggestions() {
  const grid = document.getElementById('scanner-suggestions-grid');
  grid.innerHTML = '';
  
  if (!usageData || !usageData.unregisteredWorkspaces || usageData.unregisteredWorkspaces.length === 0) {
    grid.innerHTML = '<p class="section-desc">Todos os diretórios locais mapeados em histórico já estão cadastrados!</p>';
    return;
  }
  
  usageData.unregisteredWorkspaces.forEach(ws => {
    const cleanPath = ws.replace('file://', '');
    const parts = cleanPath.split('/');
    const folderName = parts[parts.length - 1] || 'Workspace General';
    
    const card = document.createElement('div');
    card.className = 'scanner-card';
    card.innerHTML = `
      <div>
        <h4 style="margin-bottom:6px;">${folderName}</h4>
        <span class="scanner-card-path">${cleanPath}</span>
      </div>
      <button class="btn btn-secondary" onclick="quickRegister('${folderName}', '${cleanPath}')" style="width:100%; justify-content:center;">
        Mapear como Projeto
      </button>
    `;
    grid.appendChild(card);
  });
}

// Register Project (Form Submission)
async function registerProject(e) {
  e.preventDefault();
  const name = document.getElementById('project-name').value;
  const path = document.getElementById('project-path').value;
  
  showLoading(true);
  try {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, path })
    });
    
    if (res.ok) {
      document.getElementById('new-project-form').reset();
      await fetchProjects();
      await fetchData(); // refresh stats matching
    } else {
      const err = await res.json();
      await systemAlert('Erro', `Erro: ${err.error}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    showLoading(false);
  }
}

// Quick Register from Suggestions
async function quickRegister(name, path) {
  showLoading(true);
  try {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, path })
    });
    
    if (res.ok) {
      await fetchProjects();
      await fetchData();
    } else {
      const err = await res.json();
      await systemAlert('Erro', `Erro: ${err.error}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    showLoading(false);
  }
}

// Delete Project
async function deleteProject(id) {
  if (!await systemConfirm('Remover Projeto', 'Deseja realmente remover o monitoramento deste projeto? Os bancos de dados locais NÃO serão apagados.')) {
    return;
  }
  
  showLoading(true);
  try {
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchProjects();
      await fetchData();
    } else {
      await systemAlert('Erro', 'Erro ao excluir projeto.');
    }
  } catch (err) {
    console.error(err);
  } finally {
    showLoading(false);
  }
}

// Populate Project Filter in History Tab
function populateHistoryFilter() {
  const select = document.getElementById('filter-project');
  select.innerHTML = '<option value="all">Todos os Projetos</option>';
  
  if (!usageData || !usageData.byProject) return;
  
  Object.entries(usageData.byProject).forEach(([key, group]) => {
    const option = document.createElement('option');
    option.value = key;
    option.innerText = group.project.name;
    select.appendChild(option);
  });
}

// Render History Table
function renderHistoryTable() {
  const tbody = document.querySelector('#history-table tbody');
  tbody.innerHTML = '';
  
  if (!usageData || !usageData.byProject) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Nenhuma conversação registrada.</td></tr>';
    return;
  }
  
  const filterVal = document.getElementById('filter-project').value;
  let list = [];
  
  Object.entries(usageData.byProject).forEach(([key, group]) => {
    if (filterVal === 'all' || filterVal === key) {
      group.conversations.forEach(conv => {
        list.push({
          ...conv,
          projectName: group.project.name
        });
      });
    }
  });
  
  // Sort history by last modified date (descending)
  list.sort((a, b) => b.last_modified - a.last_modified);
  
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Nenhuma conversa encontrada para o filtro selecionado.</td></tr>';
    return;
  }
  
  list.forEach(c => {
    const tr = document.createElement('tr');
    const dateStr = new Date(c.last_modified * 1000).toLocaleString('pt-BR');
    
    tr.innerHTML = `
      <td style="font-family: monospace; font-size:12px;">${c.conversation_id.slice(0, 8)}...</td>
      <td class="project-name-td">${c.projectName}</td>
      <td>${dateStr}</td>
      <td>${c.steps_count}</td>
      <td>${formatNumber(c.input_tokens)}</td>
      <td>${formatNumber(c.cached_tokens)}</td>
      <td>${formatNumber(c.output_tokens)}</td>
      <td class="cost-td">$${c.cost.toFixed(3)}</td>
      <td>
        <button class="btn btn-secondary" onclick="openDetails('${c.conversation_id}')" style="padding: 6px 12px; font-size:12px;">
          🔍 Detalhes
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function applyFilters() {
  renderHistoryTable();
}

// Modal Conversation Details
function openDetails(convId) {
  // Find conversation
  let found = null;
  let groupName = '';
  
  Object.values(usageData.byProject).forEach(group => {
    const match = group.conversations.find(c => c.conversation_id === convId);
    if (match) {
      found = match;
      groupName = group.project.name;
    }
  });
  
  if (!found) return;
  
  document.getElementById('modal-title').innerText = `Detalhes: ${found.conversation_id.slice(0, 16)}... (${groupName})`;
  document.getElementById('modal-cost').innerText = `$${found.cost.toFixed(3)}`;
  document.getElementById('modal-input').innerText = formatNumber(found.input_tokens);
  document.getElementById('modal-cached').innerText = formatNumber(found.cached_tokens);
  document.getElementById('modal-output').innerText = formatNumber(found.output_tokens);
  
  const tbody = document.querySelector('#modal-steps-table tbody');
  tbody.innerHTML = '';
  
  found.generations.forEach((gen, idx) => {
    const tr = document.createElement('tr');
    const stepCost = calcStepCost(gen);
    const dateStr = new Date(gen.timestamp * 1000).toLocaleTimeString('pt-BR');
    
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td style="font-weight: 500;">${gen.model}</td>
      <td>${formatNumber(gen.input_tokens)}</td>
      <td>${formatNumber(gen.cached_tokens)}</td>
      <td>${formatNumber(gen.output_tokens)}</td>
      <td class="cost-td">$${stepCost.toFixed(4)}</td>
      <td>${dateStr}</td>
    `;
    tbody.appendChild(tr);
  });
  
  document.getElementById('conv-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('conv-modal').classList.add('hidden');
}

// Custom Dialog Promise-based implementation
let dialogResolve = null;

function showSystemDialog(title, message, isConfirm = false) {
  return new Promise((resolve) => {
    dialogResolve = resolve;
    document.getElementById('dialog-title').innerText = title;
    document.getElementById('dialog-message').innerText = message;
    
    const cancelBtn = document.getElementById('dialog-btn-cancel');
    const okBtn = document.getElementById('dialog-btn-ok');
    
    if (isConfirm) {
      cancelBtn.style.display = 'inline-flex';
      okBtn.innerText = 'Confirmar';
    } else {
      cancelBtn.style.display = 'none';
      okBtn.innerText = 'OK';
    }
    
    document.getElementById('dialog-modal').classList.remove('hidden');
  });
}

function closeDialog(result) {
  document.getElementById('dialog-modal').classList.add('hidden');
  if (dialogResolve) {
    dialogResolve(result);
    dialogResolve = null;
  }
}

async function systemAlert(title, message) {
  await showSystemDialog(title, message, false);
}

async function systemConfirm(title, message) {
  return await showSystemDialog(title, message, true);
}

function calcStepCost(gen) {
  const modelPrice = prices[gen.model] || prices["Gemini 3.5 Flash (Medium)"];
  const inCost = (gen.input_tokens / 1000000) * modelPrice.input;
  const outCost = (gen.output_tokens / 1000000) * modelPrice.output;
  const cachedCost = (gen.cached_tokens / 1000000) * modelPrice.cached;
  return inCost + outCost + cachedCost;
}

// Render Prices Configuration Table
function renderPricesTable() {
  const tbody = document.querySelector('#prices-edit-table tbody');
  tbody.innerHTML = '';
  
  Object.entries(prices).forEach(([modelName, values]) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight: 600;">${modelName}</td>
      <td>
        <input type="number" step="0.001" value="${values.input}" data-model="${modelName}" data-type="input" required>
      </td>
      <td>
        <input type="number" step="0.001" value="${values.cached}" data-model="${modelName}" data-type="cached" required>
      </td>
      <td>
        <input type="number" step="0.001" value="${values.output}" data-model="${modelName}" data-type="output" required>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Save Updated Prices
async function savePrices(e) {
  e.preventDefault();
  
  const inputs = document.querySelectorAll('#prices-edit-table input');
  const newPrices = { ...prices };
  
  inputs.forEach(input => {
    const model = input.getAttribute('data-model');
    const type = input.getAttribute('data-type');
    const val = parseFloat(input.value);
    
    if (!newPrices[model]) {
      newPrices[model] = {};
    }
    newPrices[model][type] = val;
  });
  
  showLoading(true);
  try {
    const res = await fetch('/api/prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPrices)
    });
    
    if (res.ok) {
      prices = newPrices;
      await systemAlert('Sucesso', 'Tabela de preços atualizada com sucesso!');
      await fetchData(); // Recalculate costs with new prices
    } else {
      await systemAlert('Erro', 'Erro ao salvar preços.');
    }
  } catch (err) {
    console.error(err);
  } finally {
    showLoading(false);
  }
}

// Automatically update prices from the internet
async function updatePricesAutomatically() {
  if (!await systemConfirm('Atualizar via Internet', 'Deseja buscar as tarifas mais recentes da internet para os seus modelos cadastrados? Os valores locais serão atualizados automaticamente.')) return;
  
  showLoading(true);
  try {
    const res = await fetch('/api/prices/update-auto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (res.ok) {
      const data = await res.json();
      prices = data.prices;
      renderPricesTable();
      if (data.updatedCount > 0) {
        let msg = `Sucesso! Preços de ${data.updatedCount} modelos foram atualizados:\n`;
        data.updates.forEach(u => {
          msg += `- ${u.model} (Mapeado de "${u.matchedAs}"): $${u.old.input.toFixed(3)} -> $${u.new.input.toFixed(3)} input\n`;
        });
        await systemAlert('Atualização de Preços', msg);
      } else {
        await systemAlert('Atualização de Preços', 'Todos os preços já estão atualizados com as tarifas mais recentes da internet!');
      }
      await fetchData(); // Recalculate everything with new prices
    } else {
      const err = await res.json();
      await systemAlert('Erro', `Erro ao atualizar preços: ${err.error || 'Erro desconhecido'}`);
    }
  } catch (err) {
    console.error(err);
    await systemAlert('Erro', 'Erro de conexão ao tentar atualizar os preços.');
  } finally {
    showLoading(false);
  }
}

// Reset Prices to System Defaults
async function resetPricesToDefault() {
  if (!await systemConfirm('Restaurar Padrões', 'Deseja restaurar as tarifas padrão do sistema?')) return;
  
  const defaultPrices = {
    "Gemini 3.5 Flash (Medium)": { "input": 0.075, "output": 0.30, "cached": 0.01875 },
    "Gemini 3.5 Flash (High)": { "input": 0.075, "output": 0.30, "cached": 0.01875 },
    "Gemini 3.5 Flash (Low)": { "input": 0.075, "output": 0.30, "cached": 0.01875 },
    "Gemini 3.1 Pro (Low)": { "input": 1.25, "output": 5.00, "cached": 0.3125 },
    "Gemini 3.1 Pro (High)": { "input": 1.25, "output": 5.00, "cached": 0.3125 },
    "Claude Sonnet 4.6 (Thinking)": { "input": 3.00, "output": 15.00, "cached": 0.30 },
    "Claude Opus 4.6 (Thinking)": { "input": 15.00, "output": 75.00, "cached": 1.50 },
    "GPT-OSS 120B (Medium)": { "input": 0.50, "output": 0.50, "cached": 0.00 }
  };
  
  showLoading(true);
  try {
    const res = await fetch('/api/prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(defaultPrices)
    });
    
    if (res.ok) {
      prices = defaultPrices;
      renderPricesTable();
      await systemAlert('Sucesso', 'Tarifas padrão restauradas!');
      await fetchData();
    }
  } catch (err) {
    console.error(err);
  } finally {
    showLoading(false);
  }
}

// Helper: Format large numbers (125000 -> "125.000" or similar)
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Render Time Series Token Consumption Line Chart
function updateTimeSeriesChart() {
  if (!usageData || !usageData.rawStats) return;
  
  const select = document.getElementById('timeframe-select');
  const timeframe = select ? select.value : 'day';
  
  const canvas = document.getElementById('time-series-chart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  if (timeSeriesChartInstance) {
    timeSeriesChartInstance.destroy();
  }
  
  // Gather generations filtered by selected projects and models
  const generations = [];
  const targetProjectKeys = selectedProjectIds.length > 0 
    ? selectedProjectIds 
    : Object.keys(usageData.byProject);
    
  targetProjectKeys.forEach(key => {
    const group = usageData.byProject[key];
    if (group && group.conversations) {
      group.conversations.forEach(conv => {
        if (conv.generations && Array.isArray(conv.generations)) {
          conv.generations.forEach(gen => {
            const matchesModel = selectedModels.length === 0 || selectedModels.includes(gen.model);
            if (matchesModel) {
              generations.push(gen);
            }
          });
        }
      });
    }
  });
  
  // Sort generations by timestamp ascending
  generations.sort((a, b) => a.timestamp - b.timestamp);
  
  const now = Math.floor(Date.now() / 1000);
  
  let labels = [];
  let inputData = [];
  let cachedData = [];
  let outputData = [];
  
  if (timeframe === 'hour') {
    // Last 24 hours
    const bins = {};
    for (let i = 23; i >= 0; i--) {
      const binTime = new Date((now - i * 3600) * 1000);
      binTime.setMinutes(0, 0, 0);
      const key = binTime.getTime();
      bins[key] = { label: `${String(binTime.getHours()).padStart(2, '0')}:00`, input: 0, cached: 0, output: 0 };
    }
    
    generations.forEach(gen => {
      const genTime = new Date(gen.timestamp * 1000);
      genTime.setMinutes(0, 0, 0);
      const key = genTime.getTime();
      if (bins[key]) {
        bins[key].input += gen.input_tokens;
        bins[key].cached += gen.cached_tokens;
        bins[key].output += gen.output_tokens;
      }
    });
    
    Object.values(bins).forEach(bin => {
      labels.push(bin.label);
      inputData.push(parseFloat((bin.input / 1000).toFixed(1)));
      cachedData.push(parseFloat((bin.cached / 1000).toFixed(1)));
      outputData.push(parseFloat((bin.output / 1000).toFixed(1)));
    });
    
  } else if (timeframe === 'day') {
    // Last 30 days
    const bins = {};
    for (let i = 29; i >= 0; i--) {
      const binDate = new Date((now - i * 86400) * 1000);
      binDate.setHours(0, 0, 0, 0);
      const key = binDate.getTime();
      const label = `${binDate.getDate()}/${binDate.getMonth() + 1}`;
      bins[key] = { label, input: 0, cached: 0, output: 0 };
    }
    
    generations.forEach(gen => {
      const genDate = new Date(gen.timestamp * 1000);
      genDate.setHours(0, 0, 0, 0);
      const key = genDate.getTime();
      if (bins[key]) {
        bins[key].input += gen.input_tokens;
        bins[key].cached += gen.cached_tokens;
        bins[key].output += gen.output_tokens;
      }
    });
    
    Object.values(bins).forEach(bin => {
      labels.push(bin.label);
      inputData.push(parseFloat((bin.input / 1000).toFixed(1)));
      cachedData.push(parseFloat((bin.cached / 1000).toFixed(1)));
      outputData.push(parseFloat((bin.output / 1000).toFixed(1)));
    });
    
  } else if (timeframe === 'week') {
    // Last 12 weeks
    const bins = {};
    for (let i = 11; i >= 0; i--) {
      const binDate = new Date((now - i * 7 * 86400) * 1000);
      const day = binDate.getDay();
      const diff = binDate.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(binDate.setDate(diff));
      monday.setHours(0, 0, 0, 0);
      
      const key = monday.getTime();
      const label = `Sem ${getWeekNumber(monday)}`;
      bins[key] = { label, input: 0, cached: 0, output: 0 };
    }
    
    generations.forEach(gen => {
      const genDate = new Date(gen.timestamp * 1000);
      const day = genDate.getDay();
      const diff = genDate.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(genDate.setDate(diff));
      monday.setHours(0, 0, 0, 0);
      
      const key = monday.getTime();
      if (bins[key]) {
        bins[key].input += gen.input_tokens;
        bins[key].cached += gen.cached_tokens;
        bins[key].output += gen.output_tokens;
      }
    });
    
    Object.values(bins).forEach(bin => {
      labels.push(bin.label);
      inputData.push(parseFloat((bin.input / 1000).toFixed(1)));
      cachedData.push(parseFloat((bin.cached / 1000).toFixed(1)));
      outputData.push(parseFloat((bin.output / 1000).toFixed(1)));
    });
    
  } else if (timeframe === 'month') {
    // Last 12 months
    const bins = {};
    const monthsShort = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    
    for (let i = 11; i >= 0; i--) {
      const binDate = new Date();
      binDate.setMonth(binDate.getMonth() - i);
      binDate.setDate(1);
      binDate.setHours(0, 0, 0, 0);
      
      const key = binDate.getFullYear() * 100 + binDate.getMonth();
      const label = `${monthsShort[binDate.getMonth()]}/${String(binDate.getFullYear()).slice(-2)}`;
      bins[key] = { label, input: 0, cached: 0, output: 0 };
    }
    
    generations.forEach(gen => {
      const genDate = new Date(gen.timestamp * 1000);
      const key = genDate.getFullYear() * 100 + genDate.getMonth();
      if (bins[key]) {
        bins[key].input += gen.input_tokens;
        bins[key].cached += gen.cached_tokens;
        bins[key].output += gen.output_tokens;
      }
    });
    
    Object.values(bins).forEach(bin => {
      labels.push(bin.label);
      inputData.push(parseFloat((bin.input / 1000).toFixed(1)));
      cachedData.push(parseFloat((bin.cached / 1000).toFixed(1)));
      outputData.push(parseFloat((bin.output / 1000).toFixed(1)));
    });
  }
  
  function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    return weekNo;
  }
  
  // Read checkbox states for Entrada, Cache Hit, and Saída (with fallbacks)
  const inputEl = document.getElementById('toggle-input-tokens');
  const cachedEl = document.getElementById('toggle-cached-tokens');
  const outputEl = document.getElementById('toggle-output-tokens');
  
  const showInput = inputEl ? inputEl.checked : true;
  const showCached = cachedEl ? cachedEl.checked : true;
  const showOutput = outputEl ? outputEl.checked : true;
  
  const datasets = [];
  if (showInput) {
    datasets.push({
      label: 'Entrada (K)',
      data: inputData,
      borderColor: '#9b5de5',
      backgroundColor: 'rgba(155, 93, 229, 0.05)',
      fill: true,
      tension: 0.3,
      borderWidth: 2
    });
  }
  if (showCached) {
    datasets.push({
      label: 'Cache Hit (K)',
      data: cachedData,
      borderColor: '#00bbf9',
      backgroundColor: 'rgba(0, 187, 249, 0.05)',
      fill: true,
      tension: 0.3,
      borderWidth: 2
    });
  }
  if (showOutput) {
    datasets.push({
      label: 'Saída (K)',
      data: outputData,
      borderColor: '#f15bb5',
      backgroundColor: 'rgba(241, 91, 181, 0.05)',
      fill: true,
      tension: 0.3,
      borderWidth: 2
    });
  }
  
  timeSeriesChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          labels: {
            color: '#f8f9fa',
            font: { family: 'Inter', size: 12 }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${context.raw.toLocaleString('pt-BR')} K tokens`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#a4b0be', font: { family: 'Inter', size: 11 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { 
            color: '#a4b0be', 
            font: { family: 'Inter', size: 11 },
            callback: function(value) {
              return value.toLocaleString('pt-BR') + ' K';
            }
          }
        }
      }
    }
  });
}

// Auto-complete multi-select functions for Project Filters
function showProjectSuggestions() {
  const dropdown = document.getElementById('project-suggestions-dropdown');
  if (!dropdown) return;
  
  renderProjectSuggestions();
  dropdown.classList.remove('hidden');
}

function hideProjectSuggestionsDelayed() {
  setTimeout(() => {
    const dropdown = document.getElementById('project-suggestions-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
  }, 250);
}

function renderProjectSuggestions(filterText = '') {
  const dropdown = document.getElementById('project-suggestions-dropdown');
  if (!dropdown || !usageData || !usageData.byProject) return;
  
  dropdown.innerHTML = '';
  
  const query = filterText.toLowerCase().trim();
  const availableProjects = [];
  
  Object.entries(usageData.byProject).forEach(([key, group]) => {
    if (!selectedProjectIds.includes(key)) {
      availableProjects.push({ id: key, name: group.project.name });
    }
  });
  
  const filtered = availableProjects.filter(p => p.name.toLowerCase().includes(query));
  
  if (filtered.length === 0) {
    dropdown.innerHTML = '<div class="suggestion-item" style="cursor: default; color: var(--text-muted);">Nenhum projeto encontrado</div>';
    return;
  }
  
  filtered.forEach(p => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.innerText = p.name;
    div.onmousedown = () => {
      selectProject(p.id, p.name);
    };
    dropdown.appendChild(div);
  });
}

function filterProjectSuggestions() {
  const input = document.getElementById('project-autocomplete-input');
  if (input) {
    renderProjectSuggestions(input.value);
  }
}

function selectProject(id, name) {
  if (!selectedProjectIds.includes(id)) {
    selectedProjectIds.push(id);
    renderProjectTags();
    
    const input = document.getElementById('project-autocomplete-input');
    if (input) input.value = '';
    
    refreshFilteredDashboard();
  }
}

function removeProjectTag(id) {
  selectedProjectIds = selectedProjectIds.filter(projId => projId !== id);
  renderProjectTags();
  refreshFilteredDashboard();
}

function renderProjectTags() {
  const container = document.getElementById('project-tags-container');
  if (!container || !usageData || !usageData.byProject) return;
  
  container.innerHTML = '';
  
  selectedProjectIds.forEach(id => {
    const group = usageData.byProject[id];
    const name = group ? group.project.name : 'Outros';
    
    const tag = document.createElement('div');
    tag.className = 'project-tag';
    tag.innerHTML = `
      <span>${name}</span>
      <span class="project-tag-remove" onclick="removeProjectTag('${id}')">✕</span>
    `;
    container.appendChild(tag);
  });
}

// Global filter helper to refresh the entire dashboard
function refreshFilteredDashboard() {
  updateKPIs();
  renderDashboardTable();
  renderCharts();
}

// Auto-complete multi-select functions for Model Filters
function showModelSuggestions() {
  const dropdown = document.getElementById('model-suggestions-dropdown');
  if (!dropdown) return;
  
  renderModelSuggestions();
  dropdown.classList.remove('hidden');
}

function hideModelSuggestionsDelayed() {
  setTimeout(() => {
    const dropdown = document.getElementById('model-suggestions-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
  }, 250);
}

function renderModelSuggestions(filterText = '') {
  const dropdown = document.getElementById('model-suggestions-dropdown');
  if (!dropdown || !prices) return;
  
  dropdown.innerHTML = '';
  
  const query = filterText.toLowerCase().trim();
  const availableModels = [];
  
  Object.keys(prices).forEach(modelName => {
    if (!selectedModels.includes(modelName)) {
      availableModels.push(modelName);
    }
  });
  
  const filtered = availableModels.filter(m => m.toLowerCase().includes(query));
  
  if (filtered.length === 0) {
    dropdown.innerHTML = '<div class="suggestion-item" style="cursor: default; color: var(--text-muted);">Nenhum modelo encontrado</div>';
    return;
  }
  
  filtered.forEach(m => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.innerText = m;
    div.onmousedown = () => {
      selectModel(m);
    };
    dropdown.appendChild(div);
  });
}

function filterModelSuggestions() {
  const input = document.getElementById('model-autocomplete-input');
  if (input) {
    renderModelSuggestions(input.value);
  }
}

function selectModel(modelName) {
  if (!selectedModels.includes(modelName)) {
    selectedModels.push(modelName);
    renderModelTags();
    
    const input = document.getElementById('model-autocomplete-input');
    if (input) input.value = '';
    
    refreshFilteredDashboard();
  }
}

function removeModelTag(modelName) {
  selectedModels = selectedModels.filter(m => m !== modelName);
  renderModelTags();
  refreshFilteredDashboard();
}

function renderModelTags() {
  const container = document.getElementById('model-tags-container');
  if (!container) return;
  
  container.innerHTML = '';
  
  selectedModels.forEach(m => {
    const tag = document.createElement('div');
    tag.className = 'project-tag';
    tag.style.background = 'rgba(155, 93, 229, 0.15)';
    tag.style.borderColor = 'rgba(155, 93, 229, 0.3)';
    tag.style.color = 'var(--text-main)';
    tag.innerHTML = `
      <span>${m}</span>
      <span class="project-tag-remove" onclick="removeModelTag('${m}')">✕</span>
    `;
    container.appendChild(tag);
  });
}
