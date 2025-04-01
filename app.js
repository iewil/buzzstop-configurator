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
  if (prefs.SERVICE) document.getElementById('serviceNo').value = prefs.SERVICE;
  if (prefs.START) document.getElementById('startTime').value = formatTime(Number(prefs.START));
  if (prefs.END) document.getElementById('endTime').value = formatTime(Number(prefs.END));
  if (prefs.LEADTIME) document.getElementById('leadTime').value = prefs.LEADTIME;
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
        log(value);
        if (serialBuffer.includes("LEADTIME=")) {
          applyPreferences(serialBuffer);
          serialBuffer = "";
        }
      }
    }
  } catch (e) {
    log('Read error: ' + e.message);
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

document.getElementById('connectBtn').addEventListener('click', connectDevice);

document.getElementById('submitBtn').addEventListener('click', () => {
  const busStop = document.getElementById('busStop').value.trim();
  const serviceNo = document.getElementById('serviceNo').value.trim();
  const startTime = document.getElementById('startTime').value.trim();
  const endTime = document.getElementById('endTime').value.trim();
  const leadTime = document.getElementById('leadTime').value.trim();
  const wifiSSID = document.getElementById('wifiSSID').value.trim(); 
  const wifiPassword = document.getElementById('wifiPassword').value.trim(); 


  if (!busStop || !serviceNo || !startTime || !endTime || !leadTime) {
    alert('Please fill in all fields.');
    return;
  }

  sendCommand(`SET_BUSSTOP=${busStop}`);
  sendCommand(`SET_SERVICE=${serviceNo}`);
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
