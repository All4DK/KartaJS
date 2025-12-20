/*! KartaJS v0.0 | MIT License | github.com/All4DK/KartaJS */
class EventEmitter {
    constructor() {
        this._events = new Map();
    }

    /**
     * Подписка на событие
     * @param {string} event - Имя события
     * @param {Function} fn - Функция-обработчик
     * @param {Object} options - Дополнительные опции
     * @param {boolean} options.once - Вызвать только один раз
     * @returns {Function} Функция для отписки
     */
    on(event, fn, options = {}) {
        if (!this._events.has(event)) {
            this._events.set(event, []);
        }

        const listener = {
            fn,
            once: !!options.once,
            context: options.context || this
        };

        this._events.get(event).push(listener);

        // Возвращаем функцию для отписки
        return () => this.off(event, fn);
    }

    /**
     * Подписка на событие (только один раз)
     * @param {string} event - Имя события
     * @param {Function} fn - Функция-обработчик
     * @returns {Function} Функция для отписки
     */
    once(event, fn) {
        return this.on(event, fn, { once: true });
    }

    /**
     * Отписка от события
     * @param {string} event - Имя события
     * @param {Function} fn - Функция для удаления (если не указана - удаляем все)
     */
    off(event, fn) {
        if (!this._events.has(event)) return;

        if (!fn) {
            // Удаляем все обработчики события
            this._events.delete(event);
            return;
        }

        const listeners = this._events.get(event);
        const filtered = listeners.filter(listener => listener.fn !== fn);

        if (filtered.length === 0) {
            this._events.delete(event);
        } else {
            this._events.set(event, filtered);
        }
    }

    /**
     * Генерация события
     * @param {string} event - Имя события
     * @param {*} data - Данные события
     * @returns {boolean} Были ли обработчики
     */
    emit(event, data = {}) {
        if (!this._events.has(event)) return false;

        const listeners = this._events.get(event).slice(); // Копируем массив
        let hasListeners = false;

        for (let i = 0; i < listeners.length; i++) {
            const listener = listeners[i];

            try {
                listener.fn.call(listener.context, {
                    type: event,
                    target: this,
                    data: data,
                    timestamp: Date.now()
                });
                hasListeners = true;
            } catch (err) {
                console.error(`Error in event handler for "${event}":`, err);
            }

            // Удаляем одноразовые обработчики
            if (listener.once) {
                this.off(event, listener.fn);
            }
        }

        return hasListeners;
    }

    /**
     * Удаление всех подписок
     */
    removeAllListeners() {
        this._events.clear();
    }

    /**
     * Получение количества обработчиков для события
     * @param {string} event - Имя события
     * @returns {number}
     */
    listenerCount(event) {
        if (!this._events.has(event)) return 0;
        return this._events.get(event).length;
    }
}

class KartaJS extends EventEmitter {
    /**
     * Константы событий карты
     * @readonly
     * @enum {string}
     */
    static EVENTS = Object.freeze({
        /** Загрузка тайлов загружена */
        LOAD: 'load',
        /** Клик по карте */
        CLICK: 'click',
        /** Двойной клик по карте */
        DBLCLICK: 'dblclick',
        /** Карта перемещается */
        MOVE: 'move',
        /** Перемещение карты завершено */
        MOVEEND: 'moveend',
        /** Начало события прикосновения */
        TOUCHSTART: 'touchstart',
        /** Окончание события прикосновения */
        TOUCHEND: 'touchend',
        /** Перетаскивание нажатием на экран */
        TOUCHMOVE: 'touchmove',
        /** Двойной тап по карте */
        DBLTAP: 'dbltap',
        /** Начало изменения масштаба */
        ZOOMSTART: 'zoomstart',
        /** Изменение масштаба завершено */
        ZOOMEND: 'zoomend',
        /** Нажатие клавиши */
        KEYUP: 'keyup',
        /** Загружен тайл */
        TILELOAD: 'tileload',
        /** Ошибка загрузки тайла */
        TILEERROR: 'tileerror',
        /** Нажата кнопка мыши */
        MOUSEDOWN: 'mousedown',
        /** Перемещение указателя */
        MOUSEMOVE: 'mousemove',
        /** Отпущена нажатая кнопка мыши */
        MOUSEUP: 'mouseup',
        /** Клик правой кнопкой */
        CONTEXTMENU: 'contextmenu'
    });

    constructor(containerId, options = {}) {
        super();
        this.container = document.getElementById(containerId);
        this.options = {
            center: options.center || [0, 0],
            zoom: options.zoom || 5,
            minZoom: options.minZoom || 1,
            maxZoom: options.maxZoom || 19,
            tileLayer: options.tileLayer || {
                url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                attribution: '© <a href="https://osm.org" target="_blank">OpenStreetMap</a>',
                subdomains: ['a', 'b', 'c']
            },
            showLatlngMonitor: (typeof options.showLatlngMonitor !== 'undefined') && options.showLatlngMonitor,
            interactive: (typeof options.interactive !== 'undefined') ? options.interactive : true,
        };

        this.tileSize = 256;
        this.isDragging = false;
        this.lastMousePos = {x: 0, y: 0, lat: 0, lng: 0};
        this.centerPoint = {x: 0, y: 0, lat: 0, lng: 0};
        this.currentOffset = {x: 0, y: 0};
        this.clearTimer = null;
        this.loadTimer = null;
        this.tiles = new Map(); // Tiles cache
        this.markers = new Map(); // Markers data
        this.overlayObjects = new Map(); // Overlay objects data
        this.queuedTiles = 0; // Counting tiles in queue or while loading
        this.lastClickTime = 0; // For double-click / double-tap
        this.clickCount = 1; // For double-click / double-tap
        this.bounds = null;
        this.init();
        this.setCenter(this.options.center);

        // Обработка массива маркеров, пришедших на инициализацию
        if (options.markers && Array.isArray(options.markers)) {
            let autoCenter = {lat: 0, lng: 0};
            options.markers.forEach(markerOpts => {
                this.addMarker(markerOpts);
                autoCenter.lat += markerOpts.lat;
                autoCenter.lng += markerOpts.lng;
            });
            if (this.options.center[0] === 0 && this.options.center[1] === 0) {
                this.setCenter([autoCenter.lat/options.markers.length, autoCenter.lng/options.markers.length]);
            }
        }
    }

    init() {
        this.createContainer();
        this.loadTiles();

        if (this.options.interactive) {
            this.setupEvents();
        }
    }

    createContainer() {
        this.container.style.position = 'relative';
        this.container.style.overflow = 'hidden';
        this.container.style.cursor = 'default';
        this.container.innerHTML = `
            <div class="kjs-tiles-container"></div>
            <div class="kjs-markers-container"></div>
            <div class="kjs-overlay-container"></div>
            <div class="kjs-copyrighths">` + this.options.tileLayer.attribution + ` | <a href="https://github.com/All4DK/KartaJS" target="_blank">KartaJS</a></div>`;

        if (this.options.interactive) {
            this.container.innerHTML += '<div class="kjs-controls"><button class="kjs-zoom-in">▲</button><button class="kjs-zoom-out">▼</button></div>';
        }

        if (this.options.showLatlngMonitor) {
            this.container.innerHTML += '<div class="kjs-current-latlng">N:0.00 E:0.00</div>';
        }
        this.container.innerHTML += '' +
            '<div class="kjs-popup-container">' +
            '   <div class="popup"></div>' +
            '</div>';

        this.tilesContainer = this.container.querySelector('.kjs-tiles-container');
        this.markersContainer = this.container.querySelector('.kjs-markers-container');
        this.overlayContainer = this.container.querySelector('.kjs-overlay-container');
        this.popupContainer = this.container.querySelector('.kjs-popup-container');
        this.popup = this.container.querySelector('.popup');
        this.currentLatlng = this.container.querySelector('.kjs-current-latlng');
        this.zoomInBtn = this.container.querySelector('.kjs-zoom-in');
        this.zoomOutBtn = this.container.querySelector('.kjs-zoom-out');
    }

    /**
     * Загружает новые тайлы, которые попадают в область видимости
     */
    loadTiles() {
        // Calc visible area
        const containerWidth = this.container.offsetWidth;
        const containerHeight = this.container.offsetHeight;

        const centerTileX = Math.floor(this.centerPoint.x / this.tileSize);
        const centerTileY = Math.floor(this.centerPoint.y / this.tileSize);

        // Tiles count around the center point
        const tilesX = Math.ceil((containerWidth / this.tileSize) / 2) + 1;
        const tilesY = Math.ceil((containerHeight / this.tileSize) / 2) + 1;

        // Loading tiles
        for (let x = centerTileX - tilesX; x <= centerTileX + tilesX; x++) {
            for (let y = centerTileY - tilesY; y <= centerTileY + tilesY; y++) {
                this.loadTile(x, y, this.getZoom());
            }
        }

        this.updateObjectsPosition();
        this.panBy();
        this.clearOldTiles();
    }

    loadTile(x, y, z) {
        const tileKey = `${z}/${x}/${y}`;

        if (this.tiles.has(tileKey)) {
            return;
        }

        const maxTileNum = Math.pow(2, z);
        const subdomain = this.options.tileLayer.subdomains ?
            this.options.tileLayer.subdomains[Math.abs(x + y) % this.options.tileLayer.subdomains.length] : 'a';

        const url = (x >= 0 && y >= 0 && x < maxTileNum && y < maxTileNum) ? this.options.tileLayer.url
            .replace('{s}', subdomain)
            .replace('{z}', z)
            .replace('{x}', x)
            .replace('{y}', y) : '';

        if (!url) {
            return;
        }

        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.style.cssText = `width: ${this.tileSize}px; height: ${this.tileSize}px;`;
        tile.style.backgroundColor = 'transparent';
        tile.setAttribute('zoom', z);

        // Позиционируем тайл
        tile.style.left = x * this.tileSize + 'px';
        tile.style.top = y * this.tileSize + 'px';

        // Загружаем изображение тайла
        const img = new Image();
        img.src = url;
        this.queuedTiles++;
        img.onload = () => {
            tile.style.backgroundImage = `url(${url})`;
            tile.style.backgroundSize = 'cover';
            this.queuedTiles--;
            this.clearOldTiles();
            this.emit(KartaJS.EVENTS.TILELOAD, {url: img.src});
        };
        img.onerror = () => {
            console.warn('Failed to load tile:', url);
            this.queuedTiles--;
            this.clearOldTiles();
            tile.remove();
            this.tiles.delete(tileKey);
            this.emit(KartaJS.EVENTS.TILEERROR, {url: img.src});
        };
        this.tilesContainer.appendChild(tile);
        this.tiles.set(tileKey, tile);
    }

    clearOldTiles() {
        clearTimeout(this.clearTimer);
        this.clearTimer = setTimeout(() => {
            this.tiles.forEach((tile, key, currentMap) => {
                const delta = Math.abs(parseInt(tile.getAttribute('zoom')) - this.getZoom());
                if (delta === 0) {
                    return
                }
                if (delta === 1 && this.queuedTiles > 0) {
                    return;
                }

                tile.remove();
                currentMap.delete(key);
            });
            if (this.queuedTiles === 0) {
                this.emit(KartaJS.EVENTS.LOAD, {center: this.centerPoint});
            }
        }, 300);
    }

    setupEvents() {
        // Перетаскивание карты
        this.container.addEventListener('mousedown', this.onMouseDown.bind(this));
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.container.addEventListener('contextmenu', this.onContextMenu.bind(this));

        // Зум колесом мыши
        this.container.addEventListener('wheel', this.onWheel.bind(this), {passive: false});

        // Кнопки зума
        this.zoomInBtn.addEventListener('click', () => this.zoomIn());
        this.zoomOutBtn.addEventListener('click', () => this.zoomOut());

        // Касания для мобильных устройств
        this.container.addEventListener('touchstart', this.onTouchStart.bind(this));
        this.container.addEventListener('touchmove', this.onTouchMove.bind(this));
        this.container.addEventListener('touchend', this.onTouchEnd.bind(this));

        // Работа с попапом
        this.popupContainer.addEventListener('click', (e) => {
            if (e.target === this.popupContainer) {
                this.hidePopup();
            }
        });
        this.popupContainer.addEventListener('touchstart', (e) => {
            if (e.target === this.popupContainer) {
                this.hidePopup();
            }
        });

        // Keyboard events
        document.addEventListener('keyup', (e) => {
            switch (e.key) {
                case 'Escape':
                    this.hidePopup();
                    break;
                case 'ArrowRight':
                    this.panBy(-10, 0);
                    break;
                case 'ArrowLeft':
                    this.panBy(10, 0);
                    break;
                case 'ArrowUp':
                    this.panBy(0, 10);
                    break;
                case 'ArrowDown':
                    this.panBy(0, -10);
                    break;
                case '+':
                    this.zoomIn();
                    break;
                case '-':
                    this.zoomOut();
                    break;
            }
            this.emit(KartaJS.EVENTS.KEYUP, {key: e.key});
        });
    }

    onMouseDown(e) {
        e.preventDefault();
        this.isDragging = true;
        this.container.style.cursor = 'grabbing';

        const now = Date.now();
        this.clickCount = (now - this.lastClickTime > 300) ? 1 : (this.clickCount + 1);
        this.lastClickTime = now;

        const coords = this.pointToCoords(e.clientX, e.clientY);
        this.emit(KartaJS.EVENTS.MOUSEDOWN, {
            center: this.centerPoint,
            latlng: [coords.lat, coords.lng],
            pixel: {x: coords.x, y: coords.y},
            originalEvent: e
        });
    }

    onMouseMove(e) {
        const coords = this.pointToCoords(e.clientX, e.clientY);
        this.setMousePos(coords);
        this.updateLatlngMonitor(coords);

        if (this.isDragging) {
            this.panBy(coords.deltaX, coords.deltaY);
        }

        this.emit(KartaJS.EVENTS.MOUSEMOVE, {
            center: this.centerPoint,
            latlng: [coords.lat, coords.lng],
            pixel: {x: coords.x, y: coords.y},
            originalEvent: e
        });
    }

    onMouseUp(e) {
        if (this.isDragging) {
            this.isDragging = false;
            this.emit(KartaJS.EVENTS.MOVEEND, {center: this.centerPoint});
        }
        this.container.style.cursor = 'default';

        const coords = this.pointToCoords(e.clientX, e.clientY);

        if (this.clickCount === 2) {
            this.clickCount = 0;
            this.zoomIn(true);
            this.emit(KartaJS.EVENTS.DBLCLICK, {
                center: this.centerPoint,
                latlng: [coords.lat, coords.lng],
                pixel: {x: coords.x, y: coords.y},
                originalEvent: e
            });
            return;
        }

        this.emit(KartaJS.EVENTS.MOUSEUP, {
            center: this.centerPoint,
            latlng: [coords.lat, coords.lng],
            pixel: {x: coords.x, y: coords.y},
            originalEvent: e
        });
        this.emit(KartaJS.EVENTS.CLICK, {
            center: this.centerPoint,
            latlng: [coords.lat, coords.lng],
            pixel: {x: coords.x, y: coords.y},
            originalEvent: e
        });
        this.loadTiles();
    }

    onContextMenu(e) {
        e.preventDefault(); // Отменяем стандартное меню браузера

        const coords = this.pointToCoords(e.clientX, e.clientY);
        this.emit(KartaJS.EVENTS.CONTEXTMENU, {
            center: this.centerPoint,
            latlng: [coords.lat, coords.lng],
            pixel: {x: coords.x, y: coords.y},
            originalEvent: e
        });
    }

    onWheel(e) {
        e.preventDefault();
        const zoomDelta = e.deltaY > 0 ? -1 : 1;
        this.setZoom(this.getZoom() + zoomDelta, true);
    }

    onTouchStart(e) {
        e.preventDefault();

        let coords = this.pointToCoords(e.touches[0].clientX, e.touches[0].clientY);
        if (e.touches.length === 1) {
            this.isDragging = true;

            const now = Date.now();
            this.clickCount = (now - this.lastClickTime > 300) ? 1 : (this.clickCount + 1);
            this.lastClickTime = now;
        }

        if (e.touches.length === 2) {
            this.isZooming = true;
            coords = this.pointToCoords(
                (e.touches[0].clientX + e.touches[1].clientX) / 2,
                (e.touches[0].clientY + e.touches[1].clientY) / 2
            );
            this.startTouchDistance = this.getTouchDistance(e.touches);
            this.lastTouchDistance = this.getTouchDistance(e.touches);
        }

        this.setMousePos(coords);
        this.updateLatlngMonitor(coords);

        this.emit(KartaJS.EVENTS.TOUCHSTART, {
            center: this.centerPoint,
            isDragging: this.isDragging,
            isZooming: this.isZooming,
            latlng: [coords.lat, coords.lng],
            pixel: {x: coords.x, y: coords.y},
            originalEvent: e
        });
    }

    onTouchMove(e) {
        e.preventDefault();

        let coords = this.pointToCoords(e.touches[0].clientX, e.touches[0].clientY);
        if (e.touches.length === 2) {
            coords = this.pointToCoords((e.touches[0].clientX + e.touches[1].clientX) / 2,
                (e.touches[0].clientY + e.touches[1].clientY) / 2);
        }

        if (this.isDragging && e.touches.length === 1) {
            this.setMousePos(coords);
            this.panBy(coords.deltaX, coords.deltaY);
        }

        if (this.isZooming && e.touches.length === 2) {
            this.lastTouchDistance = this.getTouchDistance(e.touches);
            const zoomDelta = (this.startTouchDistance / this.lastTouchDistance);
            if (zoomDelta < 0.8) {
                this.zoomIn(true);
                this.startTouchDistance = this.lastTouchDistance
            }
            if (zoomDelta > 1.2) {
                this.zoomOut(true);
                this.startTouchDistance = this.lastTouchDistance
            }
        }

        this.emit(KartaJS.EVENTS.TOUCHMOVE, {
            center: this.centerPoint,
            latlng: [coords.lat, coords.lng],
            pixel: {x: coords.x, y: coords.y},
            originalEvent: e
        });
    }

    onTouchEnd() {
        if (this.isDragging) {
            this.emit(KartaJS.EVENTS.MOVEEND, {center: this.centerPoint});
            this.emit(KartaJS.EVENTS.TOUCHEND);
            this.isDragging = false;
        }

        if (this.clickCount === 2) {
            this.clickCount = 0;
            this.zoomIn(true);
            this.emit(KartaJS.EVENTS.DBLTAP, this.lastMousePos);
            return;
        }

        this.isZooming = false;

        this.loadTiles();
    }

    updateLatlngMonitor(coords) {
        if (!this.options.showLatlngMonitor) {
            return;
        }

        this.currentLatlng.innerHTML =
            ((this.lastMousePos.lat > 0) ? 'N:' : 'S:')
            + Math.abs(coords.lat.toFixed(4))
            + ' '
            + ((this.lastMousePos.lng > 0) ? 'E:' : 'W:')
            + Math.abs(coords.lng.toFixed(4));
    }

    /**
     * Двигаем карту на некоторую дельту - в пикселях.
     * @param deltaX int pixels
     * @param deltaY int pixels
     */
    panBy(deltaX = 0, deltaY = 0) {
        this.currentOffset.x += deltaX;
        this.currentOffset.y += deltaY;

        // Обновляем позиции всех тайлов
        this.tiles.forEach((tile, key) => {
            const [z, x, y] = key.split('/').map(Number);
            const zoomDelta = this.getZoom() - z;
            const multiplier = Math.pow(2, zoomDelta);
            const offsetX = x * this.tileSize * multiplier + this.currentOffset.x;
            const offsetY = y * this.tileSize * multiplier + this.currentOffset.y;
            tile.style.left = offsetX + 'px';
            tile.style.top = offsetY + 'px';
        });

        // Обновляем центр карты и маркеры
        this.updateCenterFromOffset();
        this.updateObjectsPosition();
        this.bounds = null;

        this.emit(KartaJS.EVENTS.MOVE, {center: this.centerPoint});
    }

    /**
     * Обновляет текущие координаты центра центра карты
     */
    updateCenterFromOffset() {
        const containerWidth = this.container.offsetWidth;
        const containerHeight = this.container.offsetHeight;

        const centerPixelX = -this.currentOffset.x + containerWidth / 2;
        const centerPixelY = -this.currentOffset.y + containerHeight / 2;

        this.centerPoint = this.pointToLatLng(centerPixelX, centerPixelY);
    }

    setZoom(newZoom, byMouse = false) {
        if (newZoom < this.options.minZoom || newZoom > this.options.maxZoom) {
            return;
        }

        this.options.zoom = newZoom;

        // Update zoom-buttons state (enabled/disabled)
        this.zoomInBtn.disabled = newZoom >= this.options.maxZoom;
        this.zoomOutBtn.disabled = newZoom <= this.options.minZoom;

        // Centering map by mouse position
        if (byMouse) {
            this.setCenter([this.lastMousePos.lat, this.lastMousePos.lng]);
        } else {
            this.setCenter(this.getCenter());
        }

        this.bounds = null;
        this.emit(KartaJS.EVENTS.ZOOMSTART, {center: this.centerPoint});

        // Updating geo-based objects on all layers
        this.updateObjectsPosition();

        // Resize existing tiles before loading new ones
        this.tiles.forEach((tile, key) => {
            const [z, x, y] = key.split('/').map(Number);
            const zoomDelta = this.getZoom() - z;
            const multiplier = Math.pow(2, zoomDelta);
            const offsetX = x * this.tileSize * multiplier + this.currentOffset.x;
            const offsetY = y * this.tileSize * multiplier + this.currentOffset.y;
            tile.style.left = offsetX + 'px';
            tile.style.top = offsetY + 'px';

            tile.style.width = (this.tileSize * multiplier) + 'px';
            tile.style.height = (this.tileSize * multiplier) + 'px';
        });

        // "setTimeout" is used to skip unnecessary levels when zooming quickly
        clearTimeout(this.loadTimer);
        this.loadTimer = setTimeout(() => {
            this.loadTiles();
            this.emit(KartaJS.EVENTS.ZOOMEND, {center: this.centerPoint});
        }, 500);
    }

    getZoom() {
        return this.options.zoom;
    }

    zoomIn(byMouse = false) {
        this.setZoom(this.getZoom() + 1, byMouse);
    }

    zoomOut(byMouse = false) {
        this.setZoom(this.getZoom() - 1, byMouse);
    }

    // Update position for all geo-based objects ao all layers
    updateObjectsPosition() {
        if (this.updatingMarkers) {
            return;
        }
        this.updatingMarkers = true;

        requestAnimationFrame(() => {
            this.markers.forEach((marker) => {
                if (this.isObjectInBounds(marker)) {
                    marker.showOnMap();
                    this.calcObjectPosition(marker);
                } else {
                    marker.hideOnMap();
                }
            });
            this.updatingMarkers = false;
        });
    }

    calcObjectPosition(object) {
        if (!object.element) {
            return;
        }

        if (!(object.cachePosition && object.cachePosition.zoom === this.getZoom())) {
            object.cachePosition = this.latLngToPoint(object.getLat(), object.getLng(), this.getZoom());
            object.cachePosition.zoom = this.getZoom();
        }

        const offsetX = object.cachePosition.x - this.centerPoint.x + (this.container.offsetWidth / 2);
        const offsetY = object.cachePosition.y - this.centerPoint.y + (this.container.offsetHeight / 2);

        object.setLeft(offsetX);
        object.setTop(offsetY);
    }

    isLatlngInBounds(lat, lng) {
        const bounds = this.getBounds();
        return lat >= bounds.south &&
            lat <= bounds.north &&
            lng >= bounds.west &&
            lng <= bounds.east;
    }

    isObjectInBounds(object) {
        return this.isLatlngInBounds(object.lat, object.lng)
    }

    setCenter(latlng = [0, 0]) {
        this.centerPoint = this.latLngToPoint(...latlng);
        this.calcOffset(latlng);
        this.loadTiles();
    }

    getCenter() {
        return [this.centerPoint.lat, this.centerPoint.lng];
    }

    calcOffset(latlng = [0, 0]) {
        const rect = this.container.getBoundingClientRect();
        const pnt = this.latLngToPoint(...latlng);
        this.currentOffset = {x: Math.floor(rect.width / 2) - pnt.x, y: Math.floor(rect.height / 2) - pnt.y}
    }

    degreesToRadians(deg) {
        return deg * (Math.PI / 180);
    }

    radiansToDegrees(rad) {
        return rad * (180 / Math.PI);
    }

    // Правильная проекция Меркатора
    latLngToPoint(lat, lng, zoom = -1) {
        if (zoom === -1) {
            zoom = this.getZoom();
        }

        const scale = 256 * Math.pow(2, zoom);
        const latRad = this.degreesToRadians(lat);

        // Долгота - простое линейное преобразование
        const x = (lng + 180) * (scale / 360);

        // Широта - проекция Меркатора (сжимает у полюсов)
        const mercator = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
        const y = (scale / 2) - (scale * mercator / (2 * Math.PI));

        return {x, y, lat, lng};
    }

    pointToLatLng(x, y, zoom = -1) {
        if (zoom === -1) {
            zoom = this.getZoom();
        }

        const scale = 256 * Math.pow(2, zoom);

        // Обратное преобразование долготы
        const lng = (x / scale) * 360 - 180;

        // Обратное преобразование широты
        const mercator = (scale / 2 - y) * (2 * Math.PI) / scale;
        const latRad = 2 * Math.atan(Math.exp(mercator)) - Math.PI / 2;
        const lat = this.radiansToDegrees(latRad);

        return {x, y, lat, lng};
    }

    /**
     * считает координаты (x,y,lat,lng,deltaX,deltaY) для точки на экране (учитыавя смещение карты)
     * @param x
     * @param y
     */
    pointToCoords(x, y) {
        const rect = this.container.getBoundingClientRect();

        const clientX = x - rect.left;
        const clientY = y - rect.top;

        const coords = this.pointToLatLng(
            clientX - this.currentOffset.x,
            clientY - this.currentOffset.y
        );

        return {
            x: clientX,
            y: clientY,
            lat: coords.lat,
            lng: coords.lng,
            deltaX: clientX - this.lastMousePos.x,
            deltaY: clientY - this.lastMousePos.y
        }
    }

    /**
     * Сохраняет переданные координаты (x,y,lat,lng) как координаты мыши
     * @param coords
     */
    setMousePos(coords) {
        this.lastMousePos.x = coords.x;
        this.lastMousePos.y = coords.y;
        this.lastMousePos.lat = coords.lat;
        this.lastMousePos.lng = coords.lng;
    }

    showPopup(content) {
        this.popup.innerHTML = content;
        this.popupContainer.style.display = 'grid';
    }

    hidePopup() {
        this.popupContainer.style.display = 'none';
        this.popup.innerHTML = '';
    }

    getTouchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Возвращает bounding box видимой области карты
     * @returns {Object} Объект с координатами углов {north, south, east, west}
     */
    getBounds() {
        if (this.bounds) {
            return this.bounds;
        }

        const containerWidth = this.container.offsetWidth;
        const containerHeight = this.container.offsetHeight;

        // Left-top
        const northWest = this.pointToLatLng(-this.currentOffset['x'], -this.currentOffset['y']);

        // Right-bottom
        const southEast = this.pointToLatLng(containerWidth - this.currentOffset['x'], containerHeight - this.currentOffset['y']);

        this.bounds = {
            north: Math.min(northWest.lat, 90),
            south: Math.max(southEast.lat, -90),
            east: Math.min(southEast.lng, 180),
            west: Math.max(northWest.lng, -180),
        };

        return this.bounds;
    }

    // MARKERS
    addMarker(options) {
        const marker = new Marker(this, options);
        this.markers.set(marker.getId(), marker);

        return marker.getId();
    }

    getMarker(id) {
        return this.markers.get(id);
    }

    removeMarker(id) {
        this.markers.get(id).remove();
        this.markers.delete(id);

        return id;
    }

    clearMarkers() {
        this.markers.forEach(marker => marker.remove());
        this.markers.clear();
    }

}

class MapObject extends EventEmitter {
    constructor(map) {
        super();
        this.element = {};
        this.map = map;
    }

    getLat() {
        return this.lat;
    }

    getLng() {
        return this.lng;
    }

    getTop() {
        return parseInt(this.element.style.top);
    }

    setTop(value) {
        return this.element.style.top = value + 'px';
    }

    getLeft() {
        return parseInt(this.element.style.left);
    }

    setLeft(value) {
        return this.element.style.left = value + 'px';
    }

    updatePosition() {
        return this.map.calcObjectPosition(this);
    }

    hideOnMap() {
        if (!this.element.style) {
            return;
        }
        this.element.style.display = 'none';
    }

    showOnMap() {
        if (!this.element) {
            return;
        }
        this.element.style.display = 'block';
    }

    generateId(prefix) {
        const timestamp = Date.now().toString(36).slice(4);
        const random = Math.random().toString(36).substring(2,6);
        return `${prefix}_${timestamp}_${random}`;
    }
}

class Marker extends MapObject {
    constructor(map, options) {
        super(map);
        this.id = options.id || this.generateId('id');
        this.lat = options.lat;
        this.lng = options.lng;
        this.title = options.title || '';
        this.color = options.color || '#38F';
        this.popup = options.popup || '';
        this.ico = options.ico || null;
        this.cssClass = options.cssClass || 'simple';
        this.cachePosition = null;

        if (!this.map.isLatlngInBounds(this.lat, this.lng)) {
            return;
        }

        this.createElement();
        this.updatePosition();

        if (options.showPopup) {
            this.showPopup();
        }
    }

    createElement() {
        this.element = document.createElement('div');
        if (this.ico) {
            this.element.style.backgroundImage = `url("${this.ico}")`;
        } else {
            this.element.style.background = `${this.color}`;
        }

        this.element.className = 'marker ' + this.cssClass;

        if (this.title) {
            this.element.title = this.title;
        }

        this.map.markersContainer.appendChild(this.element);

        // Обработчик клика
        if (this.popup) {
            this.element.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showPopup();
            });
            this.element.addEventListener('touchend', (e) => {
                e.stopPropagation();
                this.showPopup();
            });
        }
    }

    getId() {
        return this.id;
    }

    showOnMap() {
        if (!this.element.style) {
            this.createElement();
            this.updatePosition();
        }

        this.element.style.display = 'block';
    }

    showPopup() {
        if (!this.popup) {
            return;
        }

        if (this.element.innerHTML) {
            this.element.innerHTML = '';
            this.element.style.zIndex = 0;
        } else {
            this.element.innerHTML = '<div class="popup" style="border-color: ' + this.color + '">' + this.popup + '</div>';
            this.element.style.zIndex = 1;
        }
    }

    remove() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}
