import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import WebView from 'react-native-webview';

// OpenWeatherMap coordinates for Hagonoy, Bulacan
const HAGONOY_LAT = 14.834;
const HAGONOY_LNG = 120.732;

const WeatherView = () => {
  const [loading, setLoading] = useState(true);

  const html = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
        <style>
          body { 
            margin: 0; 
            padding: 16px; 
            font-family: system-ui; 
            background: #f0f0f0;
            color: #333;
          }
          .weather-widget {
            background: white;
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .location-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
          }
          .location-name {
            font-size: 24px;
            font-weight: bold;
            margin: 0;
          }
          .refresh-button {
            background: #4CAF50;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
          }
          .refresh-button:hover {
            background: #45a049;
          }
          .forecast-item {
            padding: 16px;
            border-radius: 12px;
            margin-bottom: 12px;
            background: linear-gradient(to right, #f8f9fa, #ffffff);
            border: 1px solid #e9ecef;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            align-items: center;
          }
          .forecast-item:last-child {
            margin-bottom: 0;
          }
          .weather-icon {
            font-size: 32px;
            margin-right: 12px;
            color: #666;
          }
          .temperature {
            font-size: 20px;
            font-weight: bold;
            color: #2196F3;
          }
          .weather-details {
            color: #666;
            margin-top: 8px;
          }
          .wind-info {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #666;
            margin-top: 4px;
          }
          .chart-container {
            padding: 16px;
            margin-top: 20px;
          }
          .date-label {
            font-weight: 500;
            color: #333;
            margin-bottom: 4px;
          }
          .last-updated {
            font-size: 12px;
            color: #666;
            text-align: right;
            margin-top: 8px;
          }
        </style>
      </head>
      <body>
        <div class="weather-widget">
          <div class="location-header">
            <h2 class="location-name">Hagonoy, Bulacan</h2>
            <button class="refresh-button" onclick="fetchWeatherData()">
              <i class="fas fa-sync-alt"></i> Refresh
            </button>
          </div>
          <div id="forecast-data">Loading...</div>
          <div id="last-updated"></div>
        </div>
        <div class="weather-widget">
          <h2>5-Day Temperature Trend</h2>
          <div class="chart-container">
            <canvas id="forecast-chart"></canvas>
          </div>
        </div>
        <script>
          function getWeatherIcon(code) {
            // Map weather codes to Font Awesome icons
            const iconMap = {
              0: 'sun', // Clear sky
              1: 'sun', // Mainly clear
              2: 'cloud-sun', // Partly cloudy
              3: 'cloud', // Overcast
              45: 'smog', // Foggy
              48: 'smog', // Depositing rime fog
              51: 'cloud-rain', // Light drizzle
              53: 'cloud-rain', // Moderate drizzle
              55: 'cloud-showers-heavy', // Dense drizzle
              61: 'cloud-rain', // Slight rain
              63: 'cloud-showers-heavy', // Moderate rain
              65: 'cloud-showers-heavy', // Heavy rain
              80: 'cloud-rain', // Slight rain showers
              81: 'cloud-showers-heavy', // Moderate rain showers
              82: 'cloud-showers-heavy', // Violent rain showers
              95: 'bolt', // Thunderstorm
              96: 'cloud-bolt', // Thunderstorm with hail
              99: 'cloud-bolt' // Thunderstorm with heavy hail
            };
            return \`fas fa-\${iconMap[code] || 'cloud'}\`;
          }

          function getMostFrequentWeatherCode(codes) {
            const frequency = {};
            let maxFreq = 0;
            let mostFrequent = codes[0];
            
            codes.forEach(code => {
              frequency[code] = (frequency[code] || 0) + 1;
              if (frequency[code] > maxFreq) {
                maxFreq = frequency[code];
                mostFrequent = code;
              }
            });
            
            return mostFrequent;
          }

          function getWindDirection(degrees) {
            const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                              'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
            const index = Math.round(((degrees + 11.25) % 360) / 22.5);
            return directions[index % 16];
          }
          
          const lat = ${HAGONOY_LAT};
          const lon = ${HAGONOY_LNG};

          function fetchWeatherData() {
            document.getElementById('forecast-data').innerHTML = '<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
            
            // Use Open-Meteo API for worldwide weather data with more detailed parameters
            fetch(\`https://api.open-meteo.com/v1/forecast?latitude=\${lat}&longitude=\${lon}&hourly=temperature_2m,weathercode,windspeed_10m,winddirection_10m,precipitation_probability&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&current_weather=true&timezone=Asia/Manila\`)
            .then(res => res.json())
            .then(data => {
              const today = new Date();
              const next5Days = Array.from({length: 5}, (_, i) => {
                const date = new Date(today);
                date.setDate(date.getDate() + i);
                return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              });

              // Map weather codes to descriptions
              const weatherDescriptions = {
                0: 'Clear sky',
                1: 'Mainly clear',
                2: 'Partly cloudy',
                3: 'Overcast',
                45: 'Foggy',
                48: 'Depositing rime fog',
                51: 'Light drizzle',
                53: 'Moderate drizzle',
                55: 'Dense drizzle',
                61: 'Slight rain',
                63: 'Moderate rain',
                65: 'Heavy rain',
                80: 'Slight rain showers',
                81: 'Moderate rain showers',
                82: 'Violent rain showers',
                95: 'Thunderstorm',
                96: 'Thunderstorm with hail',
                99: 'Thunderstorm with heavy hail'
              };

              // Display forecast information
              const forecastHtml = next5Days
                .map((date, i) => {
                  // Get the weather codes for each 6-hour interval of the day
                  const dayStart = i * 24;
                  const weatherCodes = data.hourly.weathercode.slice(dayStart, dayStart + 24);
                  // Get the most frequent weather code for the day
                  const weatherCode = getMostFrequentWeatherCode(weatherCodes);
                  
                  const maxTemp = Math.round(data.daily.temperature_2m_max[i]);
                  const minTemp = Math.round(data.daily.temperature_2m_min[i]);
                  const windSpeed = Math.round(data.hourly.windspeed_10m[i * 24]);
                  const windDir = data.hourly.winddirection_10m[i * 24];
                  const precipProb = Math.round(data.daily.precipitation_probability_max[i]);
                  
                  return \`
                    <div class="forecast-item">
                      <div>
                        <div class="date-label">\${date}</div>
                        <div class="temperature">
                          <span style="color: #e74c3c">\${maxTemp}°C</span> / 
                          <span style="color: #3498db">\${minTemp}°C</span>
                        </div>
                        <div class="wind-info">
                          <i class="fas fa-wind"></i>
                          \${windSpeed} km/h \${getWindDirection(windDir)}
                        </div>
                        <div style="color: #666; margin-top: 4px;">
                          <i class="fas fa-umbrella"></i>
                          Precipitation: \${precipProb}%
                        </div>
                      </div>
                      <div style="text-align: right;">
                        <i class="\${getWeatherIcon(weatherCode)} weather-icon"></i>
                        <div class="weather-details">\${weatherDescriptions[weatherCode] || 'Unknown weather'}</div>
                      </div>
                    </div>
                  \`;
                }).join('');

              document.getElementById('forecast-data').innerHTML = forecastHtml;
              document.getElementById('last-updated').innerHTML = \`
                <div class="last-updated">
                  Last updated: \${new Date().toLocaleString('en-US', { 
                    timeZone: 'Asia/Manila',
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </div>
              \`;

              // Create temperature chart
              const maxTemps = data.daily.temperature_2m_max.slice(0, 5);
              const minTemps = data.daily.temperature_2m_min.slice(0, 5);
              const labels = next5Days;
              
              new Chart(document.getElementById('forecast-chart'), {
                type: 'line',
                data: {
                  labels: labels,
                  datasets: [
                    {
                      label: 'High °C',
                      data: maxTemps,
                      borderColor: 'rgb(255, 99, 132)',
                      tension: 0.1
                    },
                    {
                      label: 'Low °C',
                      data: minTemps,
                      borderColor: 'rgb(75, 192, 192)',
                      tension: 0.1
                    }
                  ]
                },
                options: {
                  responsive: true,
                  plugins: {
                    title: {
                      display: true,
                      text: '5-Day Temperature Forecast'
                    }
                  }
                }
              });
            })
            .catch(error => {
              document.getElementById('forecast-data').innerHTML = \`
                <div style="text-align: center; padding: 20px;">
                  <i class="fas fa-exclamation-circle" style="color: #e74c3c; font-size: 48px; margin-bottom: 16px;"></i>
                  <p style="color: #e74c3c; font-size: 16px;">Failed to load weather data.</p>
                  <p style="color: #666; font-size: 14px;">Please try again later.</p>
                </div>
              \`;
              console.error('Error:', error);
            });
          }
          
          // Initial fetch
          fetchWeatherData();
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        source={{ html }}
        style={styles.webview}
        onLoadEnd={() => setLoading(false)}
      />
      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  webview: {
    flex: 1,
  },
  loading: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
  }
});

export default WeatherView;
