import ssl
import certifi
import aiohttp


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
