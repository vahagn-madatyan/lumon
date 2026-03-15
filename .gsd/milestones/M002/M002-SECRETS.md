# Secrets Manifest

**Milestone:** M002
**Generated:** 2026-03-15

### N8N_BASE_URL

**Service:** n8n (self-hosted or local instance)
**Dashboard:** http://localhost:5678/settings
**Format hint:** `http://localhost:5678` or `https://your-n8n.example.com`
**Status:** collected
**Destination:** dotenv

1. Start your local n8n instance (`npx n8n` or Docker)
2. Open Settings at http://localhost:5678/settings
3. Copy the base URL (typically `http://localhost:5678`)

### N8N_API_KEY

**Service:** n8n REST API
**Dashboard:** http://localhost:5678/settings/api
**Format hint:** Starts with `n8n_api_` followed by alphanumeric string
**Status:** collected
**Destination:** dotenv

1. Open your n8n instance at http://localhost:5678
2. Navigate to Settings → API → API Keys
3. Click "Create an API key"
4. Give it a descriptive name (e.g., "Lumon Bridge")
5. Copy the generated API key

### DOMAINR_API_KEY

**Service:** Domainr (domain availability API via RapidAPI)
**Dashboard:** https://rapidapi.com/domainr/api/domainr
**Format hint:** Alphanumeric RapidAPI key, ~50 chars
**Status:** collected
**Destination:** dotenv

1. Sign up or log in at https://rapidapi.com
2. Subscribe to the Domainr API (free tier available)
3. Navigate to the API dashboard
4. Copy your RapidAPI key from the "X-RapidAPI-Key" header value

### MARKER_API_KEY

**Service:** Marker API (USPTO trademark search)
**Dashboard:** https://markerapi.com/account
**Format hint:** Alphanumeric API key
**Status:** collected
**Destination:** dotenv

1. Sign up at https://markerapi.com
2. Navigate to Account → API Key
3. Copy your API key
