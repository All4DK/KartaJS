class KartaJS {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            center: options.center || [0, 0],
            zoom: options.zoom || 5,
            minZoom: options.minZoom || 1,
            maxZoom: options.maxZoom || 18,
            tileLayer: options.tileLayer || {
                url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                attribution: '© <a href="https://osm.org" target="_blank">OpenStreetMap</a>',
                subdomains: ['a', 'b', 'c']
            },
            showLatlngMonitor: (typeof options.showLatlngMonitor !== 'undefined') && options.showLatlngMonitor,
        };

        this.tileSize = 256;
        this.isDragging = false;
        this.lastMousePos = {x: 0, y: 0, lat: 0, lng: 0};
        this.calcOffset(this.options.center);
        this.clearTimer = null;
        this.loadTimer = null;
        this.tiles = new Map(); // Tiles cache
        this.queuedTiles = 0; // Counting tiles in queue or while loading
        this.markerManager = new MarkerManager(this);
        this.init();
    }

    init() {
        this.createContainer();
        this.loadTiles();
        this.setupEvents();
    }

    createContainer() {
        this.container.style.position = 'relative';
        this.container.style.overflow = 'hidden';
        this.container.style.cursor = 'default';
        this.container.innerHTML = `
            <div class="kjs-tiles-container"></div>
            <div class="kjs-markers-container"></div>
            <div class="kjs-controls">
                <button class="kjs-zoom-in">▲</button>
                <button class="kjs-zoom-out">▼</button>
            </div>
            <div class="kjs-copyrighths">` + this.options.tileLayer.attribution + ` | <a href="https://github.com/All4DK/KartaJS" target="_blank">KartaJS</a></div>`;

        if (this.options.showLatlngMonitor) {
            this.container.innerHTML += '<div class="kjs-current-latlng">N:0.00 E:0.00</div>';
        }
        this.container.innerHTML += '' +
            '<div class="kjs-popup-container">' +
            '   <div class="popup"></div>' +
            '</div>';

        this.tilesContainer = this.container.querySelector('.kjs-tiles-container');
        this.markersContainer = this.container.querySelector('.kjs-markers-container');
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
        const centerPoint = this.latLngToPoint(...this.options.center, this.options.zoom);
        // Вычисляем видимую область
        const containerWidth = this.container.offsetWidth;
        const containerHeight = this.container.offsetHeight;

        const centerTileX = Math.floor(centerPoint.x / this.tileSize);
        const centerTileY = Math.floor(centerPoint.y / this.tileSize);

        // Количество тайлов вокруг центра
        const tilesX = Math.ceil((containerWidth / this.tileSize) / 2) + 1;
        const tilesY = Math.ceil((containerHeight / this.tileSize) / 2) + 1;

        // Загружаем тайлы
        for (let x = centerTileX - tilesX; x <= centerTileX + tilesX; x++) {
            for (let y = centerTileY - tilesY; y <= centerTileY + tilesY; y++) {
                this.loadTile(x, y, this.options.zoom);
            }
        }

        this.updateMarkersPosition();
        this.panBy();
        this.clearOldTiles();
    }

    loadTile(x, y, z) {
        const tileKey = `${z}/${x}/${y}`;

        // Проверяем, не загружен ли уже тайл
        if (this.tiles.has(tileKey)) {
            return;
        }

        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.style.cssText = `width: ${this.tileSize}px; height: ${this.tileSize}px;`;
        tile.setAttribute('zoom', z);

        // Позиционируем тайл
        tile.style.left = x * this.tileSize + 'px';
        tile.style.top = y * this.tileSize + 'px';

        // Загружаем изображение тайла
        const img = new Image();
        const subdomain = this.options.tileLayer.subdomains ?
            this.options.tileLayer.subdomains[Math.abs(x + y) % this.options.tileLayer.subdomains.length] :
            'a';

        let maxTileNum = Math.pow(2, z);
        const url = (x >= 0 && y >= 0 && x < maxTileNum && y < maxTileNum) ? this.options.tileLayer.url
            .replace('{s}', subdomain)
            .replace('{z}', z)
            .replace('{x}', x)
            .replace('{y}', y) : '';

        tile.style.backgroundColor = 'transparent';
        if (url) {
            img.src = url;
            this.queuedTiles++;
            img.onload = () => {
                tile.style.backgroundImage = `url(${url})`;
                tile.style.backgroundSize = 'cover';
                this.queuedTiles--;
                this.clearOldTiles();
            };
            img.onerror = () => {
                console.warn('Failed to load tile:', url);
                this.queuedTiles--;
                this.clearOldTiles();
            };
        }

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
        }, 300);
    }

    setupEvents() {
        // Перетаскивание карты
        this.container.addEventListener('mousedown', this.onMouseDown.bind(this));
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));

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
        });
    }

    onMouseDown(e) {
        e.preventDefault();
        this.isDragging = true;
        this.container.style.cursor = 'grabbing';
    }

    onMouseMove(e) {
        const coords = this.pointToCoords(e.clientX, e.clientY);
        this.updateLatlngMonitor(coords);
        this.setMousePos(coords);

        if (this.isDragging) {
            this.panBy(coords.deltaX, coords.deltaY);
        }
    }

    onMouseUp() {
        this.isDragging = false;
        this.container.style.cursor = 'default';

        this.loadTiles();
    }

    onWheel(e) {
        e.preventDefault();
        const zoomDelta = e.deltaY > 0 ? -1 : 1;
        this.setZoom(this.getZoom() + zoomDelta, true);
    }

    onTouchStart(e) {
        e.preventDefault();

        if (e.touches.length === 1) {
            this.isDragging = true;
            const coords = this.pointToCoords(e.touches[0].clientX, e.touches[0].clientY);
            this.setMousePos(coords);
            this.updateLatlngMonitor(coords);
        }

        if (e.touches.length === 2) {
            this.isZooming = true;
            this.startTouchDistance = this.getTouchDistance(e.touches);
            this.lastTouchDistance = this.getTouchDistance(e.touches);
        }
    }

    onTouchMove(e) {
        e.preventDefault();

        if (this.isDragging && e.touches.length === 1) {
            const coords = this.pointToCoords(e.touches[0].clientX, e.touches[0].clientY);
            this.setMousePos(coords);
            this.panBy(coords.deltaX, coords.deltaY);
        }

        if (this.isZooming && e.touches.length === 2) {
            this.lastTouchDistance = this.getTouchDistance(e.touches);
            const zoomDelta = (this.startTouchDistance / this.lastTouchDistance);
            if (zoomDelta < 0.8) {
                this.zoomIn();
                this.startTouchDistance = this.lastTouchDistance
            }
            if (zoomDelta > 1.2) {
                this.zoomOut();
                this.startTouchDistance = this.lastTouchDistance
            }
        }
    }

    onTouchEnd() {
        this.isDragging = false;
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
        this.updateMarkersPosition();
    }

    /**
     * Обновляет текущие координаты центра центра карты
     */
    updateCenterFromOffset() {
        const containerWidth = this.container.offsetWidth;
        const containerHeight = this.container.offsetHeight;

        const centerPixelX = -this.currentOffset.x + containerWidth / 2;
        const centerPixelY = -this.currentOffset.y + containerHeight / 2;

        const centerPoint = this.pointToLatLng(centerPixelX, centerPixelY);

        this.options.center = [centerPoint.lat, centerPoint.lng];
    }

    zoomIn() {
        this.setZoom(this.getZoom() + 1);
    }

    zoomOut() {
        this.setZoom(this.getZoom() - 1);
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

        this.updateMarkersPosition();

        // Resize existing tiles before loading new ones
        this.tiles.forEach((tile, key) => {
            const [z, x, y] = key.split('/').map(Number);
            const zoomDelta = this.getZoom() - z;
            const multiplier = Math.pow(2, zoomDelta);

            const offsetX = x * this.tileSize * multiplier * Math.abs(this.getZoom() - z) + this.currentOffset.x;
            const offsetY = y * this.tileSize * multiplier * Math.abs(this.getZoom() - z) + this.currentOffset.y;
            tile.style.left = offsetX + 'px';
            tile.style.top = offsetY + 'px';
            tile.style.width = (this.tileSize * Math.pow(multiplier, Math.abs(this.getZoom() - z))) + 'px';
            tile.style.height = (this.tileSize * Math.pow(multiplier, Math.abs(this.getZoom() - z))) + 'px';
        });

        // "setTimeout" is used to skip unnecessary levels when zooming quickly
        clearTimeout(this.loadTimer);
        this.loadTimer = setTimeout(() => {
            this.loadTiles();
        }, 500);
    }

    getZoom() {
        return this.options.zoom;
    }

    updateMarkersPosition() {
        this.markerManager.markers.forEach(marker => {
            marker.updatePosition();
        });
    }

    addMarker(options) {
        return this.markerManager.addMarker(options);
    }

    removeMarker(marker) {
        this.markerManager.removeMarker(marker);
    }

    clearMarkers() {
        this.markerManager.clearMarkers();
    }

    setCenter(latlng = [0, 0]) {
        this.options.center = latlng;
        this.calcOffset(this.options.center);
    }

    getCenter() {
        return [...this.options.center];
    }

    calcOffset(latlng = [0, 0]) {
        const lat = latlng[0];
        const lng = latlng[1];
        const rect = this.container.getBoundingClientRect();
        const pnt = this.latLngToPoint(
            lat,
            lng,
            this.options.zoom
        );
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

        return {x, y};
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

        return {lat, lng};
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
}

class MarkerManager {
    constructor(map) {
        this.map = map;
        this.markers = [];
    }

    addMarker(options) {
        const marker = new Marker(this.map, options);
        this.markers.push(marker);
        return marker;
    }

    removeMarker(marker) {
        const index = this.markers.indexOf(marker);
        if (index > -1) {
            marker.remove();
            this.markers.splice(index, 1);
        }
    }

    clearMarkers() {
        this.markers.forEach(marker => marker.remove());
        this.markers = [];
    }
}

class Marker {
    constructor(map, options) {
        this.map = map;
        this.lat = options.lat;
        this.lng = options.lng;
        this.title = options.title || '';
        this.color = options.color || '#38F';
        this.popup = options.popup || null;
        this.ico = options.ico || null;
        this.cssClass = options.cssClass || 'simple';

        this.createElement();
        this.updatePosition();
    }

    createElement() {
        if (this.ico) {
            this.element = document.createElement('img');
            this.element.src = this.ico;
        } else {
            this.element = document.createElement('div');
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
            this.element.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                this.showPopup();
            });
        }
    }

    updatePosition() {
        if (!this.element) {
            return;
        }

        const point = this.map.latLngToPoint(this.lat, this.lng, this.map.getZoom());
        const centerPoint = this.map.latLngToPoint(
            this.map.options.center[0],
            this.map.options.center[1],
            this.map.options.zoom
        );

        const offsetX = point.x - centerPoint.x + (this.map.container.offsetWidth / 2);
        const offsetY = point.y - centerPoint.y + (this.map.container.offsetHeight / 2);

        this.element.style.left = offsetX + 'px';
        this.element.style.top = offsetY + 'px';
    }

    showPopup() {
        this.map.showPopup(this.popup);
    }

    remove() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}
