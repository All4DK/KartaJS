# KartaJS 🗺️

A lightweight, dependency-free JavaScript library for interactive maps

KartaJS is a minimal yet powerful mapping library built with pure JavaScript. No dependencies, no bloat - just essential mapping features in a tiny package.


## ✨ Features

    🚀 Ultra-lightweight - Only ~5KB gzipped

    🧩 Zero dependencies - Pure vanilla JS, no dependencies

    🎯 Simple API - Intuitive and easy to learn

    🖱️ Smooth interactions - Dragging, mouse wheel zoom, touch support

    📍 Custom markers - Colors, icons, CSS classes, HTML popups

    🎨 Flexible styling - CSS-based customization

    📱 Mobile friendly - Touch gestures, pinch-to-zoom

    🗂️ Multiple tile layers - OSM, CartoDB, OpenTopoMap support

    📱 Touch friendly - Mobile-ready with touch gestures

    ⌨️ Keyboard navigation - Arrow keys, ESC to close popups


## 🚀 Quick Start

```
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
    <script src="src/karta.js" type="text/javascript"></script>
</head>
<body>
    <div id="map"></div>

    <script>
        const map = new KartaJS('map', {
            center: [50, 30], // Center of the map
            zoom: 4
        });

        // Simplest marker
        map.addMarker({title: 'India - Taj Mahal', lat: 27.1750, lng: 78.0420});

        // Marker with green icon and popup
        map.addMarker({title: 'Russia - Moscow Kremlin', lat: 55.7532, lng: 37.6187, color: 'green', popup: 'Moscow the capital of Russia'});

        // Marker with icon image
        map.addMarker({title: 'Russia - Hermitage Museum', lat: 59.9405, lng: 30.3137, ico: 'img/museum.png', cssClass: 'icon', popup: 'Museum'});
    </script>
</body>
</html>
```


## 🎯 Browser Support

    Chrome 60+

    Firefox 55+

    Safari 12+

    Edge 79+


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