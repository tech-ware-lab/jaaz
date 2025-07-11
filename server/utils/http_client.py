"""
HTTP 客户端工厂和管理器

本模块提供了统一的 HTTP 客户端创建和管理功能，基于 httpx 库封装，支持：
- 自动 SSL 证书验证
- 连接池管理和超时控制
- 同步和异步客户端支持

使用指南：
1. 单次/少量请求：使用 HttpClient.create() 自动管理资源
   async with HttpClient.create() as client:
       response = await client.get("https://api.example.com/data")

2. 长期持有客户端：使用 HttpClient.create_async_client() 手动管理
   client = HttpClient.create_async_client()
   try:
       response = await client.get("https://api.example.com/data")
   finally:
       await client.aclose()

3. 同步请求：使用 HttpClient.create_sync()
   with HttpClient.create_sync() as client:
       response = client.get("https://api.example.com/data")
"""
import os
import ssl
import certifi
import httpx
from typing import Optional, Dict, Any, AsyncGenerator, Generator
from contextlib import asynccontextmanager, contextmanager
import logging

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
    def _get_client_config(cls, **kwargs: Any) -> Dict[str, Any]:
        """获取客户端配置"""
        # 针对AI API调用优化的超时配置
        default_timeout = httpx.Timeout(
            connect=30.0,   # 连接超时：建立TCP连接的最大等待时间
            read=600.0,     # 读取超时：从服务器读取响应数据的最大等待时间
            write=60.0,     # 写入超时：向服务器发送请求数据的最大等待时间
            pool=10.0       # 连接池超时：从连接池获取连接的最大等待时间
        )

        # 检查是否使用了代理
        is_proxy_enabled = any(os.environ.get(var) for var in [
                               'HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy'])
        print('🌐 is_proxy_enabled', is_proxy_enabled)

        if is_proxy_enabled:
            # 代理环境下的特殊配置 - 针对"Server disconnected"问题
            limits = httpx.Limits(
                max_keepalive_connections=0,      # 完全禁用 Keep-Alive，强制每次新建连接
                max_connections=50,               # 大幅减少最大连接数
                keepalive_expiry=0                # 立即过期Keep-Alive连接
            )
            # 代理环境下的保守超时配置
            default_timeout = httpx.Timeout(
                connect=60.0,   # 代理连接可能很慢，增加到60秒
                read=900.0,     # 读取超时增加到15分钟（AI图像生成可能很慢）
                write=120.0,    # 写入超时增加到2分钟（适应大请求体）
                pool=30.0       # 连接池超时增加
            )
            logger.info("Proxy detected. Using proxy-safe HTTP client configuration with disabled keep-alive.")
        else:
            # 非代理环境下的优化配置
            limits = httpx.Limits(
                max_keepalive_connections=5,      # 大幅减少 Keep-Alive 连接数
                max_connections=50,               # 减少最大连接数
                keepalive_expiry=10.0             # 大幅减少 Keep-Alive 过期时间
            )
            # 非代理环境下也使用保守的超时配置
            default_timeout = httpx.Timeout(
                connect=45.0,   
                read=900.0,     # 读取超时增加到15分钟
                write=120.0,    # 写入超时增加到2分钟
                pool=15.0       
            )

        config = {
            'verify': cls._get_ssl_context(),
            'timeout': default_timeout,
            'follow_redirects': True,
            'limits': limits,
            'http2': False,  # 强制使用 HTTP/1.1，避免 HTTP/2 兼容性问题
            **kwargs
        }

        return config

    # ========== 工厂方法 ==========

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
    def create_async_client(cls, **kwargs: Any) -> httpx.AsyncClient:
        """直接创建异步客户端（需要手动关闭）"""
        config = cls._get_client_config(**kwargs)
        return httpx.AsyncClient(**config)

    @classmethod
    def create_sync_client(cls, **kwargs: Any) -> httpx.Client:
        """直接创建同步客户端（需要手动关闭）"""
        config = cls._get_client_config(**kwargs)
        return httpx.Client(**config)
