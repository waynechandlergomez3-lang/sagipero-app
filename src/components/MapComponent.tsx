import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import WebView from 'react-native-webview';
import * as Location from 'expo-location';

type Center = {
  id: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  capacity?: number;
  currentCount?: number;
  isActive?: boolean;
};

type LocationState = {
  latitude: number;
  longitude: number;
};

type MapComponentProps = {
  centers: Center[];
  userLocation: LocationState | null;
  initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  responderLocation?: { lat: number; lng: number } | null;
  navigateTo?: { lat: number; lng: number } | null;
};

export default function MapComponent({ centers, userLocation, initialRegion, responderLocation, navigateTo }: MapComponentProps) {
  const webViewRef = useRef<WebView>(null);
  const [webViewLoaded, setWebViewLoaded] = useState(false);

  useEffect(() => {
    if (userLocation && webViewLoaded) {
      console.log('Updating location on map:', userLocation);
      webViewRef.current?.injectJavaScript(`
        try {
          updateUserLocation(${userLocation.latitude}, ${userLocation.longitude});
        } catch(e) { console.error('injectJS updateUserLocation error', e); }
        true;
      `);
    }
  }, [userLocation, webViewLoaded]);

  // Inject responder location into the WebView when available
  // (removed placeholder) we rely on the responderLocation effect below

  // When responder location updates, inject to webview
  useEffect(() => {
    if (!webViewLoaded) return;
    if (!responderLocation) return;
    try {
      console.log('MapComponent: posting responderLocation to webview', responderLocation);
      // Use postMessage from RN -> webview so the page's document.message listener handles it
      // Primary: postMessage
      webViewRef.current?.postMessage(`inject-responder:${responderLocation.lat},${responderLocation.lng}`);
      // Fallback: directly inject JS which calls the exposed updateResponderLocation if available
      try {
        const js = `if(window && window.updateResponderLocation){window.updateResponderLocation(${responderLocation.lat}, ${responderLocation.lng});} true;`;
        webViewRef.current?.injectJavaScript(js);
      } catch (e) {
        console.warn('MapComponent: injectJavaScript fallback failed', e);
      }
    } catch (e) {
      console.error('MapComponent postMessage responderLocation error', e);
    }
  }, [webViewLoaded, responderLocation]);

  // When parent requests navigation to a center, forward to webview
  useEffect(() => {
    // forward navigation requests to webview
    if (!webViewLoaded) return
    if (!navigateTo) return
    try {
      const msg = `navigate-center:${navigateTo.lat},${navigateTo.lng}`
      webViewRef.current?.postMessage(msg)
      // as fallback, try injecting JS to call routeToCenter directly
      const js = `if(window && window.routeToCenter){window.routeToCenter(${navigateTo.lat}, ${navigateTo.lng});} true;`
      webViewRef.current?.injectJavaScript(js)
    } catch (e) {
      console.warn('navigateTo postMessage failed', e)
    }
  }, [navigateTo, webViewLoaded])

  const centerMarkers = centers.map(center => {
    const cap = center.capacity || 0
    const occ = center.currentCount || 0
    const pct = cap > 0 ? Math.round((occ / cap) * 100) : 0
    let status = 'Available'
    if (pct === 100) status = 'Full'
    else if (pct >= 76) status = 'High'
    else if (pct >= 50) status = 'Limited'
    else status = 'Available'

    return `markers.push(L.marker([${center.location.lat}, ${center.location.lng}], {
      icon: L.icon({
        iconUrl: '${center.isActive ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png' : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png'}',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      })
    }).addTo(map).bindPopup(\`
      <div style="min-width: 200px; padding: 10px;">
        <h3 style="margin: 0 0 8px 0;">${center.name}</h3>
        <p style="margin: 0 0 5px 0; color: #666;">${center.address}</p>
        <div style="font-size:12px;color:#444;margin-bottom:6px">Capacity: ${cap} • Occupied: ${occ} • Available: ${Math.max(0, cap - occ)} • ${center.isActive ? 'Open' : 'Closed'}</div>
        <div style="font-size:12px;color:#333;margin-bottom:6px">Occupancy: ${pct}% (${status})</div>
        <div class="route-info"></div>
      </div>
    \`))`
  }).join(';\n');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
        <style>
          body { 
            margin: 0; 
            padding: 0; 
          }
          #map { 
            height: 100vh; 
            width: 100vw; 
          }
          .center-btn {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: white;
            border: none;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            color: #2196F3;
          }
          .nearest-info {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            padding: 10px 20px;
            border-radius: 20px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            z-index: 1000;
            display: none;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <button class="center-btn" onclick="centerOnUser()">📍</button>
        <div id="nearest-info" class="nearest-info"></div>
        <script>
          // Initialize map
          const map = L.map('map', {
            zoomControl: true,
            dragging: true,
            tap: true
          }).setView([${initialRegion.latitude}, ${initialRegion.longitude}], 13);

          // Notify React Native that the map is ready
          if (window && window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage('map-ready');
          }

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
          }).addTo(map);

          // Custom icons
          const userIcon = L.divIcon({
            className: 'user-marker',
            html: '<div style="background-color: #2196F3; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>',
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          });

          const responderIcon = L.divIcon({
            className: 'responder-marker',
            html: '<div style="background-color: #FF5722; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });

          const evacuationIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          });

          // Global variables
          let userMarker = null;
          let responderMarker = null;
          let currentRoute = null;
          const markers = [];

          function updateUserLocation(lat, lng) {
            // Update or create user marker
            if (userMarker) {
              userMarker.setLatLng([lat, lng]);
            } else {
              userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(map);
              map.setView([lat, lng], 15);
            }

            // Find nearest center and update routes
            try {
              updateRoutes(lat, lng);
              if (window && window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage('user-location-updated:' + lat + ',' + lng);
              }
            } catch (e) {
              if (window && window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage('updateRoutes-error:' + (e && e.message ? e.message : e));
              }
              console.error('updateRoutes error', e);
            }
          }

          function centerOnUser() {
            if (userMarker) {
              map.setView(userMarker.getLatLng(), 15);
            }
          }

          function updateResponderLocation(lat, lng) {
            try {
              if (responderMarker) {
                responderMarker.setLatLng([lat, lng]);
              } else {
                responderMarker = L.marker([lat, lng], { icon: responderIcon }).addTo(map).bindPopup('<div style="min-width:150px;padding:8px">Responder location</div>');
              }
              // ensure responder is visible
              // don't recenter map automatically - let user choose
              if (window && window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage('responder-location-updated:' + lat + ',' + lng);
              }
            } catch (e) {
              console.error('updateResponderLocation error', e);
            }
          }

          function formatDuration(minutes) {
            if (minutes < 60) {
              return \`\${Math.round(minutes)} minutes\`;
            }
            const hours = Math.floor(minutes / 60);
            const remainingMins = Math.round(minutes % 60);
            return \`\${hours} hour\${hours > 1 ? 's' : ''} \${remainingMins} minutes\`;
          }

          async function updateRoutes(userLat, userLng) {
            let nearestCenter = null;
            let shortestTime = Infinity;

            // Remove existing route
            if (currentRoute) {
              map.removeLayer(currentRoute);
            }

            // Update routes and find nearest center
            for (const marker of markers) {
              const centerPos = marker.getLatLng();
              try {
                const response = await fetch(
                  'https://router.project-osrm.org/route/v1/driving/' + userLng + ',' + userLat + ';' + centerPos.lng + ',' + centerPos.lat + '?overview=full&geometries=geojson'
                );
                const data = await response.json();

                if (data.routes && data.routes[0]) {
                  const duration = data.routes[0].duration / 60; // Convert to minutes
                  const distance = data.routes[0].distance / 1000; // Convert to km

                  // Update popup content
                  const popupContent = marker.getPopup().getContent().replace(
                    '<div class="route-info"></div>',
                    '<div class="route-info" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee;">' +
                      '<div style="color: #2196F3;">🕒 ' + formatDuration(duration) + '</div>' +
                      '<div style="color: #666;">📍 ' + distance.toFixed(1) + ' km away</div>' +
                    '</div>'
                  );
                  marker.setPopupContent(popupContent);

                  // Check if this is the nearest center
                  if (duration < shortestTime) {
                    shortestTime = duration;
                    nearestCenter = {
                      marker,
                      route: data.routes[0].geometry
                    };
                  }
                }
              } catch (error) {
                console.error('Error calculating route:', error);
                if (window && window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                  window.ReactNativeWebView.postMessage('route-error:' + (error && error.message ? error.message : error));
                }
              }
            }

            // Draw route to nearest center
            if (nearestCenter) {
              // GeoJSON LineString route: coordinates in [lng, lat]
              const coords = nearestCenter.route.coordinates.map(c => [c[1], c[0]]);
              currentRoute = L.polyline(coords, {
                color: '#2196F3',
                weight: 5,
                opacity: 0.7
              }).addTo(map);

              // Show nearest center info and open popup
              nearestCenter.marker.openPopup();
              document.getElementById('nearest-info').style.display = 'block';
              document.getElementById('nearest-info').innerHTML = 
                \`📍 Nearest: \${formatDuration(shortestTime)} away\`;
            }
          }

          // Route directly to a given center coordinate
          async function routeToCenter(destLat, destLng) {
            try {
              const src = userMarker ? userMarker.getLatLng() : map.getCenter();
              const userLat = src.lat;
              const userLng = src.lng;

              // Remove existing route
              if (currentRoute) map.removeLayer(currentRoute);

              const response = await fetch(
                'https://router.project-osrm.org/route/v1/driving/' + userLng + ',' + userLat + ';' + destLng + ',' + destLat + '?overview=full&geometries=geojson'
              );
              const data = await response.json();
              if (data.routes && data.routes[0]) {
                const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
                currentRoute = L.polyline(coords, { color: '#2196F3', weight: 5, opacity: 0.8 }).addTo(map);

                // Show info
                document.getElementById('nearest-info').style.display = 'block';
                const minutes = (data.routes[0].duration / 60) || 0;
                document.getElementById('nearest-info').innerHTML = '📍 Route: ' + Math.round(minutes) + ' min';

                // Try to open popup on the matching marker (closest by distance)
                let best = null; let bestDist = Infinity;
                for (const m of markers) {
                  const p = m.getLatLng();
                  const d = Math.hypot(p.lat - destLat, p.lng - destLng);
                  if (d < bestDist) { bestDist = d; best = m }
                }
                if (best) best.openPopup();
              }
            } catch (err) { console.error('routeToCenter error', err) }
          }

          // Add evacuation center markers
          ${centerMarkers}
          
          // Expose functions for React Native to update responder location
          if (window && window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.updateResponderLocation = updateResponderLocation;

            // Listen for messages from React Native
            function handleMessageEvent(e) {
              try {
                var data = (e && e.data) ? e.data : null;
                // some RN WebView implementations send the payload directly
                if (!data && e && e.detail) data = e.detail;
                if (typeof data === 'string' && data.startsWith('inject-responder:')) {
                  var parts = data.replace('inject-responder:', '').split(',');
                  var lat = parseFloat(parts[0]);
                  var lng = parseFloat(parts[1]);
                  if (!isNaN(lat) && !isNaN(lng)) {
                    updateResponderLocation(lat, lng);
                  }
                } else if (typeof data === 'string' && data.startsWith('navigate-center:')) {
                  var parts = data.replace('navigate-center:', '').split(',');
                  var lat = parseFloat(parts[0]);
                  var lng = parseFloat(parts[1]);
                  if (!isNaN(lat) && !isNaN(lng) && typeof routeToCenter === 'function') {
                    routeToCenter(lat, lng);
                  }
                }
              } catch(err) { console.error('message handler error', err); }
            }
            document.addEventListener('message', handleMessageEvent);
            window.addEventListener('message', handleMessageEvent);
          }
        </script>
      </body>
    </html>
  `;

  return (
    <View style={{ flex: 1 }}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={{ flex: 1 }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        geolocationEnabled={true}
        onLoadEnd={() => {
          console.log('WebView loaded');
          setWebViewLoaded(true);
        }}
        onMessage={(event) => {
          const msg = event.nativeEvent.data;
          console.log('Message from WebView:', msg);
          if (msg === 'map-ready') {
            // prefer the web page init signal for readiness
            setWebViewLoaded(true);
          }
        }}
      />
    </View>
  );
}
