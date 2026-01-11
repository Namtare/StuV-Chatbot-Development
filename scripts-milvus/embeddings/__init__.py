"""
Embedding provider factory
"""
from .openai_provider import OpenAIEmbeddingProvider
from .local_provider import LocalEmbeddingProvider
import os


def get_embedding_provider():
    """Factory function to get configured provider"""
    provider = os.getenv('EMBEDDING_PROVIDER', 'local')

    if provider == 'openai':
        return OpenAIEmbeddingProvider()
    elif provider == 'local':
        return LocalEmbeddingProvider()
    else:
        raise ValueError(f"Unknown provider: {provider}")
