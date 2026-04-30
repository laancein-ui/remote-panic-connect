from flask import Flask, render_template
from flask_socketio import SocketIO, emit
import os
import threading
from pynput import keyboard
import socket

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

def get_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "localhost"

@app.route('/')
def index():
    """Controller Page"""
    return render_template('index.html')

@app.route('/receiver')
def receiver():
    """Receiver Page"""
    return render_template('receiver.html')

# Global state to store the last active room for keyboard triggers
last_active_room = None

@socketio.on('join_room')
def on_join(data):
    global last_active_room
    room = data.get('room')
    if room:
        from flask_socketio import join_room
        join_room(room)
        last_active_room = room # Store for keyboard shortcut
        print(f"User joined room: {room}")

@socketio.on('trigger_alarm')
def handle_trigger(data):
    room = data.get('room')
    name = data.get('computer_name', 'Remote Computer')
    instruction = data.get('instruction', 'ALARM_ACTIVATED')
    
    print(f"🔔 Alarm triggered by: {name} in room: {room} with msg: {instruction}")
    
    socketio.emit('alarm_event', {
        'message': instruction, 
        'computer_name': name,
        'timestamp': data.get('timestamp')
    }, room=room)

def trigger_from_keyboard():
    global last_active_room
    if last_active_room:
        name = socket.gethostname()
        print(f"⌨️ Keyboard trigger for room: {last_active_room}")
        socketio.emit('alarm_event', {
            'message': 'PANIC! Keyboard Shortcut Pressed', 
            'computer_name': name
        }, room=last_active_room)
    else:
        print("⌨️ Keyboard trigger detected, but no active room found.")

# Keyboard Shortcut Listener
def on_activate():
    trigger_from_keyboard()

def start_keyboard_listener():
    # Define Shift + Down shortcut
    # Note: On Mac, Shift + Down is usually <shift>+<down>
    with keyboard.GlobalHotKeys({
            '<shift>+<down>': on_activate}) as h:
        h.join()

if __name__ == '__main__':
    # Start keyboard listener in a background thread
    kb_thread = threading.Thread(target=start_keyboard_listener, daemon=True)
    kb_thread.start()

    my_ip = get_ip()
    print(f"\n" + "="*50)
    print(f"🚀 SERVER RUNNING!")
    print(f"📱 MOBILE CONNECT: http://{my_ip}:5001/receiver")
    print(f"⌨️ SHORTCUT: Press 'Shift + Down' anywhere to trigger alarm")
    print("="*50 + "\n")

    socketio.run(app, host='0.0.0.0', port=5001, debug=False, allow_unsafe_werkzeug=True)
