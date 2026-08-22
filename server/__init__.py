"""Fetcher backend package.

A small FastAPI service that serves the existing Fetcher frontend and provides
the real prepare/download flow. YouTube is the only enabled provider for now
(see providers/), but the provider layer is deliberately pluggable so more
sites can be added later without the frontend or the API surface changing.
"""

__all__ = ["__version__"]

__version__ = "0.2.0"
