const { app, BrowserWindow, globalShortcut, Notification } = require('electron');
const io = require('socket.io-client');

let win;
let socket;

function createWindow () {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Remote Panic Connect Desktop",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Directly load the live Cloudflare Pages frontend URL
  win.loadURL('https://panic-connect-frontend.pages.dev');

  // Initialize background socket listener
  socket = io('https://panic-chat-backend.onrender.com');

  socket.on('connect', () => {
    console.log('Desktop Electron client connected to server.');
  });

  socket.on('panic_alert', (data) => {
    new Notification({
      title: `Emergency Alert Triggered!`,
      body: `Activated by linked device: ${data.name} on IP ${data.ip}`
    }).show();
  });
}

app.whenReady().then(() => {
  createWindow();

  // Register OS-level System-Wide Global Keyboard Shortcut
  globalShortcut.register('CommandOrControl+Down', async () => {
    console.log('Global shortcut triggered');
    
    // Extract the active username and ID from local storage in the BrowserWindow
    try {
      const storedUserStr = await win.webContents.executeJavaScript("localStorage.getItem('user')");
      if (storedUserStr) {
        const storedUser = JSON.parse(storedUserStr);
        socket.emit('panic_trigger', { userId: storedUser.id, name: storedUser.name });
      } else {
        // Fallback for unauthorized/logged out state
        socket.emit('panic_trigger', { userId: 'anon', name: 'Anonymous Desktop User' });
      }
    } catch (err) {
      console.error('Failed to retrieve user from localStorage:', err);
    }
  });
});

app.on('will-quit', () => {
  // Clean up global keyboard shortcuts on exit
  globalShortcut.unregisterAll();
});
