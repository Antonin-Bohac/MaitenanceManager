# Maintenance Manager

Webova aplikace pro spravu udrzby tovarniho zarizeni.

## Spusteni (Docker)

```bash
docker build -t maintenance-manager .
docker run -p 8000:8000 -v mm-data:/app/data maintenance-manager
```

Otevrete http://localhost:8000 v prohlizeci.

## Vyvoj (bez Dockeru)

```bash
pip install -r requirements.txt
DATA_DIR=./data uvicorn app.main:app --reload
```

## Testy

```bash
pytest tests/ -v
```
