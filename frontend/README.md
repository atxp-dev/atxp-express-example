# Frontend - ATXP Express Example

This is the React frontend for the ATXP Express example application.

## Dynamic Proxy Configuration

### The `configure-proxy.js` Script

This frontend includes a custom script (`configure-proxy.js`) that runs before the React development server starts. This script enables dynamic proxy configuration based on environment variables.

### Why This Approach?

**Problem**: React's built-in proxy configuration in `package.json` is static - it can't respond to environment variables at runtime. This made it impossible to run the application on configurable ports.

**Solutions Tried**:
1. **setupProxy.js with http-proxy-middleware** ❌ - Had compatibility issues with react-scripts 5.0.1
2. **Dynamic package.json modification** ✅ - Clean, reliable solution

### How It Works

1. **Before React starts**: The `configure-proxy.js` script executes
2. **Reads environment variable**: Gets `REACT_APP_BACKEND_PORT` (defaults to `3001`)
3. **Updates package.json**: Modifies the `"proxy"` field to point to the correct backend port
4. **React starts**: Development server launches with the correct proxy configuration

### Usage

```bash
# Default configuration (backend on port 3001)
npm start

# Custom backend port
REACT_APP_BACKEND_PORT=4001 npm start
```

### Technical Details

**Files involved**:
- `configure-proxy.js` - The configuration script
- `package.json` - Contains the start script and proxy configuration
- No additional dependencies required

**Script execution**:
```json
{
  "scripts": {
    "start": "node configure-proxy.js && react-scripts start"
  }
}
```

### Benefits of This Approach

1. **No additional dependencies** - Uses only Node.js built-ins
2. **Reliable** - Works with all versions of react-scripts
3. **Transparent** - Leverages React's native proxy support
4. **Simple** - Easy to understand and maintain
5. **Backwards compatible** - Defaults work without any configuration

### Alternative Approaches Considered

- **setupProxy.js**: Would be the "standard" approach, but had compatibility issues with our react-scripts version
- **Environment variable substitution**: Not supported by Create React App for the proxy field
- **Runtime proxy detection**: Would require more complex client-side logic

The current solution strikes the best balance between simplicity, reliability, and functionality.