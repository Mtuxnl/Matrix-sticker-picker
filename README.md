# Matrix Sticker Picker (Mtux)

Een lichtgewicht, aangepaste sticker picker widget voor Matrix clients (zoals Element). Deze picker ondersteunt eigen statische sticker packs en integreert met de Klipy API voor GIFs, memes en stickers. Het bevat een Python-gebaseerde media proxy om externe content te serveren die compatibel is met Matrix media standaarden.

## Kenmerken

* **Eigen Sticker Packs:** Ondersteunt statische JSON-gebaseerde sticker packs (standaard: `mtux.json`).
* **Klipy Integratie:** Zoek en verstuur GIFs, Memes en Stickers via de Klipy API.
* **Favorieten:** Sla je favoriete stickers lokaal op voor snelle toegang.
* **Media Proxy:** Bevat een Python `aiohttp` backend die externe afbeeldingen proxyt zodat ze verschijnen als geldige Matrix media (`mxc://`).
* **Thema Ondersteuning:** Detecteert automatisch de Donkere/Lichte modus van de Matrix client of systeeminstellingen.
* **Responsive:** Geoptimaliseerd voor gebruik als widget op zowel desktop als mobiel.

## Architectuur

De sticker picker bestaat uit twee componenten:

1. **Frontend (Nginx):** Serveert de HTML/JS/CSS en assets op een publiek domein (bijv. `stickers.example.com`)
2. **Backend (Docker):** Python media proxy server die externe content proxyt naar Matrix-compatibel formaat

## Frontend Setup (Nginx)

### 1. Installeer Bestanden

Plaats de frontend bestanden in je webserver directory:

### 2. Nginx Configuratie

```nginx
server {
    listen 443 ssl http2;
    server_name stickers.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    root /var/www/matrix-sticker-picker;
    index index.html;

    # Serveer frontend bestanden
    location / {
        try_files $uri $uri/ =404;
    }

    # Matrix server discovery
    location /.well-known/matrix/server {
        default_type application/json;
        add_header Access-Control-Allow-Origin *;
        return 200 '{"m.server":"assets.mtux.nl:443"}';
    }
}
```

**Belangrijk:** Vervang `assets.mtux.nl:443` met je eigen media proxy server domein.

## Backend Setup (Docker)

De media proxy server draait in Docker en handelt alle `/_matrix/media/...` requests af.

### 1. Bouw de Image

```bash
docker build -t matrix-sticker-picker .
```

### 2. Configuratie

Maak een `config.yaml` bestand aan in je data-map:

```yaml
server_name: assets.mtux.nl
hostname: 0.0.0.0
port: 8008
signing_key: "JouwGeheimeSleutelHier"
```

### 3. Start de Container

De container verwacht een volume gekoppeld aan `/data` met daarin je `config.yaml`:

```bash
docker run -d \
  -p 8008:8008 \
  -v $(pwd)/data:/data \
  --name sticker-picker \
  matrix-sticker-picker
```

**Opmerking:** De Dockerfile gebruikt `python:3.11-slim` en stelt de werkmap in op `/data`. Zorg ervoor dat je config aanwezig is in het gekoppelde volume.

### 4. Reverse Proxy (Nginx)

Configureer een reverse proxy voor de media server:

```nginx
server {
    listen 443 ssl http2;
    server_name assets.mtux.nl;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8008;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Handmatige Installatie (Backend)

Als je het liever zonder Docker draait:

### 1. Installeer Benodigdheden

```bash
pip install -r requirements.txt
```

(Vereist `aiohttp` en `PyYAML`).

### 2. Start de Server

```bash
python server.py
```

## Configuratie Opmerkingen

* **API Keys:** De Klipy API-sleutel is geconfigureerd in `index.js`.
* **Proxying:** De server handelt `klipy_` geprefixte ID's af door de base64 URL te decoderen en de content naar de client te streamen.
* **Server Discovery:** De `/.well-known/matrix/server` endpoint wijst Matrix clients naar de media proxy server.
* **CORS:** Zorg dat CORS headers correct zijn ingesteld voor cross-origin requests van Element clients.

## Licentie

Dit project valt onder de AGPL-3.0 licentie.
