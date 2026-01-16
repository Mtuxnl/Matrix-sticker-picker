import { html, render, Component } from "../lib/htm/preact.js";

// ==========================================
// 1. CONFIGURATION & CONSTANTS
// ==========================================
const PACKS_BASE_URL = "assets/json";
const KLIPY_API_KEY = "DkeVPG9lTtWKUkWt7DE1mZvCrMoJLxNVoceY13nRKYKUdU663a97C51y50thta1t"; 
const KLIPY_MXC_PREFIX = "mxc://assets.mtux.nl/"; 
const FAVORITES_KEY = "MtuxFavoriteStickers";

// ==========================================
// 2. UTILITIES (Widget API & Favorites)
// ==========================================

// --- Widget API ---
let widgetId = null;
const listeners = [];

function addWidgetListener(fn) {
    listeners.push(fn);
}

window.onmessage = event => {
    if (!window.parent || !event.data) return;
    listeners.forEach(fn => fn(event.data));

    const request = event.data;
    if (!request.requestId || !request.widgetId || !request.action || request.api !== "toWidget") return;

    if (widgetId) {
        if (widgetId !== request.widgetId) return;
    } else {
        widgetId = request.widgetId;
    }

    let response;
    if (request.action === "visibility") {
        response = {};
    } else if (request.action === "capabilities") {
        response = { capabilities: ["m.sticker"] };
    } else if (request.action === "im.vector.theme" || request.action === "theme") {
        response = {};
    } else {
        response = { error: { message: "Action not supported" } };
    }

    window.parent.postMessage({ ...request, response }, event.origin);
};

function sendSticker(content) {
    const data = { content: { ...content }, name: content.body };
    delete data.content.id;

    const widgetData = {
        ...data,
        description: content.body,
        file: content.filename ?? `${content.id}.png`,
    };
    delete widgetData.content.filename;
    delete widgetData.content["net.maunium.telegram.sticker"];

    window.parent.postMessage({
        api: "fromWidget",
        action: "m.sticker",
        requestId: `sticker-${Date.now()}`,
        widgetId,
        data,
        widgetData,
    }, "*");
}

// --- Favorites ---
const FAVORITES = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) || "{}");

const getFavKey = (item, source) => {
    const itemId = item.id || item.url;
    return `${source}:${itemId}`;
};

const isFavorite = (item, source) => {
    if (!item) return false;
    return !!FAVORITES[getFavKey(item, source)];
};

const toggleFavorite = (item, source) => {
    const key = getFavKey(item, source);
    if (FAVORITES[key]) {
        delete FAVORITES[key];
    } else {
        FAVORITES[key] = { ...item, _source: source };
    }
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(FAVORITES));
    return !!FAVORITES[key];
};

const getFavoritesList = () => Object.values(FAVORITES).reverse();


// ==========================================
// 3. UI COMPONENTS (Spinner & SearchBox)
// ==========================================

const Spinner = ({ size = 40, noCenter = false, noMargin = false, green = false }) => {
    let margin = 0;
    if (!isNaN(+size)) {
        size = +size;
        margin = noMargin ? 0 : `${Math.round(size / 6)}px`;
        size = `${size}px`;
    }
    const noInnerMargin = !noCenter || !margin;
    const comp = html`
        <div style="width: ${size}; height: ${size}; margin: ${noInnerMargin ? 0 : margin} 0;"
             class="sk-chase ${green && "green"}">
            <div class="sk-chase-dot" />
            <div class="sk-chase-dot" />
            <div class="sk-chase-dot" />
            <div class="sk-chase-dot" />
            <div class="sk-chase-dot" />
            <div class="sk-chase-dot" />
        </div>
    `;
    return !noCenter ? html`<div style="margin: ${margin} 0;" class="sk-center-wrapper">${comp}</div>` : comp;
};

const SearchBox = ({ onInput, onKeyUp, value, placeholder = 'Search...', theme = 'dark', showKlipyLogo = true }) => {
    const logoSrc = (theme === 'light') ? './assets/img/powered-by-klipy.png' : './assets/img/powered-by-klipy-white.png';
    return html`
        <div class="search-box">
            <input type="text" placeholder=${placeholder} value=${value} onInput=${onInput} onKeyUp=${onKeyUp}/>
            ${showKlipyLogo ? html`<img src=${logoSrc} class="search-klipy-logo" alt="Klipy"/>` : null}
        </div>
    `;
};


// ==========================================
// 4. KLIPY LOGIC
// ==========================================

function toBase64URL(str) { return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }

class KlipySearchTab extends Component {
    constructor(props) {
        super(props);
        this.state = { searchTerm: "", clips: [], loading: false, offset: 0, hasMore: true };
    }

    getClipURL(clip) {
        const res = clip.file?.md || clip.file?.hd || clip.file?.original;
        return res?.webp?.url || res?.gif?.url || res?.url || clip.url || null;
    }

    async makeSearchRequest(isPagination = false) {
        if (this.state.loading) return;
        this.setState({
            loading: true,
            clips: isPagination ? this.state.clips : (this.state.searchTerm.trim() === "" ? this.state.clips : [])
        });

        try {
            const currentOffset = isPagination ? this.state.offset : 0;
            const typePath = this.props.type === 'memes' ? 'static-memes' : this.props.type;
            const action = this.state.searchTerm.trim() === "" ? "trending" : "search";
            const q = action === "search" ? `&q=${encodeURIComponent(this.state.searchTerm)}` : "";
            const LIMIT = 24;

            const url = `https://api.klipy.com/api/v1/${KLIPY_API_KEY}/${typePath}/${action}?per_page=${LIMIT}&page=${currentOffset}${q}`;

            const resp = await fetch(url);
            const jsonResponse = await resp.json();
            const validResults = jsonResponse.data?.data || jsonResponse.data || [];

            this.setState({
                clips: isPagination ? [...this.state.clips, ...validResults] : validResults,
                offset: currentOffset + 1,
                loading: false,
                hasMore: validResults.length >= LIMIT
            });
        } catch (error) { this.setState({ loading: false }); }
    }

    componentDidMount() { this.makeSearchRequest(false); }

    renderSticker(clip) {
        const sourceKey = `klipy-${this.props.type}`;
        const isFav = isFavorite(clip, sourceKey);
        const rawUrl = this.getClipURL(clip);

        return html`
            <div class="sticker" onClick=${() => {
                if(rawUrl) sendSticker({ "body": clip.title || "Klipy", "info": { "mimetype": "image/gif" }, "url": KLIPY_MXC_PREFIX + "klipy_" + toBase64URL(rawUrl) });
            }}>
                <div class="fav-btn ${isFav ? 'active' : ''}" onClick=${(e) => {
                    e.stopPropagation();
                    toggleFavorite(clip, sourceKey);
                    this.forceUpdate();
                }}>
                    ${isFav ? '♥' : '♡'}
                </div>
                <img src=${rawUrl} class="visible" />
            </div>
        `;
    }

    render() {
        const showInitialSpinner = this.state.loading && this.state.clips.length === 0;
        const showBottomSpinner = this.state.loading && this.state.clips.length > 0;
        const sourceKey = `klipy-${this.props.type}`;
        const myFavs = getFavoritesList().filter(f => f._source === sourceKey);
        const showFavorites = this.state.searchTerm.trim() === "" && myFavs.length > 0;

        return html`
            <${SearchBox}
                onInput=${(e) => {
                    this.setState({ searchTerm: e.target.value });
                    clearTimeout(this.t);
                    this.t = setTimeout(() => this.makeSearchRequest(), 800);
                }}
                value=${this.state.searchTerm}
                placeholder=${`Zoek KLIPY ${this.props.type}...`}
                theme=${this.props.theme}
                showKlipyLogo=${true}
            />
            <div class="pack-list" onScroll=${(e) => {
                if (e.target.scrollHeight - e.target.scrollTop <= e.target.clientHeight + 200 && this.state.hasMore && !this.state.loading) {
                    this.makeSearchRequest(true);
                }
            }}>
                <section class="stickerpack">
                    ${showInitialSpinner ? html`<div class="giphy-loader-center"><${Spinner} size=${40} green/></div>` : null}
                    <div class="sticker-list">
                        ${showFavorites ? html`
                            <div class="section-header"><span>Favorieten</span><div class="line"></div></div>
                            ${myFavs.map(clip => this.renderSticker(clip))}
                            <div class="section-header"><span>Trending</span><div class="line"></div></div>
                        ` : null}
                        ${this.state.clips.map((clip) => this.renderSticker(clip))}
                    </div>
                    ${showBottomSpinner ? html`<div class="giphy-loader"><${Spinner} size=${30} green/></div>` : null}
                </section>
            </div>
        `;
    }
}


// ==========================================
// 5. MAIN APP COMPONENT
// ==========================================

class App extends Component {
    constructor(props) {
        super(props);
        const params = new URLSearchParams(document.location.search);
        const initialTheme = params.get("theme") || localStorage.mauStickerThemeOverride || "dark";

        this.state = {
            activeView: 'klipy-gifs',
            packs: [],
            loading: true,
            theme: initialTheme,
            filtering: { searchTerm: "" }
        };
        this.stickersByID = new Map();
        this.sensorInterval = null;
    }

    async _loadPacks() {
        try {
            const pRes = await fetch(`${PACKS_BASE_URL}/mtux.json`);
            const pData = await pRes.json();

            if (pData.stickers) {
                pData.stickers.forEach(s => this.stickersByID.set(s.id, s));
            }

            this.setState({ packs: [pData], loading: false });
        } catch (e) {
            console.error("Fout bij laden mtux.json:", e);
            this.setState({ loading: false });
        }
    }

    checkThemeSensor() {
        const sensor = document.getElementById('theme-sensor');
        if (!sensor) return;

        const style = window.getComputedStyle(sensor);
        const bgColor = style.backgroundColor;

        if (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') {
            return; 
        }

        const rgb = bgColor.match(/\d+/g);
        if (rgb) {
            const r = parseInt(rgb[0]), g = parseInt(rgb[1]), b = parseInt(rgb[2]);
            
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            
            const detectedTheme = brightness > 125 ? 'light' : 'dark';

            if (this.state.theme !== detectedTheme) {
                this.setState({ theme: detectedTheme });
            }
        }
    }

    componentDidMount() {
        this._loadPacks();
        document.body.className = `theme-${this.state.theme}`;

        addWidgetListener((data) => {
            let newTheme = null;

            if (data.action === 'theme_change' && data.data && data.data.name) {
                newTheme = data.data.name;
            }
            else if (data.action === 'im.vector.theme' && data.data && data.data.theme) {
                newTheme = data.data.theme;
            } else if (data.theme) {
                newTheme = data.theme;
            } else if (data.userWidgetOptions && data.userWidgetOptions.theme) {
                newTheme = data.userWidgetOptions.theme;
            }

            if (newTheme && (newTheme === 'light' || newTheme === 'dark')) {
                if (this.state.theme !== newTheme) {
                    this.setState({ theme: newTheme });
                }
            }
        });

        this.checkThemeSensor();
        this.sensorInterval = setInterval(() => this.checkThemeSensor(), 2000);
    }

    componentWillUnmount() {
        if (this.sensorInterval) clearInterval(this.sensorInterval);
    }

    componentDidUpdate(prevProps, prevState) {
        if (prevState.theme !== this.state.theme) {
            document.body.className = `theme-${this.state.theme}`;
            localStorage.setItem('mauStickerThemeOverride', this.state.theme);
        }
    }

    switchView(viewId) {
        this.setState({ activeView: viewId, filtering: { searchTerm: "" } }, () => {
            const container = document.querySelector('.pack-list');
            if (container) container.scrollTop = 0;
        });
    }

    renderMtuxSticker(s, pathPrefix = "assets/img/packs/") {
        const isFav = isFavorite(s, 'mtux');
        const imgUrl = s.url.includes("http") ? s.url : `${pathPrefix}${s.url.split("/").slice(-1)[0]}.png`;

        return html`
            <div class="sticker" onClick=${() => sendSticker(s)}>
                <div class="fav-btn ${isFav ? 'active' : ''}" onClick=${(e) => {
                    e.stopPropagation();
                    toggleFavorite(s, 'mtux');
                    this.forceUpdate();
                }}>
                    ${isFav ? '♥' : '♡'}
                </div>
                <img src="${imgUrl}" class="visible"/>
            </div>
        `;
    }

    render() {
        if (this.state.loading) return html`<main class="spinner"><${Spinner} size=${40} green/></main>`;

        const mtuxFavs = getFavoritesList().filter(f => f._source === 'mtux');
        const showFavorites = this.state.filtering.searchTerm === "" && mtuxFavs.length > 0 && !this.state.activeView.startsWith('klipy');

        return html`
            <div id="theme-sensor"></div>

            <main class="has-content">
                <nav>
                    <${NavItem} id="klipy-gifs" title="GIFs" icon="klipy" label="GIFS" active=${this.state.activeView} onClick=${() => this.switchView('klipy-gifs')}/>
                    <${NavItem} id="klipy-memes" title="Memes" icon="klipy" label="MEMES" active=${this.state.activeView} onClick=${() => this.switchView('klipy-memes')}/>
                    <${NavItem} id="klipy-stickers" title="Stickers" icon="klipy" label="STICKERS" active=${this.state.activeView} onClick=${() => this.switchView('klipy-stickers')}/>
                    <${NavItem} id="packs" title="MTUX" icon="mtux" active=${this.state.activeView} onClick=${() => this.switchView('packs')}/>
                </nav>

                <div class="content-container">
                    ${this.state.activeView.startsWith('klipy') ?
                        html`<${KlipySearchTab} key=${this.state.activeView} type=${this.state.activeView.split('-')[1]} theme=${this.state.theme} />` :
                        html`
                            <${SearchBox}
                                onInput=${(e) => this.setState({ filtering: { searchTerm: e.target.value.toLowerCase() } })}
                                value=${this.state.filtering.searchTerm}
                                placeholder="Zoek in MTUX stickers..."
                                theme=${this.state.theme}
                                showKlipyLogo=${false}
                            />
                            <div class="pack-list">
                                <section class="stickerpack">
                                    <div class="sticker-list">
                                        ${showFavorites ? html`
                                            <div class="section-header"><span>Favorieten</span><div class="line"></div></div>
                                            ${mtuxFavs.map(s => this.renderMtuxSticker(s))}
                                            <div class="section-header"><span>Alle Stickers</span><div class="line"></div></div>
                                        ` : null}

                                        ${this.state.packs.map(p =>
                                            p.stickers
                                                .filter(s => s.body.toLowerCase().includes(this.state.filtering.searchTerm))
                                                .map(s => this.renderMtuxSticker(s))
                                        )}
                                    </div>
                                </section>
                            </div>
                        `
                    }
                </div>
            </main>`;
    }
}

const NavItem = ({ id, title, icon, label, active, onClick }) => html`
    <a class="${active === id ? 'visible' : ''} nav-item-${id}" title=${title} onClick=${onClick}>
        <div class="nav-sticker-container">
            <span class="icon icon-${icon}"></span>
            ${label ? html`<span class="nav-label">${label}</span>` : null}
        </div>
    </a>
`;

render(html`<${App}/>`, document.body);