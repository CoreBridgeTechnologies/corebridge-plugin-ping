# CoreBridge Ping Plugin

A network connectivity testing plugin for CoreBridge with PowerShell-based ping functionality and modern web interface.

## 🏓 Features

- **PowerShell Integration**: Uses PowerShell 7.4's `Test-Connection` cmdlet for reliable network testing
- **Modern Web GUI**: Clean, responsive interface with real-time ping results
- **Docker Containerized**: Fully containerized with multi-stage builds and security best practices
- **CoreBridge Integration**: Seamless integration with CoreBridge plugin management
- **Health Monitoring**: Built-in health checks and status reporting
- **Production Ready**: Non-root user, optimized container, graceful shutdown

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- CoreBridge core system running
- Port 3007 available

### Installation

1. **Clone and Build**:
```bash
git clone https://github.com/yourusername/corebridge-plugin-ping.git
cd corebridge-plugin-ping
npm install
```

2. **Build Docker Container**:
```bash
npm run docker:build
```

3. **Deploy with Docker Compose**:
```bash
npm run docker:compose:up
```

4. **Enable in CoreBridge**:
```bash
curl -X POST http://localhost:4001/api/plugins/corebridge-ping/enable
```

## 🌐 Usage

### Web Interface

Access the ping interface at: `http://localhost:3007`

- Enter domain name or IP address
- Click "Ping" to test connectivity
- View real-time results with response times
- Clear results with "Clear Results" button

### API Endpoints

#### Ping a Host
```bash
POST http://localhost:3007/api/ping
Content-Type: application/json

{
  "domain": "google.com"
}
```

**Response**:
```json
{
  "success": true,
  "domain": "google.com",
  "timestamp": "2024-01-01T12:00:00Z",
  "results": {
    "output": "Test-Connection output...",
    "success": true,
    "responseTime": "15ms"
  }
}
```

#### Health Check
```bash
GET http://localhost:3007/health
```

#### Plugin Status
```bash
GET http://localhost:3007/status
```

## 🐳 Docker Commands

```bash
# Build container
npm run docker:build

# Run standalone
npm run docker:run

# Deploy with compose
npm run docker:compose:up

# View logs
npm run docker:compose:logs

# Stop and remove
npm run docker:compose:down
```

## 🔧 Configuration

### Environment Variables

- `PORT`: Plugin port (default: 3007)
- `CORE_API_URL`: CoreBridge core API URL
- `NODE_ENV`: Environment (development/production)

### Plugin Manifest (`plugin.json`)

```json
{
  "id": "corebridge-ping",
  "name": "CoreBridge Ping",
  "description": "Network connectivity testing tool with PowerShell-based ping functionality",
  "version": "1.0.0",
  "port": 3007,
  "endpoints": {
    "health": "/health",
    "gui": "/",
    "ping": "/api/ping"
  }
}
```

## 🏗️ Architecture

### Container Architecture
- **Base Image**: Node.js 18 Alpine
- **PowerShell**: Version 7.4 for cross-platform compatibility
- **Multi-stage Build**: Optimized ~35MB container
- **Security**: Non-root user, minimal attack surface
- **Health Checks**: Built-in container health monitoring

### Network Communication
- **CoreBridge Integration**: Container-to-container via Docker network
- **Service Discovery**: Automatic plugin detection and registration
- **Health Monitoring**: Continuous status reporting to CoreBridge

## 🔒 Security

- Non-root container user (`pluginuser`)
- Minimal container image with only required dependencies
- Input validation for ping targets
- Rate limiting on API endpoints
- Secure container-to-container communication

## 📊 Monitoring

### Health Checks
- Container health check every 30 seconds
- Plugin status reporting to CoreBridge
- Automatic restart on failure

### Metrics
- Ping success/failure rates
- Response time statistics
- Request counts and error tracking
- Container resource usage

## 🛠️ Development

### Local Development
```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

### Building from Source
```bash
# Build production container
docker build -t corebridge-ping .

# Run with custom config
docker run -p 3007:3007 -e CORE_API_URL=http://your-core:4001 corebridge-ping
```

## 📚 API Reference

### POST /api/ping
Test network connectivity to a host.

**Request Body**:
```json
{
  "domain": "string" // Domain name or IP address
}
```

**Response**:
```json
{
  "success": boolean,
  "domain": "string",
  "timestamp": "ISO 8601 string",
  "results": {
    "output": "string",
    "success": boolean,
    "responseTime": "string"
  },
  "error": "string" // Only present on error
}
```

### GET /health
Plugin health status.

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "ISO 8601 string",
  "uptime": "number",
  "version": "string"
}
```

## 🔍 Troubleshooting

### Common Issues

1. **Plugin not discovered**:
   - Check CoreBridge core is running
   - Verify Docker network connectivity
   - Check plugin manifest format

2. **Ping failures**:
   - Verify PowerShell installation in container
   - Check network connectivity from container
   - Validate input domain/IP format

3. **Container won't start**:
   - Check port 3007 availability
   - Verify Docker network configuration
   - Check container logs: `docker logs corebridge-ping`

### Logs
```bash
# View container logs
docker logs corebridge-ping -f

# View compose logs
docker-compose logs -f
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes and add tests
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🔗 Related

- [CoreBridge Core](https://github.com/CoreBridgeTechnologies/coreBridge-Core)
- [Plugin Development Guide](https://github.com/CoreBridgeTechnologies/coreBridge-Core/blob/main/docs/plugin-system.md)
- [Docker Plugin Guide](https://github.com/CoreBridgeTechnologies/coreBridge-Core/blob/main/docs/docker-plugin-guide.md) 