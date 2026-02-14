# System Architecture

## Overview
High-level architecture of the MapViewer platform.

```mermaid
graph TD
    subgraph External_World ["External World"]
        User["End User"]
        Admin["Administrator"]
        ExtApp["External 3rd Party App"]
    end

    subgraph Client_Layer ["Client Layer"]
        Plugin["Map Plugin (Vanilla JS / Web Component)"]
        AdminUI["Admin Dashboard (React + Vite + Tailwind)"]
    end

    subgraph Server_Layer ["Server Layer (Node.js/Express)"]
        API["Backend API (Port 3000)"]
        Auth["Auth Middleware"]
        Proxy["Map Proxy Service"]
    end

    subgraph Data_Layer ["Data Layer"]
        DB[("SQLite / Enterprise DB")]
        Config["JSON Configs"]
    end

    subgraph Geospatial_Services ["Geospatial Services"]
        WMS["WMS/WMTS Providers"]
        WFS["WFS Providers"]
        ArcGIS["ArcGIS Rest Services"]
    end

    %% Interactions
    User -->|Interacts| ExtApp
    ExtApp -->|Embeds| Plugin
    Admin -->|Manages| AdminUI
    
    Plugin -->|Fetches Config & Tiles| API
    AdminUI -->|Configures| API
    
    API -->|Queries| DB
    API -->|Validates| Auth
    
    %% Proxy Flow
    Plugin -.->|Requests Protected Data| Proxy
    Proxy -->|Fetches| WMS
    Proxy -->|Fetches| WFS
    Proxy -->|Fetches| ArcGIS
    
    %% Direct Flow
    Plugin -.->|Direct Tile Requests| WMS
```

## Component Details

### 1. Admin Dashboard (`/admin`)
- **Tech Stack**: React, Vite, Tailwind CSS, Lucide Icons, OpenLayers.
- **Purpose**: secure interface for managing maps, layers, basemaps, and API keys.
- **Features**:
  - Live Map Builder (WYSIWYG).
  - Layer styling and configuration.
  - API Key generation and domain restriction.
  - connect to external WMS/WFS services.

### 2. Map Plugin (`/plugin`)
- **Tech Stack**: Vanilla JavaScript (ES Modules), Vite, OpenLayers, generic Web Component (`<map-viewer>`).
- **Purpose**: Lightweight, embeddable map viewer for third-party applications.
- **Features**:
  - Drop-in `<map-viewer>` HTML tag.
  - Interactive feature selection and popups.
  - Layer toggling.
  - Measurement tools.

### 3. Backend Server (`/server`)
- **Tech Stack**: Node.js, Express, `sqlite3`/multidb support.
- **Purpose**: Central API and data persistence.
- **Key Services**:
  - **API Routes**: RESTful endpoints for configuration.
  - **Proxy Service**: Securely proxies requests to external geospatial services (CORS handling, auth hiding).
  - **Static Serving**: Hosts the compiled Admin and Plugin bundles.

### 4. Database
- **Primary**: SQLite (`database.sqlite`) for configuration storage (Maps, Layers, Keys).
- **Extensibility**: Supports migration to PostgreSQL, MySQL, MSSQL, or Oracle via connection strings.
