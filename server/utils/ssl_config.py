import ssl
import certifi
import aiohttp
import httpx


def create_ssl_context():
    """Create SSL context with proper CA certificates for PyInstaller environments"""
    try:
        # Use certifi's CA bundle
        ssl_context = ssl.create_default_context(cafile=certifi.where())
        return ssl_context
    except Exception as e:
        print(f"Warning: Failed to create SSL context with certifi: {e}")
        # Fallback to default context
        return ssl.create_default_context()


def create_aiohttp_connector():
    """Create aiohttp TCPConnector with proper SSL configuration"""
    ssl_context = create_ssl_context()
    return aiohttp.TCPConnector(ssl=ssl_context)


def create_aiohttp_session(**kwargs):
    """Create aiohttp ClientSession with proper SSL configuration"""
    connector = create_aiohttp_connector()
    return aiohttp.ClientSession(connector=connector, **kwargs)


def create_httpx_client(**kwargs):
    """Create httpx Client with proper SSL configuration for ChatOpenAI and similar libraries"""
    try:
        # Use certifi's CA bundle for httpx
        ssl_context = ssl.create_default_context(cafile=certifi.where())
        return httpx.Client(verify=ssl_context, **kwargs)
    except Exception as e:
        print(f"Warning: Failed to create httpx client with certifi: {e}")
        # Fallback to default verification
        return httpx.Client(**kwargs)


def create_async_httpx_client(**kwargs):
    """Create httpx AsyncClient with proper SSL configuration"""
    try:
        # Use certifi's CA bundle for httpx
        ssl_context = ssl.create_default_context(cafile=certifi.where())
        return httpx.AsyncClient(verify=ssl_context, **kwargs)
    except Exception as e:
        print(
            f"Warning: Failed to create async httpx client with certifi: {e}")
        # Fallback to default verification
        return httpx.AsyncClient(**kwargs)
