import base64
import yaml
import sys
import logging
import time
import aiohttp
from aiohttp import web

CONFIG_FILE = "config.yaml"

def load_config():
    try:
        with open(CONFIG_FILE, 'r') as f:
            return yaml.safe_load(f)
    except Exception as e:
        print(f"Kan config.yaml niet laden: {e}")
        sys.exit(1)

cfg = load_config()

PORT = cfg.get("port", 8008)
HOST = cfg.get("hostname", "0.0.0.0")
SERVER_NAME = cfg.get("server_name", "assets.mtux.nl")
SIGNING_KEY = cfg.get("signing_key", "DefaultKeyIfMissing")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("mtux-proxy")

def fix_base64_padding(data):
    return data + '=' * (-len(data) % 4)

async def fetch_and_stream(url, request):
    try:
        async with aiohttp.ClientSession() as session:
            headers = {"User-Agent": "Mozilla/5.0"}
            async with session.get(url, headers=headers) as resp:
                if resp.status != 200:
                    logger.error(f"Externe server gaf foutmelding {resp.status} voor {url}")
                    return web.Response(text="Upstream Error", status=502)
                
                response = web.StreamResponse(status=200, reason='OK')
                
                ct = resp.headers.get('Content-Type', 'application/octet-stream')
                response.headers['Content-Type'] = ct
                response.headers['Cache-Control'] = 'public, max-age=86400'
                
                await response.prepare(request)
                
                async for chunk in resp.content.iter_chunked(1024):
                    await response.write(chunk)
                
                return response
    except Exception as e:
        logger.error(f"Fout tijdens streamen van {url}: {e}")
        return web.Response(text="Internal Proxy Error", status=500)

async def handle_media_request(request):
    media_id = request.match_info.get('media_id', '')
    
    if media_id.startswith("klipy_"):
        decoded_url = ""
        try:
            encoded_part = media_id[6:]
            encoded_part = fix_base64_padding(encoded_part)
            url_bytes = base64.urlsafe_b64decode(encoded_part)
            decoded_url = url_bytes.decode('utf-8')
        except Exception as e:
            logger.error(f"Fout bij decoden Klipy ID: {e}")
            return web.Response(text="Invalid Media ID Syntax", status=400)
            
        logger.info(f"Proxying Klipy: {decoded_url}")
        return await fetch_and_stream(decoded_url, request)

    logger.warning(f"Onbekend media request: {media_id}")
    return web.Response(text="Not Found / Unsupported Media Type", status=404)

async def handle_server_key(request):
    return web.json_response({
        "server_name": SERVER_NAME,
        "valid_until_ts": int(time.time() * 1000) + 315360000000,
        "verify_keys": {
            "ed25519:1": {
                "key": SIGNING_KEY
            }
        },
        "old_verify_keys": {},
        "signatures": {}
    })

async def health_check(request):
    return web.Response(text="OK", status=200)

app = web.Application()
routes = [
    web.get('/_matrix/media/r0/download/{server}/{media_id}', handle_media_request),
    web.get('/_matrix/media/r0/thumbnail/{server}/{media_id}', handle_media_request),
    web.get('/_matrix/media/v3/download/{server}/{media_id}', handle_media_request),
    web.get('/_matrix/media/v3/thumbnail/{server}/{media_id}', handle_media_request),
    web.get('/download/{server}/{media_id}', handle_media_request),
    web.get('/thumbnail/{server}/{media_id}', handle_media_request),
    web.get('/_matrix/key/v2/server', handle_server_key),
    
    web.get('/', health_check)
]
app.add_routes(routes)

if __name__ == '__main__':
    logger.info(f"Starting Python Matrix Proxy (Stream Mode) on {HOST}:{PORT}")
    web.run_app(app, host=HOST, port=PORT)