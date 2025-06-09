"""
SSL配置测试路由模块

本文件仅用于测试SSL证书配置是否正常工作，特别是在PyInstaller打包后的环境中。
主要解决调用外部API（如Replicate API）时出现的SSL证书验证失败问题。

提供的API端点：
- GET /api/test_ssl: 快速SSL测试，测试基本的HTTPS连接
- GET /api/test_ssl_full: 完整SSL测试，包括环境检查和多个API连接测试
- GET /api/ssl_status: SSL状态检查，仅检查本地配置，不进行网络连接

注意：此模块仅用于诊断和测试目的，不应在生产环境中频繁调用。
"""

from fastapi import APIRouter
import traceback
import asyncio
import ssl
import sys
import os

router = APIRouter(prefix="/api")


async def quick_ssl_test():
    """Quick SSL test for API endpoint"""
    try:
        from utils.ssl_config import create_aiohttp_session
        async with create_aiohttp_session() as session:
            async with session.get('https://httpbin.org/get', timeout=5) as response:
                return {
                    'ssl_working': response.status == 200,
                    'status_code': response.status,
                    'message': 'SSL configuration is working' if response.status == 200 else f'Unexpected status: {response.status}'
                }
    except ssl.SSLError as e:
        return {
            'ssl_working': False,
            'error': 'SSL_ERROR',
            'message': f'SSL certificate verification failed: {str(e)}'
        }
    except Exception as e:
        return {
            'ssl_working': False,
            'error': 'CONNECTION_ERROR',
            'message': f'Connection failed: {str(e)}'
        }


@router.get("/test_ssl")
async def test_ssl_endpoint():
    """API endpoint to test SSL configuration"""
    try:
        result = await quick_ssl_test()
        return result
    except Exception as e:
        return {
            'ssl_working': False,
            'error': 'TEST_ERROR',
            'message': f'SSL test failed: {str(e)}'
        }


async def test_ssl_configuration():
    """Run comprehensive SSL tests"""
    test_results = []
    is_bundled = getattr(sys, 'frozen', False)

    def log_result(test_name, success, message, details=None):
        test_results.append({
            'test': test_name,
            'success': success,
            'message': message,
            'details': details or {}
        })

    # Test 1: Environment check
    try:
        import certifi
        ca_path = certifi.where()
        ca_exists = os.path.exists(ca_path)
        ca_size = os.path.getsize(ca_path) if ca_exists else 0

        log_result(
            "Certifi Package",
            ca_exists and ca_size > 0,
            f"CA bundle {'found' if ca_exists else 'not found'}",
            {
                'path': ca_path,
                'exists': ca_exists,
                'size': f"{ca_size} bytes" if ca_exists else "N/A",
                'is_bundled': is_bundled
            }
        )
    except Exception as e:
        log_result("Certifi Package", False, f"Error: {str(e)}")

    # Test 2: SSL context creation
    try:
        from utils.ssl_config import create_ssl_context
        ssl_context = create_ssl_context()
        log_result(
            "SSL Context Creation",
            True,
            "SSL context created successfully",
            {
                'protocol': str(ssl_context.protocol),
                'verify_mode': str(ssl_context.verify_mode)
            }
        )
        ssl_context_ok = True
    except Exception as e:
        log_result("SSL Context Creation", False, f"Failed: {str(e)}")
        ssl_context_ok = False

    # Test 3: Basic HTTPS connectivity
    if ssl_context_ok:
        test_urls = [
            'https://httpbin.org/get',
            'https://www.google.com',
            'https://api.github.com'
        ]

        https_ok = False
        for url in test_urls:
            try:
                from utils.ssl_config import create_aiohttp_session
                async with create_aiohttp_session() as session:
                    async with session.get(url, timeout=10) as response:
                        success = response.status in [200, 301, 302]
                        log_result(
                            f"HTTPS Test ({url})",
                            success,
                            f"Status: {response.status}",
                            {'url': str(response.url)}
                        )
                        if success:
                            https_ok = True
                            break
            except Exception as e:
                log_result(f"HTTPS Test ({url})", False, f"Failed: {str(e)}")

        # Test 4: Replicate API connectivity
        try:
            from utils.ssl_config import create_aiohttp_session
            async with create_aiohttp_session() as session:
                async with session.get('https://api.replicate.com', timeout=15) as response:
                    success = response.status in [200, 401, 403, 404]
                    log_result(
                        "Replicate API SSL",
                        success,
                        f"SSL verification {'successful' if success else 'failed'} (Status: {response.status})",
                        {'status_code': response.status}
                    )
        except ssl.SSLError as e:
            log_result("Replicate API SSL", False, f"SSL Error: {str(e)}")
        except Exception as e:
            log_result("Replicate API SSL", False,
                       f"Connection Error: {str(e)}")

    # Generate summary
    total_tests = len(test_results)
    passed_tests = sum(1 for result in test_results if result['success'])

    if passed_tests == total_tests:
        status = "success"
    elif passed_tests > 0:
        status = "partial"
    else:
        status = "failed"

    return {
        'status': status,
        'total': total_tests,
        'passed': passed_tests,
        'failed': total_tests - passed_tests,
        'results': test_results,
        'environment': {
            'python_version': sys.version,
            'is_bundled': is_bundled,
            'bundle_path': getattr(sys, '_MEIPASS', None) if is_bundled else None
        }
    }


@router.get("/test_ssl_full")
async def test_ssl_full_endpoint():
    """API endpoint to run full SSL tests"""
    try:
        result = await test_ssl_configuration()
        return result
    except Exception as e:
        return {
            'status': 'error',
            'message': f'SSL test failed: {str(e)}'
        }


@router.get("/ssl_status")
async def ssl_status_endpoint():
    """Get SSL configuration status without running network tests"""
    try:
        import ssl
        import certifi
        import sys
        import os

        # Check environment
        is_bundled = getattr(sys, 'frozen', False)
        ca_path = certifi.where()
        ca_exists = os.path.exists(ca_path)
        ca_size = os.path.getsize(ca_path) if ca_exists else 0

        # Try to create SSL context
        ssl_context_ok = False
        ssl_error = None
        try:
            ssl_context = ssl.create_default_context(cafile=certifi.where())
            ssl_context_ok = True
        except Exception as e:
            ssl_error = str(e)

        return {
            'environment': {
                'python_version': sys.version,
                'is_bundled': is_bundled,
                'bundle_path': getattr(sys, '_MEIPASS', None) if is_bundled else None
            },
            'certifi': {
                'ca_path': ca_path,
                'ca_exists': ca_exists,
                'ca_size': ca_size
            },
            'ssl_context': {
                'creation_ok': ssl_context_ok,
                'error': ssl_error
            },
            'overall_status': 'ok' if ssl_context_ok and ca_exists else 'error'
        }

    except Exception as e:
        return {
            'overall_status': 'error',
            'error': str(e)
        }
