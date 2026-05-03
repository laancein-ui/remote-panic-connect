/**
 * Desktop Background Daemon / Hotkey Script
 * Run this continuously in the background to send alerts anytime you press the shortcut,
 * even when the browser or app is not active or minimized.
 * 
 * Usage:
 * 1. Install dependencies: npm install iohook socket.io-client
 * 2. Run: node desktop-daemon.js
 */

const io = require('socket.io-client');

// Replace with your specific user details and server URL
const USER_ID = "laancein@gmail.com"; 
const USER_NAME = "Laancein";
const SERVER_URL = "https://panic-chat-backend.onrender.com";

console.log("Starting desktop background daemon for global shortcuts...");

const socket = io(SERVER_URL);

socket.on('connect', () => {
  console.log(`Connected to the alert server at ${SERVER_URL}`);
  socket.emit('register_bg_session', { userId: USER_ID, isMobile: false });
});

socket.on('panic_alert', (data) => {
  console.log(`⚠️ EMERGENCY ALERT RECEIVED: Triggered by ${data.name} from IP: ${data.ip}`);
});

// Using Node.js standard process for intercepting background events / or Electron globalShortcut
const isMac = process.platform === 'darwin';

console.log(`Daemon active! Press ${isMac ? 'Cmd + Down' : 'Ctrl + Down'} globally at any time.`);

// If you wrap this into an Electron Desktop application:
/**
 * In your main.js file for Electron:
 * 
 * const { app, globalShortcut } = require('electron');
 * const io = require('socket.io-client');
 * const socket = io('https://panic-chat-backend.onrender.com');
 * 
 * app.whenReady().then(() => {
 *   globalShortcut.register('CommandOrControl+Down', () => {
 *     console.log('Global shortcut triggered');
 *     socket.emit('panic_trigger', { userId: 'laancein@gmail.com', name: 'Laancein' });
 *   });
 * });
 */
