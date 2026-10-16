"""Start the registration API with: python app.py"""
import importlib.machinery
import importlib.util
import sys
from pathlib import Path

from dotenv import load_dotenv
import uvicorn

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

# This file is app.py, next to the app package. Register the package first
# so `import app.main` does not load this script.
package = importlib.util.module_from_spec(importlib.machinery.ModuleSpec("app", loader=None, is_package=True))
package.__path__ = [str(ROOT / "app")]
sys.modules["app"] = package

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000)
