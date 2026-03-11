# Maintenance Manager

Web application for managing maintenance of factory equipment. Built with FastAPI (Python) backend and a vanilla JS frontend.

## Features

- Hierarchical tree view: Factory > Section > Equipment > Component
- Maintenance task management with checklist, activity log, and priority tracking
- Maintenance plans with recurring schedules
- Bilingual interface (English / German) with database record translations
- Enhanced task detail pane with breadcrumb navigation
- Documentation attachments and file uploads
- Dark / light theme toggle
- Dashboard overview with filtering
- SQLite database (zero configuration)

## Installation

The only prerequisite is [Docker](https://docs.docker.com/get-docker/). The installer handles everything else automatically.

### Linux / macOS / WSL

```bash
curl -sL https://raw.githubusercontent.com/Antonin-Bohac/MaitenanceManager/master/install.sh | bash
```

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/Antonin-Bohac/MaitenanceManager/master/install.ps1 | iex
```

The installer will:
1. Check that Docker is installed and running
2. Find an available port (starting from 8000)
3. Build the application image
4. Start the container with demo data
5. Display the URL to access the app

### Managing the application

```bash
docker stop maintenance-manager      # Stop
docker start maintenance-manager     # Start
docker restart maintenance-manager   # Restart
docker logs -f maintenance-manager   # View logs
```

### Uninstalling

Removes the container, image, and all application data.

**Linux / macOS / WSL:**
```bash
curl -sL https://raw.githubusercontent.com/Antonin-Bohac/MaitenanceManager/master/install.sh | bash -s -- --uninstall
```

**Windows (PowerShell):**
```powershell
.\install.ps1 -Uninstall
```

## Development (without Docker)

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

DATA_DIR=./data uvicorn app.main:app --reload
```

Open **http://localhost:8000**.

## Tests

```bash
pip install -r requirements.txt
pytest tests/ -v
```

## Project Structure

```
app/
  main.py          # FastAPI app entry point
  database.py      # SQLAlchemy engine & session
  models.py        # ORM models
  schemas.py       # Pydantic schemas
  migrate.py       # Database migration script
  routers/         # API route handlers
  static/          # Frontend (HTML, CSS, JS)
seed/              # Demo database for fresh installs
install.sh         # Docker installer (Linux/macOS)
install.ps1        # Docker installer (Windows)
Dockerfile         # Container image definition
requirements.txt   # Python dependencies
tests/             # Pytest test suite
```

## API

The REST API is available at `http://localhost:8000/docs` (auto-generated Swagger UI).

## Tech Stack

- **Backend:** FastAPI, SQLAlchemy, Pydantic, Uvicorn
- **Frontend:** Vanilla HTML/CSS/JavaScript
- **Database:** SQLite
- **Deployment:** Docker
