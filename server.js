const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const https = require('https');

// Load environment variables from .env file if it exists
const dotenvPath = path.join(__dirname, '.env');
if (fs.existsSync(dotenvPath)) {
  try {
    const envContent = fs.readFileSync(dotenvPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        let val = parts.slice(1).join('=').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    });
  } catch (err) {
    console.error('Warning: Failed to load .env file:', err);
  }
}

const app = express();
const PORT = process.env.PORT || 3030;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PROJECTS_FILE = path.join(__dirname, 'projects.json');
const PRICES_FILE = path.join(__dirname, 'prices.json');

// Default model prices per 1 Million tokens
const DEFAULT_PRICES = {
  "Gemini 3.5 Flash (Medium)": { "input": 0.075, "output": 0.30, "cached": 0.01875 },
  "Gemini 3.5 Flash (High)": { "input": 0.075, "output": 0.30, "cached": 0.01875 },
  "Gemini 3.5 Flash (Low)": { "input": 0.075, "output": 0.30, "cached": 0.01875 },
  "Gemini 3.1 Pro (Low)": { "input": 1.25, "output": 5.00, "cached": 0.3125 },
  "Gemini 3.1 Pro (High)": { "input": 1.25, "output": 5.00, "cached": 0.3125 },
  "Claude Sonnet 4.6 (Thinking)": { "input": 3.00, "output": 15.00, "cached": 0.30 },
  "Claude Opus 4.6 (Thinking)": { "input": 15.00, "output": 75.00, "cached": 1.50 },
  "GPT-OSS 120B (Medium)": { "input": 0.50, "output": 0.50, "cached": 0.00 }
};

// Helper: Read JSON file safely
function readJSON(file, defaults = {}) {
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(defaults, null, 2));
      return defaults;
    }
    const content = fs.readFileSync(file, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
    return defaults;
  }
}

// Helper: Write JSON file safely
function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Error writing ${file}:`, err);
  }
}

// Ensure files exist
readJSON(PROJECTS_FILE, []);
readJSON(PRICES_FILE, DEFAULT_PRICES);

// --- APIs ---

// Projects CRUD
app.get('/api/projects', (req, res) => {
  const projects = readJSON(PROJECTS_FILE, []);
  res.json(projects);
});

app.post('/api/projects', (req, res) => {
  const projects = readJSON(PROJECTS_FILE, []);
  const { name, path: projectPath } = req.body;
  
  if (!name || !projectPath) {
    return res.status(400).json({ error: 'Name and Path are required.' });
  }

  // Normalize path: replace file://, remove trailing slash
  let normalizedPath = projectPath.trim();
  if (normalizedPath.startsWith('file://')) {
    normalizedPath = normalizedPath.replace('file://', '');
  }
  // Ensure it's absolute
  if (!normalizedPath.startsWith('/')) {
    normalizedPath = '/' + normalizedPath;
  }
  // Remove trailing slash if present, except if it is root '/'
  if (normalizedPath.endsWith('/') && normalizedPath.length > 1) {
    normalizedPath = normalizedPath.slice(0, -1);
  }

  const newProject = {
    id: Date.now().toString(),
    name,
    path: normalizedPath,
    createdAt: new Date().toISOString()
  };

  projects.push(newProject);
  writeJSON(PROJECTS_FILE, projects);
  res.status(201).json(newProject);
});

app.delete('/api/projects/:id', (req, res) => {
  let projects = readJSON(PROJECTS_FILE, []);
  const id = req.params.id;
  
  const filtered = projects.filter(p => p.id !== id);
  if (filtered.length === projects.length) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  writeJSON(PROJECTS_FILE, filtered);
  res.json({ success: true });
});

// Cost Config CRUD
app.get('/api/prices', (req, res) => {
  const prices = readJSON(PRICES_FILE, DEFAULT_PRICES);
  res.json(prices);
});

app.post('/api/prices', (req, res) => {
  const newPrices = req.body;
  writeJSON(PRICES_FILE, newPrices);
  res.json({ success: true, prices: newPrices });
});

// Helper: Fetch pricing data from the internet
function fetchLLMPrices() {
  return new Promise((resolve, reject) => {
    https.get('https://www.llm-prices.com/current-v1.json', (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch pricing: HTTP ${res.statusCode}`));
        return;
      }
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Automatic Cost Update from Web
app.post('/api/prices/update-auto', async (req, res) => {
  try {
    const apiData = await fetchLLMPrices();
    if (!apiData || !Array.isArray(apiData.prices)) {
      return res.status(500).json({ error: 'Formato de resposta inválido da API de preços.' });
    }

    const prices = readJSON(PRICES_FILE, DEFAULT_PRICES);
    const apiPrices = apiData.prices;
    const updatedModels = [];

    const DIRECT_MAPPINGS = {
      "Gemini 3.5 Flash (Medium)": "Gemini 3.5 Flash",
      "Gemini 3.5 Flash (High)": "Gemini 3.5 Flash",
      "Gemini 3.5 Flash (Low)": "Gemini 3.5 Flash",
      "Gemini 3.1 Pro (Low)": "Gemini 3.1 Pro",
      "Gemini 3.1 Pro (High)": "Gemini 3.1 Pro",
      "Claude Sonnet 4.6 (Thinking)": "Claude Sonnet 4.6",
      "Claude Opus 4.6 (Thinking)": "Claude Opus 4.6",
      "GPT-OSS 120B (Medium)": "GPT-OSS 120B"
    };

    function findBestMatch(modelName) {
      const directName = DIRECT_MAPPINGS[modelName];
      const searchName = (directName || modelName).toLowerCase().trim();
      
      // 1. Try exact name match
      let match = apiPrices.find(p => p.name.toLowerCase() === searchName || p.id.toLowerCase() === searchName);
      if (match) return match;
      
      // 2. Try substring match (e.g., "gemini 3.5 flash" in "gemini 3.5 flash preview")
      match = apiPrices.find(p => p.name.toLowerCase().includes(searchName) || searchName.includes(p.name.toLowerCase()));
      if (match) return match;
      
      // 3. Try token/word intersection matching
      const searchWords = searchName.split(/[\s\-._/]+/).filter(w => w.length > 1);
      let bestMatch = null;
      let bestScore = 0;
      
      apiPrices.forEach(p => {
        const apiWords = p.name.toLowerCase().split(/[\s\-._/]+/).filter(w => w.length > 1);
        const intersection = searchWords.filter(w => apiWords.includes(w));
        if (intersection.length > bestScore) {
          bestScore = intersection.length;
          bestMatch = p;
        }
      });
      
      if (bestScore >= 2) {
        return bestMatch;
      }
      return null;
    }

    Object.keys(prices).forEach(modelName => {
      const match = findBestMatch(modelName);
      if (match) {
        const oldInput = prices[modelName].input;
        const oldOutput = prices[modelName].output;
        const oldCached = prices[modelName].cached;

        const inputPrice = parseFloat(match.input);
        const outputPrice = parseFloat(match.output);
        const cachedPrice = match.input_cached !== null && match.input_cached !== undefined
          ? parseFloat(match.input_cached)
          : parseFloat((match.input * 0.25).toFixed(5));

        prices[modelName] = {
          input: inputPrice,
          output: outputPrice,
          cached: cachedPrice
        };

        if (oldInput !== inputPrice || oldOutput !== outputPrice || oldCached !== cachedPrice) {
          updatedModels.push({
            model: modelName,
            matchedAs: match.name,
            old: { input: oldInput, output: oldOutput, cached: oldCached },
            new: { input: inputPrice, output: outputPrice, cached: cachedPrice }
          });
        }
      }
    });

    writeJSON(PRICES_FILE, prices);
    res.json({ success: true, updatedCount: updatedModels.length, updates: updatedModels, prices });
  } catch (err) {
    console.error('Error updating prices automatically:', err);
    res.status(500).json({ error: 'Erro ao obter preços automaticamente da internet.', details: err.message });
  }
});

// Run Python script to scan conversations and merge with project configuration
app.get('/api/usage', (req, res) => {
  const projects = readJSON(PROJECTS_FILE, []);
  const prices = readJSON(PRICES_FILE, DEFAULT_PRICES);

  const pythonScript = path.join(__dirname, 'db_reader.py');
  
  exec(`python3 "${pythonScript}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Execution error: ${error}`);
      return res.status(500).json({ error: 'Failed to read database', details: stderr });
    }

    try {
      const dbStats = JSON.parse(stdout);
      
      // Auto-discover and register new models in prices.json
      let pricesUpdated = false;
      dbStats.forEach(conv => {
        if (conv.generations && Array.isArray(conv.generations)) {
          conv.generations.forEach(gen => {
            const modelName = gen.model;
            if (modelName && !prices[modelName]) {
              prices[modelName] = { input: 0.0, output: 0.0, cached: 0.0 };
              pricesUpdated = true;
            }
          });
        }
      });
      if (pricesUpdated) {
        writeJSON(PRICES_FILE, prices);
      }
      
      // We will match dbStats workspaces with configured projects.
      // A dbStat workspace has URI format: "file:///home/<user>/src/resumeai"
      // We will match it if the workspace path starts with the project path.
      
      const usageByProject = {};
      const unregisteredWorkspaces = new Set();
      
      // Initialize projects in our aggregation
      projects.forEach(p => {
        usageByProject[p.id] = {
          project: p,
          conversationsCount: 0,
          stepsCount: 0,
          inputTokens: 0,
          outputTokens: 0,
          cachedTokens: 0,
          cost: 0,
          conversations: []
        };
      });
      
      // General workspace / Other
      const otherKey = 'unregistered';
      usageByProject[otherKey] = {
        project: { id: 'unregistered', name: 'Outros / Sem Projeto Cadastrado', path: '' },
        conversationsCount: 0,
        stepsCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        cost: 0,
        conversations: []
      };

      dbStats.forEach(conv => {
        let matchedProjectId = null;
        let convWorkspacePath = conv.workspace.replace('file://', '');
        if (convWorkspacePath.endsWith('/') && convWorkspacePath.length > 1) {
          convWorkspacePath = convWorkspacePath.slice(0, -1);
        }

        // Find best match (longest matching project path)
        let bestMatchLength = -1;

        // Build list of candidate paths from workspace and referenced paths
        const candidatePaths = [convWorkspacePath];
        if (conv.referenced_paths && Array.isArray(conv.referenced_paths)) {
          conv.referenced_paths.forEach(refPath => {
            candidatePaths.push(refPath);
          });
        }

        projects.forEach(p => {
          candidatePaths.forEach(cPath => {
            if (cPath === p.path || cPath.startsWith(p.path + '/')) {
              if (p.path.length > bestMatchLength) {
                bestMatchLength = p.path.length;
                matchedProjectId = p.id;
              }
            }
          });
        });

        // Fallback: If no exact match is found, try matching by base folder name (basename)
        // to support multi-machine setups where absolute paths differ.
        if (!matchedProjectId) {
          projects.forEach(p => {
            const projectBasename = path.basename(p.path).toLowerCase();
            if (projectBasename) {
              candidatePaths.forEach(cPath => {
                const candidateBasename = path.basename(cPath).toLowerCase();
                if (candidateBasename === projectBasename) {
                  matchedProjectId = p.id;
                }
              });
            }
          });
        }

        const targetKey = matchedProjectId || otherKey;
        if (!matchedProjectId) {
          unregisteredWorkspaces.add(conv.workspace);
        }

        // Calculate cost for this conversation
        let convCost = 0;
        let convInput = 0;
        let convOutput = 0;
        let convCached = 0;

        conv.generations.forEach(gen => {
          const modelName = gen.model;
          // Find prices for this model, or fallback to Gemini 3.5 Flash default
          const modelPrice = prices[modelName] || prices["Gemini 3.5 Flash (Medium)"];
          
          const inCost = (gen.input_tokens / 1000000) * modelPrice.input;
          const outCost = (gen.output_tokens / 1000000) * modelPrice.output;
          const cachedCost = (gen.cached_tokens / 1000000) * modelPrice.cached;

          const stepCost = inCost + outCost + cachedCost;
          convCost += stepCost;
          convInput += gen.input_tokens;
          convOutput += gen.output_tokens;
          convCached += gen.cached_tokens;
        });

        // Add to project totals
        const group = usageByProject[targetKey];
        group.conversationsCount++;
        group.stepsCount += conv.generations.length;
        group.inputTokens += convInput;
        group.outputTokens += convOutput;
        group.cachedTokens += convCached;
        group.cost += convCost;
        
        group.conversations.push({
          conversation_id: conv.conversation_id,
          workspace: conv.workspace,
          start_time: conv.start_time,
          last_modified: conv.last_modified,
          steps_count: conv.generations.length,
          input_tokens: convInput,
          output_tokens: convOutput,
          cached_tokens: convCached,
          cost: convCost,
          generations: conv.generations
        });
      });

      // Filter other project group if empty
      if (usageByProject[otherKey].conversationsCount === 0) {
        delete usageByProject[otherKey];
      }

      res.json({
        byProject: usageByProject,
        unregisteredWorkspaces: Array.from(unregisteredWorkspaces),
        rawStats: dbStats
      });
    } catch (e) {
      console.error('Failed to aggregate usage stats:', e);
      res.status(500).json({ error: 'Failed to process database stats', details: e.message });
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  const ips = [];
  Object.keys(networkInterfaces).forEach(ifname => {
    networkInterfaces[ifname].forEach(iface => {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    });
  });

  console.log(`==================================================`);
  console.log(`WSL Token Monitor está rodando no WSL / Linux!`);
  console.log(`Acesse no Windows usando:`);
  console.log(`👉 http://localhost:${PORT}`);
  ips.forEach(ip => {
    console.log(`👉 http://${ip}:${PORT} (IP do WSL)`);
  });
  console.log(`==================================================`);
});
