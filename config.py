from __future__ import annotations

import os
from pathlib import Path
from typing import Optional
from neo4j import GraphDatabase, Driver

# Locate project root and .env file
BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"

def load_dotenv(path: Path = ENV_PATH) -> None:
    """Lightweight zero-dependency .env loader."""
    if not path.exists():
        return
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key = key.strip()
            val = val.strip().strip("'\"")
            if key not in os.environ:
                os.environ[key] = val

# Automatically load .env on import
load_dotenv()

# Configuration variables
NEO4J_URI: str = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER: str = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD: str = os.getenv("NEO4J_PASSWORD", "password")
NEO4J_DATABASE: str = os.getenv("NEO4J_DATABASE", "neo4j")

DEFAULT_CASE_ID: str = os.getenv("DEFAULT_CASE_ID", "CASE_2026_001")
API_HOST: str = os.getenv("API_HOST", "127.0.0.1")
API_PORT: int = int(os.getenv("API_PORT", "8000"))
DATA_DIR: Path = BASE_DIR / os.getenv("DATA_DIR", "files")

def get_neo4j_driver() -> Driver:
    """Create a configured Neo4j driver instance."""
    return GraphDatabase.driver(
        NEO4J_URI,
        auth=(NEO4J_USER, NEO4J_PASSWORD),
    )
