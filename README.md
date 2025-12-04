# KartaJS 🗺️

A lightweight, dependency-free JavaScript library for interactive maps

KartaJS is a minimal yet powerful mapping library built with pure JavaScript. No dependencies, no bloat - just essential mapping features in a tiny package.


## ✨ Features

    🚀 Ultra-lightweight - Only ~5KB gzipped

    🧩 Zero dependencies - Pure vanilla JS, no dependencies

    🎯 Simple API - Intuitive and easy to learn

    📍 Custom markers - Colors, icons, CSS classes, HTML popups

    🎨 Flexible styling - CSS-based customization

    📱 Mobile friendly - Touch gestures, pinch-to-zoom

    🗂️ Multiple tile layers - OSM, CartoDB, OpenTopoMap support


## 🚀 Quick Start

To begin with, add karta.js and karts.css to the page and create container for the map.
```html
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KartaJS Demo</title>
    <style>
        body {width: 100%;padding: 5px 0;margin: 0;}
        #map {width: 100vw;height: 70vh;border: 1px solid #ccc;}
    </style>
    
    <link rel="stylesheet" type="text/css" href="src/karta.css">
    <script type="text/javascript" src="src/karta.js"></script>
</head>
<body>
    <h1>KartaJS Demo</h1>
    <div id="map"></div>
    <script>
        const map = new KartaJS('map', {
            zoom: 18,
            markers: [
                {title: 'Bank', lat: 59.9078, lng: 10.7429, color: 'orange', popup: 'The bank', showPopup: true},
                {title: 'Office', lat: 59.909, lng: 10.7452, color: 'green', popup: 'The office'},
                {title: 'Customer', lat: 59.9084, lng: 10.7429, popup: 'Customer'},
            ],
        });
    </script>
</body>
</html>
```

<details>
    <summary>Add new markers</summary>

```javascript
    <script>
        // Simplest marker
        map.addMarker({title: 'India - Taj Mahal', lat: 27.1750, lng: 78.0420});
        
        // Marker with green icon and popup
        map.addMarker({title: 'Russia - Moscow Kremlin', lat: 55.7532, lng: 37.6187, color: 'green', popup: 'Moscow the capital of Russia'});
        
        // Marker with opened popup
        map.addMarker({title: 'Spain - Sagrada Familia', lat: 41.403630, lng: 2.174360, popup: 'Spain - Sagrada Familia', showPopup: true});
    </script>
```
</details>


<details>
    <summary>Static map (not interactive)</summary>
    You can hide the controls and disable map zooming.

```javascript
    <script>
        const map = new KartaJS('map', {
            center: [47, 10]
            zoom: 4,
            interactive: false,
        });
    </script>
```
</details>

<details>
    <summary>Show Lat-Lng monitor</summary>
    Display the geographic coordinates (e.g., latitude/longitude) at the cursor location or screen tap location.

```javascript
    <script>
        const map = new KartaJS('map', {
            center: [47, 10]
            zoom: 4,
            showLatlngMonitor: true,
        });
    </script>
```
</details>

You can use various tile sources. Here are examples:

<details>
    <summary>Dark tiles</summary>

```javascript
    <script>
        const map = new KartaJS('map', {
            tileLayer: {
                url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                attribution: '© <a href="https://osm.org" target="_blank">OpenStreetMap</a> | © <a href="https://carto.com/" target="_blank">CartoDB</a> - Dark Matter',
                subdomains: ['a', 'b', 'c']
            },
            center: [47, 10]
            zoom: 4,
        });
    </script>
```
</details>

<details>
    <summary>Light tiles</summary>

```javascript
    <script>
        const map = new KartaJS('map', {
            tileLayer: {
                url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                attribution: '© <a href="https://osm.org" target="_blank">OpenStreetMap</a> | © <a href="https://carto.com/" target="_blank">CartoDB</a> - Positron',
                subdomains: ['a', 'b', 'c']
            },
            center: [47, 10]
            zoom: 4,
        });
    </script>
```
</details>

<details>
    <summary>Topographic tiles</summary>

```javascript
    <script>
        const map = new KartaJS('map', {
            tileLayer: {
                url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
                attribution: '© <a href="https://osm.org" target="_blank">OpenStreetMap</a> | © <a href="https://opentopomap.org/" target="_blank">OpenTopoMap</a>',
                subdomains: ['a', 'b', 'c']
            },
            center: [47, 10]
            zoom: 4,
        });
    </script>
```
</details>


## 🎯 Browser Support

    Chrome 60+ (2017)

    Firefox 55+ (2017)

    Safari 12+ (2018)

    Edge 79+ (2020)


## 📄 License

Attribution Required - You must include attribution to both:

    The tile layer provider (e.g., "© OpenStreetMap")

    KartaJS with link to GitHub repository

Free to use in personal and commercial projects.


## 🤝 Contributing

Contributions welcome! Feel free to:

    Report bugs and issues

    Suggest new features

    Submit pull requests

    Improve documentation

## 🌐 Live Demo

Check out the [live demo](https://all4dk.github.io/KartaJS/) to see KartaJS in action!

KartaJS - Making web mapping simple and lightweight!