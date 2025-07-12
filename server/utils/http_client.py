"""
HTTP 客户端工厂和管理器

本模块提供了统一的 HTTP 客户端创建和管理功能，支持 httpx 和 aiohttp 库：
- 自动 SSL 证书验证
- 连接池管理和超时控制
- 同步和异步客户端支持

使用指南：
1. httpx 客户端：
   async with HttpClient.create() as client:
       response = await client.get("https://api.example.com/data")

2. aiohttp 客户端：
   async with HttpClient.create_aiohttp() as session:
       async with session.get("https://api.example.com/data") as response:
           data = await response.json()

3. 同步请求：使用 HttpClient.create_sync()
   with HttpClient.create_sync() as client:
       response = client.get("https://api.example.com/data")
"""
import ssl
import certifi
import httpx
from typing import Optional, Dict, Any, AsyncGenerator, Generator
from contextlib import asynccontextmanager, contextmanager
import logging
import aiohttp

logger = logging.getLogger(__name__)


class HttpClient:
    """HTTP 客户端工厂和管理器"""

    _ssl_context: Optional[ssl.SSLContext] = None

    @classmethod
    def _get_ssl_context(cls) -> ssl.SSLContext:
        """获取缓存的 SSL 上下文"""
        if cls._ssl_context is None:
            try:
                cls._ssl_context = ssl.create_default_context(
                    cafile=certifi.where())
            except Exception as e:
                logger.warning(
                    f"Failed to create SSL context with certifi: {e}")
                cls._ssl_context = ssl.create_default_context()
        return cls._ssl_context

    @classmethod
    @asynccontextmanager
    async def create(cls, url: Optional[str] = None, **kwargs: Any) -> AsyncGenerator[httpx.AsyncClient, None]:
        """创建异步客户端上下文管理器"""
        config = cls._get_client_config(**kwargs)
        client = httpx.AsyncClient(**config)
        try:
            yield client
        finally:
            await client.aclose()

    @classmethod
    @contextmanager
    def create_sync(cls, url: Optional[str] = None, **kwargs: Any) -> Generator[httpx.Client, None, None]:
        """创建同步客户端上下文管理器"""
        config = cls._get_client_config(**kwargs)
        client = httpx.Client(**config)
        try:
            yield client
        finally:
            client.close()

    @classmethod
    def _get_client_config(cls, **kwargs: Any) -> Dict[str, Any]:
        """获取客户端配置"""

        config = {
            'verify': cls._get_ssl_context(),
            'timeout': 300,
            'follow_redirects': True,
            'limits': httpx.Limits(
                max_keepalive_connections=50,
                max_connections=200,
                keepalive_expiry=300.0
            ),
            **kwargs
        }

        return config

    @classmethod
    def create_async_client(cls, **kwargs: Any) -> httpx.AsyncClient:
        """直接创建异步客户端（需要手动关闭）"""
        config = cls._get_client_config(**kwargs)
        return httpx.AsyncClient(**config)

    @classmethod
    def create_sync_client(cls, **kwargs: Any) -> httpx.Client:
        """直接创建同步客户端（需要手动关闭）"""
        config = cls._get_client_config(**kwargs)
        return httpx.Client(**config)

    # ========== aiohttp 工厂方法 ==========
    @classmethod
    @asynccontextmanager
    async def create_aiohttp(cls, **kwargs: Any) -> AsyncGenerator['aiohttp.ClientSession', None]:
        """创建 aiohttp 客户端上下文管理器"""
        session = aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(
                ssl=cls._get_ssl_context(),
            ),
            **kwargs
        )
        try:
            yield session
        finally:
            await session.close()

    @classmethod
    def create_aiohttp_client(cls, **kwargs: Any) -> 'aiohttp.ClientSession':
        """直接创建 aiohttp 客户端（需要手动关闭）"""
        return aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(
                ssl=cls._get_ssl_context(),
            ),
            **kwargs
        )
