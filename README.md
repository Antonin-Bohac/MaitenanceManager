# Maintenance Manager

Web application for managing maintenance of factory equipment. Built with FastAPI (Python) backend and a vanilla JS frontend.

## Features

- Hierarchical tree view: Factory > Section > Equipment > Component
- Maintenance record management (CRUD)
- Documentation attachments
- Dark / light theme toggle
- Dashboard overview
- SQLite database (zero configuration)

## Quick Start (Docker)

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed

### Build and run

```bash
git clone https://github.com/Antonin-Bohac/MaitenanceManager.git
cd MaitenanceManager

docker build -t maintenance-manager .
docker run -d -p 8000:8000 -v mm-data:/app/data --name maintenance-manager maintenance-manager
```

Open **http://localhost:8000** in your browser.

### Stop / restart

```bash
docker stop maintenance-manager
docker start maintenance-manager
```

### Remove

```bash
docker rm -f maintenance-manager
# To also remove persisted data:
docker volume rm mm-data
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
  routers/         # API route handlers
  static/          # Frontend (HTML, CSS, JS)
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
