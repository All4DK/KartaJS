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
            showGrid: (typeof options.showGrid !== 'undefined') && options.showGrid,
        };

        this.tileSize = 256;
        this.isDragging = false;
        this.lastMousePos = { x: 0, y: 0 , lat: 0, lng: 0};
        this.calcOffset(this.options.center);

        this.tiles = new Map(); // Кеш загруженных тайлов
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

    loadTiles(clear = true) {
        // Очищаем старые тайлы
        if (clear){
            this.tilesContainer.innerHTML = '';
            this.tiles.clear();
        }

        const centerPoint = this.latLngToPoint(
            this.options.center[0],
            this.options.center[1],
            this.options.zoom
        );


        // Вычисляем видимую область
        const containerWidth = this.container.offsetWidth;
        const containerHeight = this.container.offsetHeight;

        const centerTileX = Math.floor(centerPoint.x / this.tileSize);
        const centerTileY = Math.floor(centerPoint.y / this.tileSize);

        // Количество тайлов вокруг центра
        const tilesX = Math.ceil(containerWidth / this.tileSize);
        const tilesY = Math.ceil(containerHeight / this.tileSize);

        // Загружаем тайлы
        for (let x = centerTileX-tilesX; x <= centerTileX+tilesX; x++) {
            for (let y = centerTileY-tilesY; y <= centerTileY+tilesY; y++) {
                this.loadTile(x, y, this.options.zoom);
            }
        }

        this.updateMarkersPosition();
    }

    loadTile(x, y, z) {
        const tileKey = `${z}/${x}/${y}`;

        // Проверяем, не загружен ли уже тайл
        if (this.tiles.has(tileKey)) return;

        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.style.cssText = `
            width: ${this.tileSize}px;
            height: ${this.tileSize}px;
        `;

        // Позиционируем тайл
        const offsetX = x * this.tileSize + this.currentOffset.x;
        const offsetY = y * this.tileSize + this.currentOffset.y;

        tile.style.left = offsetX + 'px';
        tile.style.top = offsetY + 'px';

        // Загружаем изображение тайла
        const img = new Image();
        const subdomain = this.options.tileLayer.subdomains ?
            this.options.tileLayer.subdomains[Math.abs(x + y) % this.options.tileLayer.subdomains.length] :
            'a';

        var maxTileNum = Math.pow(2, z);
        const url = (x >= 0 && y >= 0 && x < maxTileNum && y < maxTileNum) ? this.options.tileLayer.url
            .replace('{s}', subdomain)
            .replace('{z}', z)
            .replace('{x}', x)
            .replace('{y}', y) : '';

        tile.style.backgroundColor = '#f0f0f0';
        tile.style.border = '1px solid #ddd';
        if (url) {
            img.src = url;
            img.onload = () => {
                if (!this.options.showGrid) {
                    tile.style.border = '';
                }

                tile.style.backgroundImage = `url(${url})`;
                tile.style.backgroundSize = 'cover';
            };
            img.onerror = () => {
                console.warn('Failed to load tile:', url);
            };
        }

        this.tilesContainer.appendChild(tile);
        this.tiles.set(tileKey, tile);
    }

    setupEvents() {
        // Перетаскивание карты
        this.container.addEventListener('mousedown', this.onMouseDown.bind(this));
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));

        // Зум колесом мыши
        this.container.addEventListener('wheel', this.onWheel.bind(this), { passive: false });

        // Кнопки зума
        this.zoomInBtn.addEventListener('click', () => this.setZoom(this.options.zoom + 1));
        this.zoomOutBtn.addEventListener('click', () => this.setZoom(this.options.zoom - 1));

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

        // Keyboard events
        document.addEventListener('keyup', (e) => {
            if (e.key === 'Escape') {this.hidePopup();}
            // Move the map
            if (e.key === 'ArrowRight') {this.panBy(-10, 0);}
            if (e.key === 'ArrowLeft') {this.panBy(10, 0);}
            if (e.key === 'ArrowUp') {this.panBy(0, 10);}
            if (e.key === 'ArrowDown') {this.panBy(0, -10);}
        });
    }

    onMouseDown(e) {
        this.isDragging = true;
        this.lastMousePos.x = e.clientX;
        this.lastMousePos.y = e.clientY;
        this.container.style.cursor = 'grabbing';
        e.preventDefault();
    }

    onMouseMove(e) {
        const rect = this.container.getBoundingClientRect();
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;
        const coords = this.pointToLatLng(
            clientX - this.currentOffset.x,
            clientY - this.currentOffset.y,
            this.options.zoom
        );

        if (this.options.showLatlngMonitor) {
            this.currentLatlng.innerHTML =
                ((coords.lat > 0) ? 'N:' : 'S:')
                + Math.abs(coords.lat.toFixed(4))
                + ' '
                + ((coords.lng > 0) ? 'E:' : 'W:')
                + Math.abs(coords.lng.toFixed(4));
        }

        if (!this.isDragging) {
            this.lastMousePos.lat = coords.lat;
            this.lastMousePos.lng = coords.lng;
            return;
        }

        const deltaX = clientX - this.lastMousePos.x;
        const deltaY = clientY - this.lastMousePos.y;

        this.lastMousePos.x = clientX;
        this.lastMousePos.y = clientY;

        this.panBy(deltaX, deltaY);
    }

    onMouseUp() {
        this.isDragging = false;
        this.container.style.cursor = 'default';

        // Перезагружаем тайлы
        this.loadTiles(false);
    }

    onWheel(e) {
        e.preventDefault();

        const zoomDelta = e.deltaY > 0 ? -1 : 1;
        const newZoom = Math.max(this.options.minZoom,
                               Math.min(this.options.maxZoom,
                                       this.options.zoom + zoomDelta));

        if (newZoom !== this.options.zoom) {
            this.setZoom(newZoom, true);
        }
    }

    onTouchStart(e) {
        if (e.touches.length === 1) {
            this.isDragging = true;
            this.lastMousePos.x = e.touches[0].clientX;
            this.lastMousePos.y = e.touches[0].clientY;
        }
    }

    onTouchMove(e) {
        if (!this.isDragging || e.touches.length !== 1) return;

        const deltaX = e.touches[0].clientX - this.lastMousePos.x;
        const deltaY = e.touches[0].clientY - this.lastMousePos.y;

        this.lastMousePos.x = e.touches[0].clientX;
        this.lastMousePos.y = e.touches[0].clientY;

        this.panBy(deltaX, deltaY);
    }

    onTouchEnd() {
        this.isDragging = false;

        // Перезагружаем тайлы
        this.loadTiles();
    }

    /**
     * Двигаем карту на некоторую дельту - в пикселях
     * @param deltaX int pixels
     * @param deltaY int pixels
     */
    panBy(deltaX, deltaY) {
        this.currentOffset.x += deltaX;
        this.currentOffset.y += deltaY;

        // Обновляем позиции всех тайлов
        this.tiles.forEach((tile, key) => {
            const [z, x, y] = key.split('/').map(Number);
            const offsetX = x * this.tileSize + this.currentOffset.x;
            const offsetY = y * this.tileSize + this.currentOffset.y;
            tile.style.left = offsetX + 'px';
            tile.style.top = offsetY + 'px';
        });

        // Обновляем центр карты и маркеры
        this.updateCenterFromOffset();
        this.updateMarkersPosition();
    }

    updateCenterFromOffset() {
        const containerWidth = this.container.offsetWidth;
        const containerHeight = this.container.offsetHeight;

        const centerPixelX = -this.currentOffset.x + containerWidth / 2;
        const centerPixelY = -this.currentOffset.y + containerHeight / 2;

        const centerPoint = this.pointToLatLng(
            centerPixelX,
            centerPixelY,
            this.options.zoom
        );

        this.options.center = [centerPoint.lat, centerPoint.lng];
    }

    setZoom(newZoom, byMouse = false) {
        if (newZoom < this.options.minZoom || newZoom > this.options.maxZoom) return;

        const oldZoom = this.options.zoom;
        this.options.zoom = newZoom;

        // Обновляем кнопки зума
        this.zoomInBtn.disabled = newZoom >= this.options.maxZoom;
        this.zoomOutBtn.disabled = newZoom <= this.options.minZoom;

        // При прокрутке колеса мыши, центруем карту по координатам мыши. Ещё хорошо бы сам указатель подвинуть в центр карты.
        if(byMouse) {
            this.setCenter([this.lastMousePos.lat, this.lastMousePos.lng]);
        } else {
            this.setCenter(this.getCenter());
        }

        // Перезагружаем тайлы
        this.loadTiles();
    }

    updateMarkersPosition() {
        this.markerManager.markers.forEach(marker => {
            marker.updatePosition();
        });
    }

    // Публичные методы
    addMarker(options) {
        return this.markerManager.addMarker(options);
    }

    removeMarker(marker) {
        this.markerManager.removeMarker(marker);
    }

    clearMarkers() {
        this.markerManager.clearMarkers();
    }

    setCenter(latlng) {
        this.options.center = latlng;
        this.calcOffset(this.options.center);
        this.loadTiles();
    }

    getCenter() {
        return [...this.options.center];
    }

    calcOffset(latlng) {
        var lat = latlng[0];
        var lng = latlng[1];
        var rect = this.container.getBoundingClientRect();
        var pnt = this.latLngToPoint(
            lat,
            lng,
            this.options.zoom
        );
        this.currentOffset = {x: Math.floor(rect.width / 2)-pnt.x, y: Math.floor(rect.height / 2)-pnt.y}
    }

    getZoom() {
        return this.options.zoom;
    }

    degreesToRadians(deg) {
        return deg * (Math.PI / 180);
    }

    radiansToDegrees(rad) {
        return rad * (180 / Math.PI);
    }

    // Правильная проекция Меркатора
    latLngToPoint(lat, lng, zoom) {
        const scale = 256 * Math.pow(2, zoom);
        const latRad = this.degreesToRadians(lat);

        // Долгота - простое линейное преобразование
        const x = (lng + 180) * (scale / 360);

        // Широта - проекция Меркатора (сжимает у полюсов)
        const mercator = Math.log(Math.tan(Math.PI/4 + latRad/2));
        const y = (scale / 2) - (scale * mercator / (2 * Math.PI));

        return { x, y };
    }

    pointToLatLng(x, y, zoom) {
        const scale = 256 * Math.pow(2, zoom);

        // Обратное преобразование долготы
        const lng = (x / scale) * 360 - 180;

        // Обратное преобразование широты
        const mercator = (scale / 2 - y) * (2 * Math.PI) / scale;
        const latRad = 2 * Math.atan(Math.exp(mercator)) - Math.PI/2;
        const lat = this.radiansToDegrees(latRad);

        return { lat, lng };
    }

    hidePopup() {
        this.popupContainer.style.display = 'none';
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
        }
    }

    updatePosition() {
        if (!this.element) return;

        const point = this.map.latLngToPoint(this.lat, this.lng, this.map.options.zoom);
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
        this.map.popup.innerHTML = this.popup;
        this.map.popupContainer.style.display = 'grid';
    }

    remove() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}

