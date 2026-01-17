# Matrix/Element Sticker Picker

Dit is een nieuwe, snelle sticker picker integratie voor Matrix en Element (Web/Desktop). Het stelt gebruikers in staat om eenvoudig Gifs, Memes en Stickers (via Klipy) te zoeken en te versturen in hun chats.

## Project Structuur

Het project bestaat uit twee hoofdonderdelen:

1. **Frontend (index.html + assets/)**: De gebruikersinterface. Dit zijn statische bestanden die op een webserver (of subdomein) geserveerd moeten worden.
2. **Backend (matrix-sticker-proxy/)**: Een Python server die fungeert als proxy tussen de widget en de Matrix server.

## Installatie & Configuratie

### 1. Backend (Matrix Sticker Proxy)

De backend code bevindt zich in de map matrix-sticker-proxy. Deze moet draaien op een plek waar je Matrix server (Synapse/Dendrite) bij kan.

**Vereisten:**

* Python 3 of Docker
* Pas de configuratie aan in matrix-sticker-proxy/config.yaml. Hier moet je de **signingkey** instellen.

**Draaien met Docker (aanbevolen):**

```
cd matrix-sticker-proxy  docker build -t sticker-proxy .  docker run -p 8008:8008 sticker-proxy 
```

### 2. Frontend (Static Files)

De frontend bestanden (index.html en de map assets) moeten publiekelijk toegankelijk zijn via een webserver.

**Configuratie:**

* Open assets/js/index.js en voeg je **Klipy API key** toe.

### 3. Server Configuratie (Nginx)

Om de picker correct te laten werken met Matrix, moet de webserver ook reageren als een (nep) Matrix server via de .well-known route.

Hier is een voorbeeld Nginx configuratieblok. Dit serveert de frontend op /stickers, proxyt de backend requests, en handelt de server discovery af.

```
    location /_matrix {
        proxy_pass http://proxy-ip:port;
    }

    location = /.well-known/matrix/server {
        add_header Access-Control-Allow-Origin *;
        add_header Content-Type application/json;
        add_header Cache-Control "no-cache";
        return 200 '{"m.server":"assets.mtux.nl:443"}';
    }
```

> **Let op:** De .well-known configuratie is essentieel. Hiermee bootsen we een Matrix homeserver na, wat vereist is voor de integratie widget.

## Integratie in Element

Om de sticker picker te activeren in je Element client, moet je de account data aanpassen via de developer tools.

1. Open Element en typ /devtools in een chat.
2. Klik op de knop **Explore account data** (Let op: kies de globale account data, niet "room account data").
3. Zoek naar m.widgets. Als deze niet bestaat, maak deze dan aan.
4. Bewerk het m.widgets event en plak de volgende JSON inhoud (pas de URL en User ID aan):

```
{
  "type": "m.widgets",
  "content": {
    "stickerpicker": {
      "content": {
        "type": "m.stickerpicker",
        "url": "https://example.sticker.picker.url/?theme=$theme",
        "name": "Stickerpicker",
        "creatorUserId": "@jouw_naam:matrix.server.naam",
        "data": {}
      },
      "sender": "@jouw_naam:matrix.server.naam",
      "state_key": "stickerpicker",
      "type": "m.widget",
      "id": "stickerpicker"
    }
  }
}
```

* **URL:** Vervang https://example.sticker.picker.url/ door jouw eigen domein als je zelf host.
* **Theme:** De parameter ?theme=$theme zorgt ervoor dat de picker automatisch het lichte of donkere thema van Element overneemt. Je kunt dit ook forceren door light of dark in te vullen.

### Demo

Wil je de picker uitproberen zonder zelf te hosten? Gebruik dan de volgende URL in bovenstaande configuratie:

https://assets.mtux.nl/stickers/

## Licentie

Dit project is gelicenseerd onder de **GNU Affero General Public License v3.0** (AGPL-3.0). Zie het bestand LICENSE.txt voor meer informatie.

**Veel plezier met de nieuwe sticker ervaring!**
