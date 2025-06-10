const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3007;
const PLUGIN_ID = 'corebridge-ping';
const PLUGIN_VERSION = '1.0.0';

// Core API configuration (container to container)
const CORE_API_BASE = process.env.CORE_API_URL || 'http://corebridge-core:4001';

// License Manager configuration
const LICENSE_MANAGER_URL = process.env.LICENSE_MANAGER_URL || 'http://corebridge-license-manager:3008';
const CONFIG_FILE = path.join(__dirname, '../config.json');

// Plugin state tracking
const pluginState = {
  healthy: true,
  startTime: Date.now(),
  pingHistory: [],
  requestCount: 0,
  errorCount: 0,
  licenseValid: false,
  licenseKey: null,
  licenseStatus: 'unknown',
  lastLicenseCheck: null
};

// Configuration management
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return config;
    }
  } catch (error) {
    console.error('Failed to load config:', error.message);
  }
  return {};
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to save config:', error.message);
    return false;
  }
}

// License validation functions
async function validateLicense(licenseKey = null) {
  const keyToValidate = licenseKey || pluginState.licenseKey;
  
  if (!keyToValidate) {
    console.log('No license key available for validation');
    return { valid: false, message: 'No license key provided' };
  }

  try {
    console.log(`Validating license for plugin: ${PLUGIN_ID}`);
    
    const response = await axios.post(`${LICENSE_MANAGER_URL}/api/licenses/validate`, {
      licenseKey: keyToValidate,
      pluginId: PLUGIN_ID,
      machineId: getMachineId()
    }, {
      timeout: 10000
    });

    const result = response.data;
    pluginState.lastLicenseCheck = new Date().toISOString();
    
    if (result.valid) {
      pluginState.licenseValid = true;
      pluginState.licenseKey = keyToValidate;
      pluginState.licenseStatus = 'valid';
      console.log('✅ License validation successful');
      
      // Save license key to config
      const config = loadConfig();
      config.licenseKey = keyToValidate;
      saveConfig(config);
      
      return { valid: true, data: result };
    } else {
      pluginState.licenseValid = false;
      pluginState.licenseStatus = result.message || 'invalid';
      console.log(`❌ License validation failed: ${result.message}`);
      return { valid: false, message: result.message };
    }
    
  } catch (error) {
    console.error('License validation error:', error.message);
    pluginState.licenseValid = false;
    pluginState.licenseStatus = 'validation_error';
    pluginState.lastLicenseCheck = new Date().toISOString();
    return { valid: false, message: 'License validation failed: ' + error.message };
  }
}

function getMachineId() {
  // Generate a simple machine ID based on hostname and some system info
  const os = require('os');
  const hostname = os.hostname();
  const platform = os.platform();
  return `${hostname}-${platform}`;
}

async function promptForLicense() {
  console.log('\n' + '='.repeat(60));
  console.log('🔑 LICENSE REQUIRED');
  console.log('='.repeat(60));
  console.log(`Plugin: ${PLUGIN_ID}`);
  console.log(`Machine ID: ${getMachineId()}`);
  console.log('');
  console.log('This plugin requires a valid license to operate.');
  console.log('Please obtain a license from your CoreBridge administrator.');
  console.log('');
  console.log('You can also access the license manager at:');
  console.log(`${LICENSE_MANAGER_URL.replace('corebridge-license-manager', 'localhost')}`);
  console.log('');
  console.log('To add a license key, use the web interface or send a POST request to:');
  console.log(`POST http://localhost:${PORT}/api/license/configure`);
  console.log('Body: {"licenseKey": "YOUR-LICENSE-KEY"}');
  console.log('='.repeat(60));
  
  // Set plugin to unhealthy until license is provided
  pluginState.healthy = false;
  pluginState.licenseStatus = 'required';
}

// Initialize license on startup
async function initializeLicense() {
  console.log('Initializing license validation...');
  
  // Try to load license from config
  const config = loadConfig();
  if (config.licenseKey) {
    console.log('Found license key in configuration');
    const validation = await validateLicense(config.licenseKey);
    if (validation.valid) {
      console.log('✅ License loaded and validated successfully');
      pluginState.healthy = true;
      return true;
    }
  }
  
  // No valid license found
  await promptForLicense();
  return false;
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Logging middleware
app.use((req, res, next) => {
  pluginState.requestCount++;
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  pluginState.errorCount++;
  console.error(`Error: ${err.message}`);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error',
    message: err.message 
  });
});

// License checking middleware for protected routes
function requireLicense(req, res, next) {
  // Skip license check for certain routes
  const skipLicenseRoutes = ['/health', '/status', '/api/license/configure', '/api/license/status', '/'];
  
  if (skipLicenseRoutes.includes(req.path)) {
    return next();
  }

  if (!pluginState.licenseValid) {
    return res.status(403).json({
      success: false,
      error: 'License required',
      message: 'This plugin requires a valid license to operate',
      licenseStatus: pluginState.licenseStatus,
      configurationEndpoint: `/api/license/configure`
    });
  }

  next();
}

// Apply license middleware to protected routes
app.use('/api/ping', requireLicense);

// License management endpoints
app.post('/api/license/configure', async (req, res) => {
  try {
    const { licenseKey } = req.body;
    
    if (!licenseKey) {
      return res.status(400).json({
        success: false,
        error: 'License key is required'
      });
    }

    console.log('Configuring new license key...');
    const validation = await validateLicense(licenseKey);
    
    if (validation.valid) {
      pluginState.healthy = true;
      res.json({
        success: true,
        message: 'License configured successfully',
        licenseStatus: 'valid',
        pluginStatus: 'healthy'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid license key',
        message: validation.message
      });
    }
    
  } catch (error) {
    console.error('License configuration error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to configure license',
      message: error.message
    });
  }
});

app.get('/api/license/status', (req, res) => {
  res.json({
    licenseValid: pluginState.licenseValid,
    licenseStatus: pluginState.licenseStatus,
    lastCheck: pluginState.lastLicenseCheck,
    machineId: getMachineId(),
    pluginId: PLUGIN_ID,
    hasLicenseKey: !!pluginState.licenseKey
  });
});

// GUI Routes - Serve HTML interface
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CoreBridge Ping Tool</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        
        .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 15px 35px rgba(0,0,0,0.1);
            padding: 40px;
            width: 100%;
            max-width: 600px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .header h1 {
            color: #333;
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        
        .header p {
            color: #666;
            font-size: 1.1em;
        }
        
        .ping-form {
            display: flex;
            flex-direction: column;
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .form-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        label {
            font-weight: 600;
            color: #333;
            font-size: 1.1em;
        }
        
        input[type="text"] {
            padding: 15px;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            font-size: 1.1em;
            transition: border-color 0.3s ease;
        }
        
        input[type="text"]:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        .button-group {
            display: flex;
            gap: 15px;
        }
        
        button {
            padding: 15px 25px;
            border: none;
            border-radius: 8px;
            font-size: 1.1em;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            flex: 1;
        }
        
        .ping-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        
        .ping-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
        }
        
        .ping-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        
        .clear-btn {
            background: #f8f9fa;
            color: #666;
            border: 2px solid #e1e5e9;
        }
        
        .clear-btn:hover {
            background: #e9ecef;
            border-color: #adb5bd;
        }
        
        .results {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            min-height: 200px;
            max-height: 400px;
            overflow-y: auto;
            border: 1px solid #e1e5e9;
        }
        
        .results h3 {
            color: #333;
            margin-bottom: 15px;
            font-size: 1.2em;
        }
        
        .ping-result {
            background: white;
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 10px;
            border-left: 4px solid #28a745;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        
        .ping-result.error {
            border-left-color: #dc3545;
        }
        
        .ping-result .timestamp {
            font-size: 0.9em;
            color: #666;
            margin-bottom: 5px;
        }
        
        .ping-result .domain {
            font-weight: 600;
            color: #333;
            margin-bottom: 5px;
        }
        
        .ping-result .output {
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            color: #495057;
            white-space: pre-wrap;
            background: #f1f3f4;
            padding: 10px;
            border-radius: 4px;
            margin-top: 8px;
            max-height: 150px;
            overflow-y: auto;
        }
        
        .loading {
            display: none;
            text-align: center;
            padding: 20px;
            color: #667eea;
        }
        
        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
            margin: 0 auto 10px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .empty-state {
            text-align: center;
            color: #6c757d;
            font-style: italic;
            padding: 40px 20px;
        }
        
        .status-bar {
            background: #e9ecef;
            padding: 10px 15px;
            border-radius: 6px;
            margin-bottom: 20px;
            font-size: 0.9em;
            color: #495057;
        }
        
        .success { color: #28a745; }
        .error { color: #dc3545; }
        
        /* License Section Styles */
        .license-section {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }
        
        .license-warning h3 {
            color: #856404;
            margin-bottom: 10px;
        }
        
        .license-warning p {
            color: #856404;
            margin-bottom: 15px;
        }
        
        .license-form {
            display: flex;
            gap: 10px;
            align-items: flex-end;
        }
        
        .license-form .form-group {
            flex: 1;
            display: flex;
            gap: 10px;
        }
        
        .license-form input {
            flex: 1;
        }
        
        .license-btn {
            background: #856404;
            color: white;
            padding: 15px 20px;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        
        .license-btn:hover {
            background: #6f5404;
        }
        
        .license-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        
        #licenseResult {
            margin-top: 15px;
            padding: 10px;
            border-radius: 4px;
            display: none;
        }
        
        #licenseResult.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        
        #licenseResult.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        
        .loading { color: #ffc107; }
        .warning { color: #fd7e14; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏓 CoreBridge Ping</h1>
            <p>Network connectivity testing tool</p>
        </div>
        
        <div class="status-bar">
            Plugin Status: <span class="success">Running</span> | 
            Port: <span>3007</span> | 
            Version: <span>1.0.0</span> |
            License: <span id="licenseStatus" class="loading">Checking...</span>
        </div>
        
        <!-- License Configuration Section -->
        <div id="licenseSection" class="license-section" style="display: none;">
            <div class="license-warning">
                <h3>🔑 License Required</h3>
                <p>This plugin requires a valid license to operate. Please enter your license key below:</p>
                <form id="licenseForm" class="license-form">
                    <div class="form-group">
                        <input 
                            type="text" 
                            id="licenseKey" 
                            placeholder="Enter your license key (e.g., CB-XXXX-XXXX-XXXX-XXXX)"
                            required
                            autocomplete="off"
                        >
                        <button type="submit" class="license-btn">Configure License</button>
                    </div>
                </form>
                <div id="licenseResult"></div>
            </div>
        </div>
        
        <form class="ping-form" id="pingForm">
            <div class="form-group">
                <label for="domain">Domain or IP Address:</label>
                <input 
                    type="text" 
                    id="domain" 
                    name="domain" 
                    placeholder="Enter domain (e.g., google.com, 8.8.8.8)" 
                    required
                    autocomplete="off"
                >
            </div>
            
            <div class="button-group">
                <button type="submit" class="ping-btn" id="pingBtn">
                    🏓 Ping Domain
                </button>
                <button type="button" class="clear-btn" id="clearBtn">
                    🗑️ Clear Results
                </button>
            </div>
        </form>
        
        <div class="loading" id="loading">
            <div class="spinner"></div>
            <div>Pinging domain...</div>
        </div>
        
        <div class="results">
            <h3>📊 Ping Results</h3>
            <div id="results">
                <div class="empty-state">
                    No ping results yet. Enter a domain above and click "Ping Domain" to get started.
                </div>
            </div>
        </div>
    </div>

    <script>
        const pingForm = document.getElementById('pingForm');
        const domainInput = document.getElementById('domain');
        const pingBtn = document.getElementById('pingBtn');
        const clearBtn = document.getElementById('clearBtn');
        const loading = document.getElementById('loading');
        const results = document.getElementById('results');
        const licenseForm = document.getElementById('licenseForm');
        const licenseSection = document.getElementById('licenseSection');
        const licenseStatus = document.getElementById('licenseStatus');
        const licenseResult = document.getElementById('licenseResult');

        // Check license status on page load
        async function checkLicenseStatus() {
            try {
                const response = await fetch('/api/license/status');
                const data = await response.json();
                
                updateLicenseDisplay(data);
                
                if (!data.licenseValid) {
                    showLicenseSection();
                }
                
            } catch (error) {
                console.error('Failed to check license status:', error);
                licenseStatus.textContent = 'Error';
                licenseStatus.className = 'error';
                showLicenseSection();
            }
        }
        
        function updateLicenseDisplay(data) {
            if (data.licenseValid) {
                licenseStatus.textContent = 'Valid';
                licenseStatus.className = 'success';
                hideLicenseSection();
            } else {
                licenseStatus.textContent = data.licenseStatus || 'Invalid';
                licenseStatus.className = data.licenseStatus === 'required' ? 'warning' : 'error';
            }
        }
        
        function showLicenseSection() {
            licenseSection.style.display = 'block';
            pingForm.style.display = 'none';
        }
        
        function hideLicenseSection() {
            licenseSection.style.display = 'none';
            pingForm.style.display = 'block';
        }
        
        // Handle license form submission
        licenseForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const licenseKey = document.getElementById('licenseKey').value.trim();
            if (!licenseKey) return;
            
            const submitBtn = licenseForm.querySelector('.license-btn');
            const originalText = submitBtn.textContent;
            
            submitBtn.disabled = true;
            submitBtn.textContent = 'Configuring...';
            licenseResult.style.display = 'none';
            
            try {
                const response = await fetch('/api/license/configure', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ licenseKey })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    licenseResult.textContent = '✅ License configured successfully!';
                    licenseResult.className = 'success';
                    licenseResult.style.display = 'block';
                    
                    // Update license status
                    licenseStatus.textContent = 'Valid';
                    licenseStatus.className = 'success';
                    
                    // Hide license section and show ping form
                    setTimeout(() => {
                        hideLicenseSection();
                    }, 2000);
                    
                } else {
                    licenseResult.textContent = '❌ ' + (data.message || 'Failed to configure license');
                    licenseResult.className = 'error';
                    licenseResult.style.display = 'block';
                }
                
            } catch (error) {
                console.error('License configuration error:', error);
                licenseResult.textContent = '❌ Network error: ' + error.message;
                licenseResult.className = 'error';
                licenseResult.style.display = 'block';
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
        
        // Initialize license check
        checkLicenseStatus();

        // Handle form submission
        pingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const domain = domainInput.value.trim();
            if (!domain) return;

            // Show loading state
            pingBtn.disabled = true;
            loading.style.display = 'block';
            
            try {
                const response = await fetch('/api/ping', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ domain })
                });

                const data = await response.json();
                
                // Add result to display
                addPingResult(domain, data);
                
            } catch (error) {
                console.error('Error:', error);
                addPingResult(domain, {
                    success: false,
                    error: 'Failed to connect to ping service',
                    output: error.message
                });
            } finally {
                // Hide loading state
                pingBtn.disabled = false;
                loading.style.display = 'none';
            }
        });

        // Handle clear button
        clearBtn.addEventListener('click', () => {
            results.innerHTML = '<div class="empty-state">No ping results yet. Enter a domain above and click "Ping Domain" to get started.</div>';
        });

        // Add ping result to display
        function addPingResult(domain, data) {
            // Remove empty state if present
            const emptyState = results.querySelector('.empty-state');
            if (emptyState) {
                emptyState.remove();
            }

            const resultDiv = document.createElement('div');
            resultDiv.className = \`ping-result \${data.success ? '' : 'error'}\`;
            
            const timestamp = new Date().toLocaleString();
            const status = data.success ? '✅ Success' : '❌ Failed';
            
            resultDiv.innerHTML = \`
                <div class="timestamp">\${timestamp} - \${status}</div>
                <div class="domain">🌐 \${domain}</div>
                \${data.output ? \`<div class="output">\${data.output}</div>\` : ''}
                \${data.error ? \`<div class="output error">Error: \${data.error}</div>\` : ''}
            \`;
            
            // Add to top of results
            results.insertBefore(resultDiv, results.firstChild);
        }

        // Auto-focus domain input
        domainInput.focus();
        
        // Handle enter key on domain input
        domainInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                pingForm.dispatchEvent(new Event('submit'));
            }
        });
    </script>
</body>
</html>
  `);
});

// API Routes

// Health check endpoint (required)
app.get('/health', (req, res) => {
  const healthStatus = {
    status: pluginState.healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - pluginState.startTime) / 1000),
    version: PLUGIN_VERSION,
    service: 'CoreBridge Ping',
    checks: {
      uptime: Date.now() - pluginState.startTime > 0,
      memory: process.memoryUsage().heapUsed < 100 * 1024 * 1024, // 100MB limit
      responsive: true,
      powershell: true // We'll assume PowerShell is available if container started
    }
  };

  const isHealthy = Object.values(healthStatus.checks).every(check => check);
  pluginState.healthy = isHealthy;

  res.status(isHealthy ? 200 : 503).json(healthStatus);
});

// Status endpoint
app.get('/status', (req, res) => {
  res.json({
    plugin: {
      id: PLUGIN_ID,
      name: 'CoreBridge Ping',
      version: PLUGIN_VERSION,
      uptime: Math.floor((Date.now() - pluginState.startTime) / 1000),
      healthy: pluginState.healthy
    },
    statistics: {
      totalRequests: pluginState.requestCount,
      totalErrors: pluginState.errorCount,
      totalPings: pluginState.pingHistory.length,
      successfulPings: pluginState.pingHistory.filter(p => p.success).length,
      errorRate: pluginState.requestCount > 0 ? (pluginState.errorCount / pluginState.requestCount) : 0
    },
    recentPings: pluginState.pingHistory.slice(-10) // Last 10 pings
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  const memoryUsage = process.memoryUsage();
  
  res.json({
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - pluginState.startTime) / 1000),
    memory: {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external
    },
    requests: {
      total: pluginState.requestCount,
      errors: pluginState.errorCount
    },
    pings: {
      total: pluginState.pingHistory.length,
      successful: pluginState.pingHistory.filter(p => p.success).length,
      failed: pluginState.pingHistory.filter(p => !p.success).length
    }
  });
});

// Ping API endpoint
app.post('/api/ping', async (req, res) => {
  try {
    const { domain } = req.body;
    
    if (!domain) {
      return res.status(400).json({
        success: false,
        error: 'Domain is required'
      });
    }

    // Validate domain/IP format (basic validation)
    const domainRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$|^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (!domainRegex.test(domain)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid domain or IP address format'
      });
    }

    console.log(`Pinging domain: ${domain}`);
    
    // Execute PowerShell ping command
    const pingResult = await executePing(domain);
    
    // Store in ping history
    const pingRecord = {
      domain,
      timestamp: new Date().toISOString(),
      success: pingResult.success,
      output: pingResult.output,
      error: pingResult.error
    };
    
    pluginState.pingHistory.push(pingRecord);
    
    // Keep only last 100 ping records
    if (pluginState.pingHistory.length > 100) {
      pluginState.pingHistory = pluginState.pingHistory.slice(-100);
    }

    res.json(pingResult);
    
  } catch (error) {
    console.error('Ping API error:', error);
    pluginState.errorCount++;
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// PowerShell ping execution function
function executePing(domain) {
  return new Promise((resolve) => {
    // PowerShell command to ping with 4 packets
    const command = `pwsh -Command "Test-Connection -ComputerName '${domain}' -Count 4 -Quiet; Test-Connection -ComputerName '${domain}' -Count 4"`;
    
    const startTime = Date.now();
    
    exec(command, { timeout: 15000 }, (error, stdout, stderr) => {
      const duration = Date.now() - startTime;
      
      if (error) {
        console.error(`Ping error for ${domain}:`, error.message);
        resolve({
          success: false,
          error: error.message,
          output: stderr || error.message,
          duration
        });
        return;
      }

      // Parse PowerShell output
      const output = stdout.trim();
      const success = !output.toLowerCase().includes('false') && 
                     !output.toLowerCase().includes('failed') && 
                     output.length > 0;

      resolve({
        success,
        output: output || 'Ping completed',
        duration
      });
    });
  });
}

// Core API communication functions
async function notifyCore(data) {
  try {
    await axios.post(`${CORE_API_BASE}/api/health/update`, {
      pluginId: PLUGIN_ID,
      status: pluginState.healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      metrics: data
    });
    console.log('Successfully notified core system');
  } catch (error) {
    console.error('Failed to notify core system:', error.message);
  }
}

async function registerWithCore() {
  try {
    await axios.post(`${CORE_API_BASE}/api/plugins/register`, {
      pluginId: PLUGIN_ID,
      name: 'CoreBridge Ping',
      version: PLUGIN_VERSION,
      port: PORT
    });
    console.log('Successfully registered with core system');
  } catch (error) {
    console.log('Failed to register with core system (this is normal):', error.message);
  }
}

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Start the server
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`CoreBridge Ping Plugin running on port ${PORT}`);
  console.log(`GUI available at: http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  
  // Initialize license validation
  await initializeLicense();
  
  // Register with core system
  await registerWithCore();
  
  // Set up periodic health updates
  setInterval(async () => {
    const healthData = {
      timestamp: new Date().toISOString(),
      requestCount: pluginState.requestCount,
      errorCount: pluginState.errorCount,
      pingCount: pluginState.pingHistory.length,
      licenseValid: pluginState.licenseValid,
      licenseStatus: pluginState.licenseStatus
    };
    
    await notifyCore(healthData);
  }, 30000); // Every 30 seconds
  
  // Set up periodic license validation (every 1 hour)
  setInterval(async () => {
    if (pluginState.licenseKey) {
      console.log('Performing periodic license validation...');
      await validateLicense();
    }
  }, 3600000); // Every hour
}); 