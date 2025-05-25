let socket = null;
let currentUsername = '';
const userColors = {};

function getRandomColor() {
  const colors = ['#43a047', '#2e7d32', '#388e3c', '#1b5e20', '#66bb6a', '#81c784'];
  return colors[Math.floor(Math.random() * colors.length)];
}

window.onload = () => {
  document.getElementById('loginModal').style.display = 'flex';
};

function connect() {
  const username = document.getElementById('usernameInput').value.trim();
  if (!username) {
    alert("Введіть ім’я користувача!");
    return;
  }

  currentUsername = username;
  const url = `ws://localhost:5020/ws/chat?username=${encodeURIComponent(username)}`;
  socket = new WebSocket(url);

  socket.onopen = () => {
    document.getElementById("loginModal").style.display = "none";
    document.getElementById("chatContainer").style.display = "flex";
  };

  socket.onmessage = (event) => {
    const msg = event.data;
    if (msg.startsWith("__USERS__")) {
      const users = JSON.parse(msg.replace("__USERS__", ""));
      updateUserList(users);
    } else {
      const parsed = JSON.parse(msg);
      if (parsed.message && parsed.username) {
        appendMessage(parsed.username, parsed.message);
      }
    }
  };

  socket.onclose = () => {
    appendSystemMessage("🔴 З’єднання закрите");
  };

  socket.onerror = (err) => {
    appendSystemMessage("❌ Помилка WebSocket");
    console.error("WS error", err);
  };
}

function sendMessage() {
  const input = document.getElementById("messageInput");
  const msg = input.value.trim();
  if (msg && socket && socket.readyState === WebSocket.OPEN) {
    socket.send(msg);
    input.value = "";
  }
}

function appendSystemMessage(text) {
  const chat = document.getElementById("chat");
  const div = document.createElement("div");
  div.style.color = "#388e3c";
  div.style.fontWeight = "bold";
  div.style.textAlign = "center";
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function appendMessage(username, message) {
  if (username === "System") {
    appendSystemMessage(message);
    return;
  }

  const chat = document.getElementById("chat");
  const wrapper = document.createElement("div");
  const isUser = username === currentUsername;

  wrapper.className = `message-wrapper ${isUser ? "user" : "other"}`;

  if (!userColors[username]) {
    userColors[username] = getRandomColor();
  }

  const name = document.createElement("div");
  name.className = "username";
  name.textContent = username;
  name.style.color = userColors[username];

  const msg = document.createElement("div");
  msg.className = "message";
  msg.textContent = message;

  wrapper.appendChild(name);
  wrapper.appendChild(msg);
  chat.appendChild(wrapper);
  chat.scrollTop = chat.scrollHeight;
}

function updateUserList(users) {
  const list = document.getElementById("users");
  list.innerHTML = "";
  users.forEach(u => {
    const div = document.createElement("div");
    div.textContent = u;
    list.appendChild(div);
  });
}
