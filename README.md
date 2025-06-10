# CoreBridge Ping Plugin

**Commercial Plugin** - Licensed network connectivity testing with PowerShell-based ping functionality.

## Overview

The CoreBridge Ping Plugin is a commercial plugin that provides network connectivity testing capabilities with a modern web interface and PowerShell-based ping functionality.

As a **commercial plugin**, this requires a valid license to operate and demonstrates the licensing integration patterns for the CoreBridge platform.

## Features

### 🏓 Network Testing
- **PowerShell Integration**: Uses PowerShell 7.4's `Test-Connection` cmdlet for reliable network testing
- **Modern Web GUI**: Clean, responsive interface with real-time ping results
- **Multiple Test Targets**: Support for domain names, IPv4, and IPv6 addresses
- **Response Time Metrics**: Detailed ping statistics and performance monitoring

### 🔐 License Integration
- **License Validation**: Real-time license verification with License Manager
- **Grace Period**: Configurable grace period for license validation failures
- **Usage Tracking**: Comprehensive license usage monitoring and audit trails
- **Automatic Revocation**: Instant license revocation detection and enforcement

### 🔧 CoreBridge Integration
- **Auto-discovery**: Automatic plugin detection and registration
- **Health Monitoring**: Built-in health checks and status reporting
- **Docker Ready**: Fully containerized with multi-stage builds and security best practices
- **Production Ready**: Non-root user, optimized container, graceful shutdown

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 CoreBridge Ping Plugin                      │
├─────────────────┬─────────────────┬─────────────────────────┤
│  License Manager│  Ping Service   │      Web Interface      │
│  - Validation   │  - PowerShell   │      - Modern GUI       │
│  - Periodic     │  - Connectivity │      - Real-time        │
│  - Revocation   │  - Metrics      │      - Responsive       │
└─────────────────┴─────────────────┴─────────────────────────┘
           │                 │                       │
           ▼                 ▼                       ▼
    ┌─────────────┐  ┌─────────────┐        ┌─────────────┐
    │ License     │  │ PowerShell  │        │  Web Assets │
    │ Manager API │  │ Test-Conn   │        │  & Frontend │
    └─────────────┘  └─────────────┘        └─────────────┘
```

## Quick Start

### Prerequisites

- Docker and Docker Compose
- CoreBridge core system running
- License Manager plugin running
- Valid license key
- Port 3007 available

### Installation

1. **Navigate to plugin directory:**
```bash
cd plugins/corebridge-ping
```

2. **Install dependencies:**
```bash
npm install
```

3. **Build Docker container:**
```bash
npm run docker:build
```

4. **Deploy with Docker Compose:**
```bash
npm run docker:compose:up
```

5. **Configure license:**
```bash
curl -X POST http://localhost:3007/api/license/configure \
  -H "Content-Type: application/json" \
  -d '{"licenseKey":"CB-XXXX-XXXX-XXXX-XXXX"}'
```

6. **Enable in CoreBridge:**
```bash
curl -X POST http://localhost:4001/api/plugins/corebridge-ping/enable
```

### Verification

Check plugin health and license status:

```bash
# Plugin health check
curl http://localhost:3007/health

# License status
curl http://localhost:3007/api/license/status

# Check CoreBridge registration
curl http://localhost:4001/api/plugins/corebridge-ping
```

## Usage

### Web Interface

Access the ping interface at: `http://localhost:3007`

**Features:**
- Enter domain name or IP address
- Click "Ping" to test connectivity
- View real-time results with response times
- Clear results with "Clear Results" button
- License status indicator

### API Endpoints

#### License Management

##### GET /api/license/status
Check current license status.

**Response:**
```json
{
  "licensed": true,
  "status": "active",
  "validUntil": "2025-12-31T23:59:59.000Z",
  "features": ["basic", "advanced"],
  "machineId": "hostname-platform",
  "lastValidation": "2025-01-10T12:00:00.000Z"
}
```

##### POST /api/license/configure
Configure plugin license.

**Request:**
```json
{
  "licenseKey": "CB-6049-4392-892E-F67B-CDE8"
}
```

**Response:**
```json
{
  "success": true,
  "message": "License configured successfully",
  "validation": {
    "valid": true,
    "status": "active"
  }
}
```

#### Ping Functionality

##### POST /api/ping
Test network connectivity (requires valid license).

**Request:**
```json
{
  "domain": "google.com"
}
```

**Response:**
```json
{
  "success": true,
  "domain": "google.com",
  "timestamp": "2025-01-10T12:00:00.000Z",
  "licensed": true,
  "results": {
    "output": "Test-Connection output...",
    "success": true,
    "responseTime": "15ms",
    "packetLoss": 0
  }
}
```

##### GET /health
Plugin health check (always available).

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-10T12:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "service": "CoreBridge Ping Plugin",
  "licensed": true,
  "licensing": { "required": true, "type": "commercial" }
}
```

## License Management

### License States

| State | Description | Plugin Behavior |
|-------|-------------|------------------|
| `active` | Valid and operational | Full ping functionality |
| `required` | No license configured | Limited functionality, prompts for license |
| `invalid` | Validation failed | Basic health only, ping disabled |
| `expired` | Past expiration date | Grace period, then disabled |
| `revoked` | Administratively revoked | Immediate shutdown |

### License Configuration

```bash
# Check license status
curl http://localhost:3007/api/license/status

# Configure license key
curl -X POST http://localhost:3007/api/license/configure \
  -H "Content-Type: application/json" \
  -d '{
    "licenseKey": "CB-6049-4392-892E-F67B-CDE8"
  }'

# Test ping functionality (requires license)
curl -X POST http://localhost:3007/api/ping \
  -H "Content-Type: application/json" \
  -d '{"domain": "google.com"}'
```

## Configuration

### Environment Variables

```bash
# Plugin Configuration
PORT=3007
NODE_ENV=production
LOG_LEVEL=info

# License Management
LICENSE_MANAGER_URL=http://corebridge-license-manager:3008
LICENSE_VALIDATION_INTERVAL=3600000
LICENSE_GRACE_PERIOD=86400000

# Core Integration
COREBRIDGE_API_URL=http://corebridge-core:4001
COREBRIDGE_TIMEOUT=30000

# PowerShell Configuration
POWERSHELL_TIMEOUT=30000
MAX_PING_COUNT=4
```

### Plugin Manifest

```json
{
  "id": "corebridge-ping",
  "name": "CoreBridge Ping",
  "description": "Network connectivity testing tool with licensing integration",
  "version": "1.0.0",
  "port": 3007,
  "category": "utilities",
  "tags": ["networking", "ping", "connectivity", "commercial"],
  
  "licensing": {
    "required": true,
    "type": "commercial",
    "features": ["basic", "advanced"],
    "validation": {
      "periodic": true,
      "interval": 3600000,
      "gracePeriod": 86400000
    }
  },
  
  "endpoints": {
    "health": "/health",
    "gui": "/",
    "ping": "/api/ping",
    "license": "/api/license/status"
  }
}
```

## Deployment

### Docker Deployment

The plugin includes full Docker support with license integration:

```bash
# Build container
npm run docker:build

# Deploy with Docker Compose
npm run docker:compose:up

# View logs
npm run docker:logs

# Stop deployment
npm run docker:compose:down
```

### Docker Compose Configuration

```yaml
version: '3.8'
services:
  corebridge-ping:
    build: .
    ports:
      - "3007:3007"
    environment:
      - PORT=3007
      - LICENSE_MANAGER_URL=http://corebridge-license-manager:3008
      - COREBRIDGE_API_URL=http://corebridge-core:4001
    networks:
      - corebridge
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3007/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    depends_on:
      - corebridge-license-manager

networks:
  corebridge:
    external: true
```

## Security

### Container Security
- Non-root container user (`pluginuser`)
- Minimal container image with only required dependencies
- Multi-stage build for optimized ~35MB container
- Secure container-to-container communication

### License Security
- Encrypted license validation communication
- Machine-bound license keys
- Secure license key storage
- Audit trail for license usage

### Input Validation
- Sanitized ping target inputs
- Rate limiting on API endpoints
- Protected license configuration endpoints
- Secure PowerShell command execution

## Monitoring & Alerting

### Health Monitoring
- Container health check every 30 seconds
- Plugin status reporting to CoreBridge
- License validation status monitoring
- Automatic restart on failure

### Metrics
- Ping success/failure rates
- Response time statistics
- License validation attempts
- Request counts and error tracking
- Container resource usage

### Alerting
- License expiration warnings
- License validation failures
- Ping service failures
- System resource alerts

## Troubleshooting

### Common Issues

#### License Issues
```bash
# Check license status
curl http://localhost:3007/api/license/status

# Verify License Manager connectivity
curl http://localhost:3008/health

# Test license configuration
curl -X POST http://localhost:3007/api/license/configure \
  -H "Content-Type: application/json" \
  -d '{"licenseKey":"YOUR_LICENSE_KEY"}'
```

#### Ping Functionality Issues
```bash
# Test plugin health
curl http://localhost:3007/health

# Check PowerShell availability
docker exec corebridge-ping pwsh -Command "Test-Connection google.com -Count 1"

# Verify network connectivity
docker exec corebridge-ping ping -c 1 8.8.8.8
```

#### Container Issues
```bash
# Check container logs
docker logs corebridge-ping

# Verify container health
docker ps --filter name=corebridge-ping

# Restart container
docker restart corebridge-ping
```

## Development

### Local Development

```bash
# Install dependencies
npm install

# Run in development mode (without Docker)
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

# Run with custom configuration
docker run -p 3007:3007 \
  -e LICENSE_MANAGER_URL=http://your-license-manager:3008 \
  corebridge-ping
```

### Plugin Development

This plugin demonstrates commercial plugin best practices:

- **License Integration**: Comprehensive license management
- **Protected Routes**: License-based access control
- **Graceful Degradation**: Handling license failures
- **User Communication**: Clear license status messaging
- **Security**: Secure license validation and storage

## Related Documentation

- **[Plugin System Documentation](../../docs/plugin-system.md)** - Complete plugin development guide
- **[Licensing System Documentation](../../docs/licensing-system.md)** - Licensing integration guide
- **[License Manager Plugin](../corebridge-license-manager/README.md)** - License management details
- **[CoreBridge Core Documentation](../../README.md)** - Main system documentation
- **[Troubleshooting Guide](../../docs/troubleshooting.md)** - Common issues and solutions

## Support

For support and development assistance:

### Plugin Health
```bash
# Check plugin health
curl http://localhost:3007/health

# View license status
curl http://localhost:3007/api/license/status

# Test ping functionality
curl -X POST http://localhost:3007/api/ping \
  -H "Content-Type: application/json" \
  -d '{"domain":"google.com"}'
```

### Licensing Support
- **License Configuration**: Use `/api/license/configure` endpoint
- **License Status**: Monitor via `/api/license/status` endpoint
- **License Manager**: Ensure License Manager plugin is running
- **Connectivity**: Verify network connectivity to License Manager

The CoreBridge Ping Plugin demonstrates comprehensive commercial plugin functionality with full license integration, serving as both a practical network testing tool and a reference implementation for commercial plugin development. 