let port;
let writer;
let serialBuffer = "";

function formatTime(minutes) {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function applyPreferences(prefText) {
  const lines = prefText.trim().split('\n');
  const prefs = {};

  lines.forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) prefs[key.trim()] = value.trim();
  });

  if (prefs.BUSSTOP) document.getElementById('busStop').value = prefs.BUSSTOP;
  if (prefs.SERVICE_1) document.getElementById('serviceNo1').value = prefs.SERVICE_1;
  if (prefs.SERVICE_2) document.getElementById('serviceNo2').value = prefs.SERVICE_2;
  if (prefs.START) document.getElementById('startTime').value = formatTime(Number(prefs.START));
  if (prefs.END) document.getElementById('endTime').value = formatTime(Number(prefs.END));
  if (prefs.WIFI_SSID) document.getElementById('wifiSSID').value = prefs.WIFI_SSID;
  if (prefs.WIFI_PASSWORD) document.getElementById('wifiPassword').value = prefs.WIFI_PASSWORD;
}

async function connectDevice() {
  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
    writer = port.writable.getWriter();
    document.getElementById('connectBtn').disabled = true;
    document.getElementById('submitBtn').disabled = false;
    readSerial();
    log('Connected to ESP32');
    await sendCommand('GET_PREFS');
  } catch (e) {
    log('Error connecting: ' + e.message);
  }
}

async function disconnectDevice() {
  try {
    if (writer) {
      await writer.close();
      writer.releaseLock();
    }
    if (port) {
      await port.close();
    }
    port = null;
    writer = null;
    document.getElementById('connectBtn').disabled = false;
    document.getElementById('disconnectBtn').disabled = true;
    document.getElementById('submitBtn').disabled = true;
    log('Disconnected from ESP32\n');
  } catch (e) {
    log('Error disconnecting: ' + e.message + '\n');
  }
}

async function sendCommand(command) {
  const encoder = new TextEncoder();
  await writer.write(encoder.encode(command + '\n'));
}

async function readSerial() {
  const textDecoder = new TextDecoderStream();
  const reader = textDecoder.readable.getReader();
  port.readable.pipeTo(textDecoder.writable);

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        serialBuffer += value;
        log(value); // Log raw incoming data

        // Split buffer by newlines and process complete lines
        let lines = serialBuffer.split('\n');
        let completeLines = lines.slice(0, -1); // All but the last (incomplete) line
        serialBuffer = lines[lines.length - 1]; // Keep incomplete line in buffer

        for (let line of completeLines) {
          line = line.trim();
          if (line) {
            // Check if this line is a preference
            if (line.includes('=')) {
              // Store the line temporarily and check if we have a full set
              applySinglePreference(line);
            }
          }
        }

        // Check if we have a complete set of preferences
        if (serialBuffer.includes("WIFI_PASSWORD=") || completeLines.some(line => line.includes("WIFI_PASSWORD="))) {
          applyPreferencesFromBuffer();
          serialBuffer = ""; // Reset buffer after applying all preferences
        }
      }
    }
  } catch (e) {
    log('Read error: ' + e.message + '\n');
  } finally {
    reader.releaseLock();
  }
}

function log(message) {
  const output = document.getElementById('output');
  output.textContent += message;
  output.scrollTop = output.scrollHeight;
}

function parseTime(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours * 60) + minutes;
}

function applySinglePreference(line) {
  const [key, value] = line.split('=');
  if (key && value) {
    switch (key.trim()) {
      case 'BUSSTOP':
        document.getElementById('busStop').value = value.trim();
        break;
      case 'SERVICE1':
        document.getElementById('serviceNo1').value = value.trim();
        break;
      case 'SERVICE2':
        document.getElementById('serviceNo2').value = value.trim();
        break;
      case 'START':
        document.getElementById('startTime').value = formatTime(Number(value.trim()));
        break;
      case 'END':
        document.getElementById('endTime').value = formatTime(Number(value.trim()));
        break;
      case 'LEADTIME':
        document.getElementById('leadTime').value = value.trim();
        break;
      case 'WIFI_SSID':
        document.getElementById('wifiSSID').value = value.trim();
        break;
      case 'WIFI_PASSWORD':
        document.getElementById('wifiPassword').value = value.trim();
        break;
    }
  }
}

// Helper function to apply all preferences from the buffer (if needed)
function applyPreferencesFromBuffer() {
  const lines = serialBuffer.split('\n');
  lines.forEach(line => {
    line = line.trim();
    if (line.includes('=')) {
      applySinglePreference(line);
    }
  });
}

document.getElementById('connectBtn').addEventListener('click', connectDevice);
document.getElementById('disconnectBtn').addEventListener('click', disconnectDevice);

document.getElementById('submitBtn').addEventListener('click', () => {
  const busStop = document.getElementById('busStop').value.trim();
  const serviceNo1 = document.getElementById('serviceNo1').value.trim();
  const serviceNo2 = document.getElementById('serviceNo2').value.trim();
  const startTime = document.getElementById('startTime').value.trim();
  const endTime = document.getElementById('endTime').value.trim();
  const leadTime = document.getElementById('leadTime').value.trim();
  const wifiSSID = document.getElementById('wifiSSID').value.trim(); 
  const wifiPassword = document.getElementById('wifiPassword').value.trim(); 


  if (!busStop || (!serviceNo1 || !serviceNo2) || !startTime || !endTime || !leadTime) {
    alert('Please fill in all fields.');
    return;
  }

  sendCommand(`SET_BUSSTOP=${busStop}`);
  sendCommand(`SET_SERVICE1=${serviceNo1}`);
  sendCommand(`SET_SERVICE2=${serviceNo2}`);
  sendCommand(`SET_START=${parseTime(startTime)}`);
  sendCommand(`SET_END=${parseTime(endTime)}`);
  sendCommand(`SET_LEADTIME=${leadTime}`);
  sendCommand(`SET_WIFI_SSID=${wifiSSID}`); 
  sendCommand(`SET_WIFI_PASSWORD=${wifiPassword}`); 
});

// Placeholder for Find Nearby Bus Stops
document.getElementById('findNearbyBtn').addEventListener('click', () => {
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser.');
    return;
  }

  navigator.geolocation.getCurrentPosition(async (position) => {
    const { latitude, longitude } = position.coords;
    log(`Your location: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}\n`);
    const resultsDiv = document.getElementById('busStopResults');
    resultsDiv.innerHTML = '<em>(Nearby bus stop logic not implemented)</em>';
  }, (error) => {
    alert('Unable to retrieve your location: ' + error.message);
  });
});
