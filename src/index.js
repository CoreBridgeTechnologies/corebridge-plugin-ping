const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3007;
const PLUGIN_ID = 'corebridge-ping';
const PLUGIN_VERSION = '1.0.0';

// Core API configuration (container to container)
const CORE_API_BASE = process.env.CORE_API_URL || 'http://corebridge-core:4001';

// Plugin state tracking
const pluginState = {
  healthy: true,
  startTime: Date.now(),
  pingHistory: [],
  requestCount: 0,
  errorCount: 0
};

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
            Version: <span>1.0.0</span>
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
  
  // Register with core system
  await registerWithCore();
  
  // Set up periodic health updates
  setInterval(async () => {
    const healthData = {
      timestamp: new Date().toISOString(),
      requestCount: pluginState.requestCount,
      errorCount: pluginState.errorCount,
      pingCount: pluginState.pingHistory.length
    };
    
    await notifyCore(healthData);
  }, 30000); // Every 30 seconds
}); 