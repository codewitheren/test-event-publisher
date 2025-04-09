const express = require('express');
const bodyParser = require('body-parser');
const stan = require('node-nats-streaming');

const app = express();
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

const PORT = 3737;

app.get('/', (req, res) => {
  let scriptTag = '';
  if (req.query.script) {
    scriptTag = `<script>${decodeURIComponent(req.query.script)}</script>`;
    
    res.send(`
      <html>
      <head>
        <meta http-equiv="refresh" content="0;url=/" />
        <title>Redirecting...</title>
      </head>
      <body>
        ${req.query.message || ''}
        ${scriptTag}
      </body>
      </html>
    `);
    return;
  }

  res.send(`
    <html>
    <head>
      <title>EventTest</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.css">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/theme/dracula.min.css">
      <style>
        body { font-family: sans-serif; max-width: 800px; margin: auto; padding: 30px; }
        input, button { width: 100%; padding: 10px; margin: 10px 0; }
        .CodeMirror { height: 200px; margin: 10px 0; border: 1px solid #ddd; }
        .success { color: green; }
        .error { color: red; }
        h2 { text-align: center; }
        form { background: #f9f9f9; padding: 20px; }
        label { font-weight: bold; }
        button { background: #007bff; color: white; border: none; cursor: pointer; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        tr:hover { background-color: #f5f5f5; cursor: pointer; }
        .truncate { max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .controls { display: flex; justify-content: space-between; margin-top: 10px; }
        .controls button { width: auto; padding: 5px 10px; }
        .settings-panel { margin-top: 20px; padding: 15px; background: #f0f0f0;  }
        .settings-panel h3 { margin-top: 0; }
        .settings-panel .setting-row { display: flex; margin-bottom: 10px; }
        .settings-panel .setting-row label { flex: 1; padding-top: 10px; }
        .settings-panel .setting-row input { flex: 2; }
        .settings-toggle { text-align: right; cursor: pointer; color: #007bff; margin-bottom: 10px; }
        .connection-status {
          position: fixed;
          top: 10px;
          left: 10px;
          padding: 5px 10px;
          border-radius: 4px;
          font-size: 14px;
          font-weight: bold;
          z-index: 1000;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .status-connected { background-color: #4CAF50; color: white; }
        .status-disconnected { background-color: #F44336; color: white; }
        .status-checking { background-color: #FFC107; color: black; }
        #payload {
          position: absolute;
          opacity: 0.01;
          height: 0;
          overflow: hidden;
          z-index: -1;
          width: 100%;
        }
      </style>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/jsonlint/1.6.0/jsonlint.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/mode/javascript/javascript.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/addon/edit/matchbrackets.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/addon/edit/closebrackets.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/addon/lint/lint.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/addon/lint/json-lint.min.js"></script>
    </head>
    <body>
      <div class="connection-status status-checking" id="connectionStatus">
        Checking connection...
      </div>
      
      <div class="settings-toggle" id="settingsToggle">⚙️ Connection Settings</div>
      <div class="settings-panel" id="settingsPanel" style="display: none;">
        <h3>NATS Connection Settings</h3>
        <div class="setting-row">
          <label>Cluster ID:</label>
          <input id="clusterID" placeholder="" />
        </div>
        <div class="setting-row">
          <label>NATS URL:</label>
          <input id="natsURL" placeholder="nats://user:pass@hostname:port" />
        </div>
        <button id="saveSettings">Save Settings</button>
      </div>
      
      <h2>Event Publisher</h2>
      <form method="POST" action="/publish" id="publishForm">
        <label>Event Subject:</label>
        <input name="subject" id="subject" required />

        <label>JSON Payload:</label>
        <div id="editor-container">
          <textarea name="payload" id="payload" required></textarea>
        </div>

        <div class="controls">
          <button type="button" id="clearFormBtn">Clear Form</button>
          <button type="submit">Publish Event</button>
        </div>
        
        <input type="hidden" name="clusterID" id="hiddenClusterID" />
        <input type="hidden" name="natsURL" id="hiddenNatsURL" />
      </form>
      <div id="result">${req.query.message || ''}</div>
      
      <div class="history-container">
        <h3>Previous Events</h3>
        <table id="eventsTable">
          <thead>
            <tr>
              <th>Date</th>
              <th>Subject</th>
              <th>Payload</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
          
      <script>
        let editor;
        
        function loadConnectionSettings() {
          const settings = JSON.parse(localStorage.getItem('natsSettings') || '{}');
          document.getElementById('clusterID').value = settings.clusterID || '';
          document.getElementById('natsURL').value = settings.natsURL || '';
          updateHiddenFields();
        }
        
        function updateHiddenFields() {
          const settings = JSON.parse(localStorage.getItem('natsSettings') || '{}');
          document.getElementById('hiddenClusterID').value = settings.clusterID || '';
          document.getElementById('hiddenNatsURL').value = settings.natsURL || '';
        }
        
        function checkConnectionStatus() {
          const status = document.getElementById('connectionStatus');
          status.className = 'connection-status status-checking';
          status.textContent = 'Checking connection...';
          
          const settings = JSON.parse(localStorage.getItem('natsSettings') || '{}');
          const clusterID = settings.clusterID || '';
          const natsURL = settings.natsURL;
          
          fetch('/check-connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clusterID, natsURL })
          })
          .then(response => response.json())
          .then(data => {
            if (data.connected) {
              status.className = 'connection-status status-connected';
              status.textContent = 'Connected to NATS';
            } else {
              status.className = 'connection-status status-disconnected';
              status.textContent = 'Disconnected from NATS';
            }
          })
          .catch(error => {
            status.className = 'connection-status status-disconnected';
            status.textContent = 'Connection check failed';
          });
        }
        
        function clearForm() {
          document.getElementById('subject').value = '';
          if (editor) {
            editor.setValue('{}');
          }
        }
        
        function loadEvents() {
          const events = JSON.parse(localStorage.getItem('publishedEvents') || '[]');
          const tableBody = document.querySelector('#eventsTable tbody');
          tableBody.innerHTML = '';
          
          events.forEach(event => {
            const row = document.createElement('tr');
            
            const dateCell = document.createElement('td');
            const date = new Date(event.timestamp);
            dateCell.textContent = date.toLocaleString();
            row.appendChild(dateCell);
            
            const subjectCell = document.createElement('td');
            subjectCell.textContent = event.subject;
            row.appendChild(subjectCell);
            
            const payloadCell = document.createElement('td');
            payloadCell.classList.add('truncate');
            payloadCell.textContent = JSON.stringify(event.payload);
            row.appendChild(payloadCell);
            
            row.addEventListener('click', () => {
              document.getElementById('subject').value = event.subject;
              if (editor) {
                editor.setValue(JSON.stringify(event.payload, null, 2));
              }
            });
            
            tableBody.appendChild(row);
          });
        }
        
        document.addEventListener('DOMContentLoaded', () => {
          loadConnectionSettings();
          checkConnectionStatus();
          
          document.getElementById('settingsToggle').addEventListener('click', function() {
            const panel = document.getElementById('settingsPanel');
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
          });
          
          document.getElementById('saveSettings').addEventListener('click', function() {
            const clusterID = document.getElementById('clusterID').value || '';
            const natsURL = document.getElementById('natsURL').value || '';
            
            localStorage.setItem('natsSettings', JSON.stringify({
              clusterID,
              natsURL
            }));
            
            updateHiddenFields();
            document.getElementById('settingsPanel').style.display = 'none';
            
            const result = document.getElementById('result');
            result.innerHTML = '<div class="success">✅ Connection settings saved</div>';
            setTimeout(() => { result.innerHTML = ''; }, 3000);
            
            checkConnectionStatus();
          });
        
          const textArea = document.getElementById('payload');
          editor = CodeMirror.fromTextArea(textArea, {
            mode: {name: "javascript", json: true},
            theme: "dracula",
            lineNumbers: true,
            matchBrackets: true,
            autoCloseBrackets: true,
            indentUnit: 2,
            tabSize: 2,
            lineWrapping: true,
            gutters: ["CodeMirror-lint-markers"],
            lint: { 
              getAnnotations: function(text, updateLinting, options, cm) {
                try {
                  if (text.trim() === '') return [];
                  const parsed = JSON.parse(text);
                  return [];
                } catch (e) {
                  return [{
                    from: CodeMirror.Pos(0, 0),
                    to: CodeMirror.Pos(cm.lineCount() - 1),
                    message: e.message
                  }];
                }
              }
            }
          });
          
          editor.on('change', function() {
            textArea.value = editor.getValue();
          });
          
          editor.on('focus', function() {
            try {
              const value = editor.getValue();
              if (value.trim()) {
                const json = JSON.parse(value);
                editor.setValue(JSON.stringify(json, null, 2));
              }
            } catch (e) {}
          });
          
          document.getElementById('publishForm').addEventListener('submit', function(event) {
            event.preventDefault();
            
            const subject = document.getElementById('subject').value.trim();
            if (!subject) {
              document.getElementById('result').innerHTML = '<div class="error">🚫 Subject is required</div>';
              return;
            }
            
            let jsonPayload;
            try {
              jsonPayload = editor.getValue();
              if (!jsonPayload.trim()) {
                document.getElementById('result').innerHTML = '<div class="error">🚫 Payload is required</div>';
                return;
              }
              
              JSON.parse(jsonPayload);
            } catch (e) {
              document.getElementById('result').innerHTML = '<div class="error">🚫 Invalid JSON payload</div>';
              return;
            }
            
            textArea.value = jsonPayload;
            updateHiddenFields();
            this.submit();
          });
          
          document.getElementById('clearFormBtn').addEventListener('click', clearForm);
          
          clearForm();
          loadEvents();
        });
      </script>
      ${scriptTag}
    </body>
    </html>
  `);
});

app.post('/check-connection', async (req, res) => {
  const clusterID = req.body.clusterID || '';
  const natsURL = req.body.natsURL || '';
  
  try {
    const sc = stan.connect(clusterID, `connection-check-${Date.now()}`, {
      url: natsURL,
      connectTimeout: 3000,
      stanMaxPingOut: 1
    });

    const connectionPromise = new Promise((resolve, reject) => {
      sc.on('connect', () => {
        sc.close();
        resolve(true);
      });

      sc.on('error', (err) => {
        reject(err);
      });
      
      setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 5000);
    });

    await connectionPromise;
    res.json({ connected: true });
    
  } catch (err) {
    res.json({ connected: false, error: err.message });
  }
});

app.post('/publish', async (req, res) => {
  const subject = req.body.subject;
  const clusterID = req.body.clusterID || '';
  const natsURL = req.body.natsURL || '';
  
  let payload;

  try {
    payload = JSON.parse(req.body.payload);
  } catch (e) {
    return res.redirect('/?message=<div class="error">🚫 Invalid JSON payload</div>');
  }

  try {
    const sc = stan.connect(clusterID, `node-client-${Date.now()}`, {
      url: natsURL
    });

    const publishPromise = new Promise((resolve, reject) => {
      sc.on('connect', () => {
        sc.publish(subject, JSON.stringify(payload), (err, guid) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(guid);
          sc.close();
        });
      });

      sc.on('error', (err) => {
        reject(err);
      });
    });

    await publishPromise;
    
    return res.redirect('/?message=<div class="success">✅ Event published successfully</div>&script=' + 
      encodeURIComponent(`
        (function() {
          const events = JSON.parse(localStorage.getItem('publishedEvents') || '[]');
          
          events.unshift({
            subject: ${JSON.stringify(subject)},
            payload: ${JSON.stringify(payload)},
            timestamp: Date.now()
          });
          
          localStorage.setItem('publishedEvents', JSON.stringify(events));
          
          document.getElementById('subject').value = '';
          if (editor) {
            editor.setValue('{}');
          }
          loadEvents();
        })();
      `)
    );
  } catch (err) {
    return res.redirect(`/?message=<div class="error">🚫 Failed to publish event: ${err.message}</div>`);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 EventTest running on http://localhost:${PORT}`);
});