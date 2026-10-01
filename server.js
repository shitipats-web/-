const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

const rooms = new Map();

/* =========================================================
   หน้าเว็บไซต์ HTML + CSS + Client JavaScript
========================================================= */

const page = String.raw`
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >
  <title>เกมเชื่อมโยงคำ</title>

  <style>
    * {
      box-sizing: border-box;
    }

    :root {
      --primary: #6c5ce7;
      --primary-dark: #4d3dcc;
      --secondary: #00cec9;
      --danger: #ff4757;
      --success: #00b894;
      --warning: #fdcb6e;
      --dark: #20243b;
      --text: #30344c;
      --muted: #74788d;
      --card: rgba(255, 255, 255, 0.94);
    }

    body {
      min-height: 100vh;
      margin: 0;
      padding: 24px;
      color: var(--text);
      font-family:
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
      background:
        radial-gradient(
          circle at top left,
          rgba(0, 206, 201, 0.35),
          transparent 38%
        ),
        radial-gradient(
          circle at bottom right,
          rgba(108, 92, 231, 0.45),
          transparent 40%
        ),
        linear-gradient(135deg, #14162b, #292b57);
    }

    button,
    input {
      font: inherit;
    }

    button {
      cursor: pointer;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .hidden {
      display: none !important;
    }

    .container {
      width: min(100%, 1000px);
      margin: 0 auto;
    }

    .brand {
      margin: 10px 0 24px;
      color: #ffffff;
      text-align: center;
    }

    .brand h1 {
      margin: 0;
      font-size: clamp(2rem, 7vw, 3.7rem);
      line-height: 1.1;
    }

    .brand p {
      margin: 10px 0 0;
      color: rgba(255, 255, 255, 0.8);
    }

    .card {
      padding: 24px;
      background: var(--card);
      border: 1px solid rgba(255, 255, 255, 0.6);
      border-radius: 24px;
      box-shadow: 0 25px 70px rgba(0, 0, 0, 0.25);
      backdrop-filter: blur(16px);
    }

    .lobby-form {
      display: grid;
      gap: 14px;
      max-width: 550px;
      margin: 0 auto;
    }

    .field {
      display: grid;
      gap: 7px;
    }

    .field label {
      font-weight: 700;
    }

    input {
      width: 100%;
      padding: 14px 16px;
      color: var(--text);
      background: #ffffff;
      border: 2px solid #e4e6f0;
      border-radius: 14px;
      outline: none;
      transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease,
        transform 0.2s ease;
    }

    input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 4px rgba(108, 92, 231, 0.14);
      transform: translateY(-1px);
    }

    .button-row {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-top: 8px;
    }

    .button {
      min-height: 50px;
      padding: 12px 18px;
      color: #ffffff;
      font-weight: 800;
      border: 0;
      border-radius: 14px;
      background: linear-gradient(
        135deg,
        var(--primary),
        #9b59ff
      );
      box-shadow: 0 10px 24px rgba(108, 92, 231, 0.25);
      transition:
        transform 0.18s ease,
        box-shadow 0.18s ease;
    }

    .button:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 14px 30px rgba(108, 92, 231, 0.34);
    }

    .button:active:not(:disabled) {
      transform: scale(0.97);
    }

    .button.secondary {
      background: linear-gradient(135deg, #0984e3, #00cec9);
    }

    .button.success {
      background: linear-gradient(135deg, #00b894, #55efc4);
    }

    .status {
      min-height: 24px;
      margin-top: 15px;
      color: var(--danger);
      font-weight: 700;
      text-align: center;
    }

    .room-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      margin-bottom: 20px;
    }

    .room-code {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 15px;
      color: #ffffff;
      font-size: 1.1rem;
      font-weight: 900;
      letter-spacing: 2px;
      background: var(--dark);
      border-radius: 14px;
    }

    .game-layout {
      display: grid;
      grid-template-columns: minmax(0, 1.5fr) minmax(240px, 0.7fr);
      gap: 18px;
    }

    .game-panel,
    .players-panel {
      padding: 20px;
      background: #ffffff;
      border: 1px solid #e8e9f2;
      border-radius: 20px;
    }

    .rule-box {
      margin-bottom: 18px;
      padding: 14px 16px;
      color: #53470d;
      line-height: 1.6;
      background: #fff8d8;
      border: 1px solid #f3df81;
      border-radius: 14px;
    }

    .timer-box {
      display: grid;
      place-items: center;
      width: 112px;
      height: 112px;
      margin: 8px auto 20px;
      color: #ffffff;
      background: linear-gradient(
        135deg,
        var(--primary),
        #00cec9
      );
      border: 7px solid rgba(108, 92, 231, 0.13);
      border-radius: 50%;
      box-shadow: 0 15px 30px rgba(108, 92, 231, 0.22);
      transition:
        background 0.2s ease,
        transform 0.2s ease;
    }

    .timer-box.warning {
      background: linear-gradient(135deg, #ff9f43, #ee5253);
      animation: timer-pulse 0.75s infinite alternate;
    }

    .timer-number {
      font-size: 2.2rem;
      font-weight: 900;
    }

    .turn-text {
      min-height: 28px;
      margin-bottom: 18px;
      font-size: 1.15rem;
      font-weight: 800;
      text-align: center;
    }

    .word-chain {
      display: flex;
      min-height: 100px;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-bottom: 20px;
      padding: 18px;
      text-align: center;
      background: linear-gradient(135deg, #f2efff, #e9ffff);
      border: 2px dashed rgba(108, 92, 231, 0.35);
      border-radius: 18px;
    }

    .word {
      overflow-wrap: anywhere;
      font-size: clamp(1.3rem, 4vw, 2rem);
      font-weight: 900;
    }

    .arrow {
      color: var(--primary);
      font-size: 1.8rem;
      font-weight: 900;
    }

    .answer-form {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
    }

    .players-panel h2 {
      margin-top: 0;
    }

    .player-list {
      display: grid;
      gap: 10px;
    }

    .player {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 12px 14px;
      background: #f5f6fa;
      border: 2px solid transparent;
      border-radius: 14px;
      transition:
        transform 0.2s ease,
        border-color 0.2s ease;
    }

    .player.current {
      border-color: var(--primary);
      transform: scale(1.02);
    }

    .player.dead {
      opacity: 0.45;
      filter: grayscale(1);
    }

    .player-name {
      overflow: hidden;
      font-weight: 800;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .player-score {
      flex-shrink: 0;
      padding: 5px 9px;
      color: #ffffff;
      font-size: 0.85rem;
      font-weight: 800;
      background: var(--primary);
      border-radius: 999px;
    }

    .host-badge {
      margin-left: 5px;
      color: #d98000;
      font-size: 0.75rem;
    }

    .notice-box {
      max-height: 170px;
      margin-top: 18px;
      padding: 14px;
      overflow-y: auto;
      color: #ffffff;
      background: rgba(22, 24, 48, 0.92);
      border-radius: 16px;
    }

    .notice {
      padding: 7px 4px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .empty {
      color: var(--muted);
      text-align: center;
    }

    .game-popup {
      position: fixed;
      top: 22px;
      left: 50%;
      z-index: 9999;
      width: min(calc(100% - 30px), 430px);
      padding: 18px 22px;
      color: #ffffff;
      text-align: center;
      background: linear-gradient(135deg, #3949db, #7c4dff);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 18px;
      box-shadow: 0 20px 55px rgba(0, 0, 0, 0.35);
      opacity: 0;
      pointer-events: none;
      transform:
        translateX(-50%)
        translateY(-50px)
        scale(0.65);
      transition:
        opacity 0.25s ease,
        transform 0.4s cubic-bezier(0.2, 1.5, 0.4, 1);
    }

    .game-popup.show {
      opacity: 1;
      transform:
        translateX(-50%)
        translateY(0)
        scale(1);
    }

    .game-popup-title {
      display: block;
      margin-bottom: 5px;
      font-size: 1.25rem;
      font-weight: 900;
    }

    .game-popup.success,
    .game-popup.answer {
      background: linear-gradient(135deg, #00a86b, #00cec9);
    }

    .game-popup.danger {
      background: linear-gradient(135deg, #c0392b, #ff4757);
      animation: shake 0.35s ease;
    }

    .game-popup.winner {
      color: #3f3000;
      background: linear-gradient(135deg, #ffe66d, #ff9f43);
    }

    .game-popup.turn {
      background: linear-gradient(135deg, #0984e3, #00cec9);
    }

    @keyframes shake {
      0%, 100% {
        margin-left: 0;
      }

      25% {
        margin-left: -10px;
      }

      50% {
        margin-left: 10px;
      }

      75% {
        margin-left: -5px;
      }
    }

    @keyframes timer-pulse {
      from {
        transform: scale(1);
      }

      to {
        transform: scale(1.08);
      }
    }

    @media (max-width: 760px) {
      body {
        padding: 14px;
      }

      .card {
        padding: 16px;
        border-radius: 19px;
      }

      .game-layout {
        grid-template-columns: 1fr;
      }

      .room-header {
        align-items: stretch;
        flex-direction: column;
      }

      .room-code {
        justify-content: center;
      }
    }

    @media (max-width: 480px) {
      .button-row,
      .answer-form {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>

<body>
  <main class="container">
    <header class="brand">
      <h1>เกมเชื่อมโยงคำ</h1>
      <p>เชื่อมคำให้สัมพันธ์กัน ห้ามตอบคำซ้ำ และต้องตอบให้ทันเวลา</p>
    </header>

    <section id="lobbyScreen" class="card">
      <div class="lobby-form">
        <div class="field">
          <label for="nameInput">ชื่อผู้เล่น</label>
          <input
            id="nameInput"
            type="text"
            maxlength="20"
            placeholder="กรอกชื่อของคุณ"
            autocomplete="off"
          >
        </div>

        <div class="field">
          <label for="codeInput">รหัสห้อง</label>
          <input
            id="codeInput"
            type="text"
            maxlength="6"
            placeholder="กรอกรหัสห้องสำหรับเข้าร่วม"
            autocomplete="off"
          >
        </div>

        <div class="button-row">
          <button id="createButton" class="button">
            สร้างห้อง
          </button>

          <button id="joinButton" class="button secondary">
            เข้าร่วมห้อง
          </button>
        </div>

        <div id="lobbyStatus" class="status"></div>
      </div>
    </section>

    <section id="roomScreen" class="card hidden">
      <div class="room-header">
        <div id="roomCode" class="room-code">
          ห้อง: ------
        </div>

        <button
          id="startButton"
          class="button success hidden"
        >
          เริ่มเกม
        </button>
      </div>

      <div class="game-layout">
        <section class="game-panel">
          <div class="rule-box">
            ตอบคำที่มีความหมายเชื่อมโยงกับคำก่อนหน้า
            เช่น “ท้องฟ้า → เมฆ → ฝน → ร่ม”
            หากตอบคำเดิมหรือคำที่สะกดเหมือนคำที่เคยใช้
            จะถูกคัดออกทันที
          </div>

          <div id="timerBox" class="timer-box">
            <span id="timerNumber" class="timer-number">--</span>
          </div>

          <div id="turnText" class="turn-text">
            รอเจ้าของห้องเริ่มเกม
          </div>

          <div id="wordChain" class="word-chain">
            <span class="empty">ยังไม่มีคำเริ่มต้น</span>
          </div>

          <form id="answerForm" class="answer-form">
            <input
              id="wordInput"
              type="text"
              maxlength="50"
              placeholder="พิมพ์คำที่เชื่อมโยงกัน"
              autocomplete="off"
              disabled
            >

            <button
              id="submitButton"
              class="button"
              type="submit"
              disabled
            >
              ส่งคำตอบ
            </button>
          </form>

          <div id="gameStatus" class="status"></div>

          <div id="noticeBox" class="notice-box">
            <div class="notice">ยินดีต้อนรับเข้าสู่เกม</div>
          </div>
        </section>

        <aside class="players-panel">
          <h2>ผู้เล่น</h2>
          <div id="playerList" class="player-list"></div>
        </aside>
      </div>
    </section>
  </main>

  <script src="/socket.io/socket.io.js"></script>

  <script>
    const socket = io();

    const lobbyScreen = document.getElementById('lobbyScreen');
    const roomScreen = document.getElementById('roomScreen');
    const nameInput = document.getElementById('nameInput');
    const codeInput = document.getElementById('codeInput');
    const createButton = document.getElementById('createButton');
    const joinButton = document.getElementById('joinButton');
    const startButton = document.getElementById('startButton');
    const lobbyStatus = document.getElementById('lobbyStatus');
    const gameStatus = document.getElementById('gameStatus');
    const roomCode = document.getElementById('roomCode');
    const playerList = document.getElementById('playerList');
    const turnText = document.getElementById('turnText');
    const wordChain = document.getElementById('wordChain');
    const answerForm = document.getElementById('answerForm');
    const wordInput = document.getElementById('wordInput');
    const submitButton = document.getElementById('submitButton');
    const timerBox = document.getElementById('timerBox');
    const timerNumber = document.getElementById('timerNumber');
    const noticeBox = document.getElementById('noticeBox');

    let currentRoom = null;
    let timerInterval = null;
    let popupTimeout = null;

    function setLobbyLoading(loading) {
      createButton.disabled = loading;
      joinButton.disabled = loading;
    }

    function enterRoom() {
      lobbyScreen.classList.add('hidden');
      roomScreen.classList.remove('hidden');
    }

    function addNotice(message) {
      const item = document.createElement('div');
      item.className = 'notice';
      item.textContent = message;

      noticeBox.prepend(item);

      while (noticeBox.children.length > 20) {
        noticeBox.lastElementChild.remove();
      }
    }

    function showPopup(data) {
      const oldPopup = document.querySelector('.game-popup');

      if (oldPopup) {
        oldPopup.remove();
      }

      clearTimeout(popupTimeout);

      const popup = document.createElement('div');
      popup.className = 'game-popup ' + (data.type || 'info');

      const title = document.createElement('strong');
      title.className = 'game-popup-title';
      title.textContent = data.title || '';

      const message = document.createElement('div');
      message.textContent = data.message || '';

      if (data.title) {
        popup.appendChild(title);
      }

      if (data.message) {
        popup.appendChild(message);
      }

      document.body.appendChild(popup);

      requestAnimationFrame(function () {
        popup.classList.add('show');
      });

      popupTimeout = setTimeout(function () {
        popup.classList.remove('show');

        setTimeout(function () {
          popup.remove();
        }, 400);
      }, Number(data.duration) || 2500);
    }

    function updateTimer() {
      clearInterval(timerInterval);

      if (!currentRoom || !currentRoom.started) {
        timerNumber.textContent = '--';
        timerBox.classList.remove('warning');
        return;
      }

      function renderTime() {
        const milliseconds = Math.max(
          0,
          currentRoom.deadline - Date.now()
        );

        const seconds = Math.ceil(milliseconds / 1000);
        timerNumber.textContent = String(seconds);

        timerBox.classList.toggle('warning', seconds <= 5);
      }

      renderTime();
      timerInterval = setInterval(renderTime, 200);
    }

    function renderPlayers(room) {
      playerList.replaceChildren();

      room.players.forEach(function (player) {
        const item = document.createElement('div');

        item.className = 'player';

        if (!player.alive) {
          item.classList.add('dead');
        }

        if (player.id === room.turnId) {
          item.classList.add('current');
        }

        const name = document.createElement('div');
        name.className = 'player-name';
        name.textContent = player.alive
          ? player.name
          : player.name + ' (แพ้แล้ว)';

        if (player.id === room.hostId) {
          const host = document.createElement('span');
          host.className = 'host-badge';
          host.textContent = 'เจ้าของห้อง';
          name.appendChild(host);
        }

        const score = document.createElement('div');
        score.className = 'player-score';
        score.textContent = player.score + ' คะแนน';

        item.appendChild(name);
        item.appendChild(score);
        playerList.appendChild(item);
      });
    }

    function renderWords(room) {
      wordChain.replaceChildren();

      if (!room.currentWord) {
        const empty = document.createElement('span');
        empty.className = 'empty';
        empty.textContent = 'ยังไม่มีคำเริ่มต้น';
        wordChain.appendChild(empty);
        return;
      }

      if (room.previousWord) {
        const previous = document.createElement('span');
        previous.className = 'word';
        previous.textContent = room.previousWord;

        const arrow = document.createElement('span');
        arrow.className = 'arrow';
        arrow.textContent = '→';

        wordChain.appendChild(previous);
        wordChain.appendChild(arrow);
      }

      const current = document.createElement('span');
      current.className = 'word';
      current.textContent = room.currentWord;
      wordChain.appendChild(current);
    }

    function renderRoom(room) {
      currentRoom = room;
      enterRoom();

      roomCode.textContent = 'ห้อง: ' + room.code;

      const isHost = room.hostId === socket.id;
      const isMyTurn =
        room.started &&
        room.turnId === socket.id;

      startButton.classList.toggle(
        'hidden',
        !isHost || room.started
      );

      wordInput.disabled = !isMyTurn;
      submitButton.disabled = !isMyTurn;

      if (room.winner) {
        turnText.textContent = 'ผู้ชนะ: ' + room.winner;
      } else if (!room.started) {
        turnText.textContent = isHost
          ? 'กดเริ่มเกมเมื่อมีผู้เล่นอย่างน้อย 2 คน'
          : 'รอเจ้าของห้องเริ่มเกม';
      } else if (isMyTurn) {
        turnText.textContent = room.currentWord
          ? 'ถึงตาคุณ เชื่อมคำจาก “' + room.currentWord + '”'
          : 'ถึงตาคุณ เริ่มต้นด้วยคำอะไรก็ได้';

        setTimeout(function () {
          wordInput.focus();
        }, 100);
      } else {
        const currentPlayer = room.players.find(
          function (player) {
            return player.id === room.turnId;
          }
        );

        turnText.textContent = currentPlayer
          ? 'ตาของ ' + currentPlayer.name
          : 'กำลังเปลี่ยนตา';
      }

      renderPlayers(room);
      renderWords(room);
      updateTimer();
    }

    createButton.addEventListener('click', function () {
      lobbyStatus.textContent = '';

      const name = nameInput.value.trim();

      if (!name) {
        lobbyStatus.textContent = 'กรุณากรอกชื่อ';
        return;
      }

      setLobbyLoading(true);

      socket.emit(
        'createRoom',
        { name: name },
        function (result) {
          setLobbyLoading(false);

          if (!result || !result.ok) {
            lobbyStatus.textContent =
              result && result.error
                ? result.error
                : 'ไม่สามารถสร้างห้องได้';
          }
        }
      );
    });

    joinButton.addEventListener('click', function () {
      lobbyStatus.textContent = '';

      const name = nameInput.value.trim();
      const code = codeInput.value.trim().toUpperCase();

      if (!name || !code) {
        lobbyStatus.textContent = 'กรุณากรอกชื่อและรหัสห้อง';
        return;
      }

      setLobbyLoading(true);

      socket.emit(
        'joinRoom',
        {
          name: name,
          code: code
        },
        function (result) {
          setLobbyLoading(false);

          if (!result || !result.ok) {
            lobbyStatus.textContent =
              result && result.error
                ? result.error
                : 'ไม่สามารถเข้าห้องได้';
          }
        }
      );
    });

    startButton.addEventListener('click', function () {
      gameStatus.textContent = '';

      socket.emit('startGame', function (result) {
        if (!result || !result.ok) {
          gameStatus.textContent =
            result && result.error
              ? result.error
              : 'ไม่สามารถเริ่มเกมได้';
        }
      });
    });

    answerForm.addEventListener('submit', function (event) {
      event.preventDefault();
      gameStatus.textContent = '';

      const word = wordInput.value.trim();

      if (!word) {
        gameStatus.textContent = 'กรุณาพิมพ์คำ';
        return;
      }

      submitButton.disabled = true;

      socket.emit(
        'submitWord',
        { word: word },
        function (result) {
          if (!result || !result.ok) {
            gameStatus.textContent =
              result && result.error
                ? result.error
                : 'ส่งคำตอบไม่สำเร็จ';

            if (!result || !result.eliminated) {
              submitButton.disabled = false;
            }

            return;
          }

          wordInput.value = '';
          gameStatus.textContent = '';
        }
      );
    });

    codeInput.addEventListener('input', function () {
      codeInput.value = codeInput.value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 6);
    });

    socket.on('roomState', function (room) {
      renderRoom(room);
    });

    socket.on('notice', function (message) {
      addNotice(message);
    });

    socket.on('popup', function (data) {
      showPopup(data || {});
    });

    socket.on('disconnect', function () {
      gameStatus.textContent =
        'การเชื่อมต่อกับเซิร์ฟเวอร์ขาดหาย';
    });
  </script>
</body>
</html>
`;

app.get("/", (req, res) => {
  res.type("html").send(page);
});

/* =========================================================
   ฟังก์ชันระบบเกม
========================================================= */

function respond(callback, data) {
  if (typeof callback === "function") {
    callback(data);
  }
}

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;

  do {
    code = Array.from(
      { length: 6 },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  } while (rooms.has(code));

  return code;
}

function cleanName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 20);
}

function displayWord(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 50);
}

/*
  ใช้ตรวจคำซ้ำโดยไม่สนใจ:
  - ตัวพิมพ์เล็ก/ใหญ่
  - ช่องว่าง
  - เครื่องหมายพิเศษ

  ตัวอย่าง:
  Taylor Swift
  taylor-swift
  TAYLOR SWIFT

  จะถือว่าเป็นคำเดียวกัน
*/
function wordKey(value) {
  return displayWord(value)
    .toLocaleLowerCase("th-TH")
    .replace(/[^\p{L}\p{M}\p{N}]/gu, "");
}

function countLetters(value) {
  return (
    displayWord(value)
      .match(/[\p{L}\p{M}]/gu)?.length || 0
  );
}

function connectedPlayers(room) {
  return room.players.filter(
    (player) => player.connected
  );
}

function alivePlayers(room) {
  return room.players.filter(
    (player) => player.connected && player.alive
  );
}

function getTurnSeconds(room) {
  return alivePlayers(room).length <= 3 ? 10 : 20;
}

function nextPlayer(room, currentIndex) {
  for (
    let offset = 1;
    offset <= room.players.length;
    offset += 1
  ) {
    const index =
      (currentIndex + offset) % room.players.length;

    const player = room.players[index];

    if (player?.connected && player.alive) {
      return index;
    }
  }

  return -1;
}

function emitNotice(room, message) {
  io.to(room.code).emit("notice", message);
}

function emitPopup(room, options = {}) {
  io.to(room.code).emit("popup", {
    type: options.type || "info",
    title: options.title || "",
    message: options.message || "",
    duration: Number(options.duration) || 2500
  });
}

function publicRoom(room) {
  const currentPlayer = room.started
    ? room.players[room.currentIndex]
    : null;

  return {
    code: room.code,
    hostId: room.hostId,
    started: room.started,
    currentWord: room.currentWord,
    previousWord: room.previousWord,
    turnId:
      currentPlayer?.connected &&
      currentPlayer?.alive
        ? currentPlayer.id
        : null,
    deadline: room.deadline,
    turnSeconds: getTurnSeconds(room),
    winner: room.winner,
    history: room.history.slice(-30),
    usedWords: [...room.usedWords.values()],
    players: connectedPlayers(room).map(
      (player) => ({
        id: player.id,
        name: player.name,
        alive: player.alive,
        score: player.score
      })
    )
  };
}

function sendRoom(room) {
  io.to(room.code).emit(
    "roomState",
    publicRoom(room)
  );
}

function removeRoomIfEmpty(room) {
  if (connectedPlayers(room).length > 0) {
    return false;
  }

  clearTimeout(room.timer);
  room.timer = null;
  rooms.delete(room.code);

  return true;
}

function finishIfNeeded(room) {
  if (!room.started) {
    return false;
  }

  const alive = alivePlayers(room);

  if (alive.length > 1) {
    return false;
  }

  clearTimeout(room.timer);
  room.timer = null;
  room.timerVersion += 1;
  room.started = false;
  room.deadline = 0;
  room.winner =
    alive[0]?.name || "ไม่มีผู้ชนะ";

  sendRoom(room);

  emitNotice(
    room,
    `จบเกม: ${room.winner} ชนะ`
  );

  emitPopup(room, {
    type: "winner",
    title: "จบเกม",
    message:
      alive.length === 1
        ? `${room.winner} เป็นผู้ชนะ`
        : "ไม่มีผู้ชนะในรอบนี้",
    duration: 5000
  });

  return true;
}

function beginTurn(room, index) {
  clearTimeout(room.timer);
  room.timer = null;
  room.timerVersion += 1;

  if (!room.started) {
    return;
  }

  if (finishIfNeeded(room)) {
    return;
  }

  const player = room.players[index];

  if (!player?.connected || !player.alive) {
    const fallbackIndex = nextPlayer(room, index);

    if (fallbackIndex >= 0) {
      beginTurn(room, fallbackIndex);
    }

    return;
  }

  room.currentIndex = index;

  const seconds = getTurnSeconds(room);
  const timerVersion = room.timerVersion;

  room.deadline = Date.now() + seconds * 1000;

  sendRoom(room);

  io.to(player.id).emit("popup", {
    type: "turn",
    title: "ถึงตาของคุณ",
    message: room.currentWord
      ? `ตอบคำที่เชื่อมโยงกับ “${room.currentWord}”`
      : "เริ่มต้นด้วยคำอะไรก็ได้",
    duration: 2200
  });

  room.timer = setTimeout(() => {
    if (
      !room.started ||
      timerVersion !== room.timerVersion
    ) {
      return;
    }

    const timedOutPlayer =
      room.players[room.currentIndex];

    if (
      timedOutPlayer?.connected &&
      timedOutPlayer.alive
    ) {
      timedOutPlayer.alive = false;

      emitNotice(
        room,
        `${timedOutPlayer.name} หมดเวลาและถูกคัดออก`
      );

      emitPopup(room, {
        type: "danger",
        title: "หมดเวลา",
        message:
          `${timedOutPlayer.name} ถูกคัดออก`,
        duration: 3000
      });
    }

    if (finishIfNeeded(room)) {
      return;
    }

    const next = nextPlayer(
      room,
      room.currentIndex
    );

    if (next >= 0) {
      beginTurn(room, next);
    }
  }, seconds * 1000);
}

function eliminateDuplicate(
  room,
  player,
  submittedWord,
  callback
) {
  clearTimeout(room.timer);
  room.timer = null;
  room.timerVersion += 1;

  player.alive = false;

  respond(callback, {
    ok: false,
    eliminated: true,
    error: `คำว่า “${submittedWord}” ถูกใช้ไปแล้ว`
  });

  emitNotice(
    room,
    `${player.name} ใช้คำซ้ำและถูกคัดออก`
  );

  emitPopup(room, {
    type: "danger",
    title: "ใช้คำซ้ำ",
    message:
      `${player.name} ใช้คำว่า “${submittedWord}” ซ้ำ`,
    duration: 3500
  });

  if (finishIfNeeded(room)) {
    return;
  }

  const next = nextPlayer(
    room,
    room.currentIndex
  );

  if (next >= 0) {
    beginTurn(room, next);
  }
}

/* =========================================================
   Socket.IO Events
========================================================= */

io.on("connection", (socket) => {
  socket.on(
    "createRoom",
    (payload = {}, callback) => {
      const playerName = cleanName(payload.name);

      if (!playerName) {
        return respond(callback, {
          ok: false,
          error: "กรุณากรอกชื่อ"
        });
      }

      if (socket.data.roomCode) {
        return respond(callback, {
          ok: false,
          error: "คุณอยู่ในห้องอยู่แล้ว"
        });
      }

      const code = makeCode();

      const room = {
        code,
        hostId: socket.id,
        players: [
          {
            id: socket.id,
            name: playerName,
            alive: true,
            connected: true,
            score: 0
          }
        ],
        usedWords: new Map(),
        history: [],
        currentWord: "",
        previousWord: "",
        currentIndex: 0,
        started: false,
        deadline: 0,
        winner: null,
        timer: null,
        timerVersion: 0
      };

      rooms.set(code, room);

      socket.join(code);
      socket.data.roomCode = code;

      sendRoom(room);

      emitPopup(room, {
        type: "success",
        title: "สร้างห้องสำเร็จ",
        message: `รหัสห้องคือ ${code}`,
        duration: 3000
      });

      return respond(callback, {
        ok: true,
        code
      });
    }
  );

  socket.on(
    "joinRoom",
    (payload = {}, callback) => {
      const playerName = cleanName(payload.name);

      const roomCode = String(
        payload.code ?? ""
      )
        .trim()
        .toUpperCase();

      if (!playerName) {
        return respond(callback, {
          ok: false,
          error: "กรุณากรอกชื่อ"
        });
      }

      if (!roomCode) {
        return respond(callback, {
          ok: false,
          error: "กรุณากรอกรหัสห้อง"
        });
      }

      if (socket.data.roomCode) {
        return respond(callback, {
          ok: false,
          error: "คุณอยู่ในห้องอยู่แล้ว"
        });
      }

      const room = rooms.get(roomCode);

      if (!room) {
        return respond(callback, {
          ok: false,
          error: "ไม่พบห้องนี้"
        });
      }

      if (room.started) {
        return respond(callback, {
          ok: false,
          error:
            "เกมเริ่มแล้ว ไม่สามารถเข้ากลางเกมได้"
        });
      }

      const normalizedName =
        playerName.toLocaleLowerCase("th-TH");

      const nameUsed = room.players.some(
        (player) =>
          player.connected &&
          player.name.toLocaleLowerCase(
            "th-TH"
          ) === normalizedName
      );

      if (nameUsed) {
        return respond(callback, {
          ok: false,
          error: "มีผู้เล่นใช้ชื่อนี้แล้ว"
        });
      }

      room.players.push({
        id: socket.id,
        name: playerName,
        alive: true,
        connected: true,
        score: 0
      });

      socket.join(roomCode);
      socket.data.roomCode = roomCode;

      sendRoom(room);

      emitNotice(
        room,
        `${playerName} เข้าร่วมห้องแล้ว`
      );

      emitPopup(room, {
        type: "success",
        title: "ผู้เล่นใหม่",
        message: `${playerName} เข้าร่วมห้อง`,
        duration: 2200
      });

      return respond(callback, {
        ok: true,
        code: roomCode
      });
    }
  );

  socket.on("startGame", (callback) => {
    const room = rooms.get(
      socket.data.roomCode
    );

    if (!room) {
      return respond(callback, {
        ok: false,
        error: "ไม่พบห้อง"
      });
    }

    if (socket.id !== room.hostId) {
      return respond(callback, {
        ok: false,
        error:
          "เฉพาะเจ้าของห้องเท่านั้นที่เริ่มเกมได้"
      });
    }

    if (room.started) {
      return respond(callback, {
        ok: false,
        error: "เกมกำลังดำเนินอยู่"
      });
    }

    room.players = room.players.filter(
      (player) => player.connected
    );

    if (room.players.length < 2) {
      return respond(callback, {
        ok: false,
        error: "ต้องมีผู้เล่นอย่างน้อย 2 คน"
      });
    }

    clearTimeout(room.timer);

    room.players.forEach((player) => {
      player.alive = true;
      player.score = 0;
    });

    room.usedWords.clear();
    room.history = [];
    room.currentWord = "";
    room.previousWord = "";
    room.currentIndex = 0;
    room.started = true;
    room.deadline = 0;
    room.winner = null;
    room.timer = null;
    room.timerVersion += 1;

    emitNotice(
      room,
      "เริ่มเกมเชื่อมโยงคำแล้ว"
    );

    emitPopup(room, {
      type: "success",
      title: "เริ่มเกม",
      message:
        "เชื่อมคำให้สัมพันธ์กันและห้ามใช้คำซ้ำ",
      duration: 3500
    });

    beginTurn(room, 0);

    return respond(callback, {
      ok: true
    });
  });

  socket.on(
    "submitWord",
    (payload = {}, callback) => {
      const room = rooms.get(
        socket.data.roomCode
      );

      if (!room?.started) {
        return respond(callback, {
          ok: false,
          error: "เกมยังไม่เริ่ม"
        });
      }

      const player =
        room.players[room.currentIndex];

      if (
        !player ||
        !player.connected ||
        !player.alive
      ) {
        return respond(callback, {
          ok: false,
          error: "คุณไม่ได้อยู่ในเกมแล้ว"
        });
      }

      if (player.id !== socket.id) {
        return respond(callback, {
          ok: false,
          error: "ยังไม่ถึงตาของคุณ"
        });
      }

      const submittedWord = displayWord(
        payload.word
      );

      const submittedKey = wordKey(
        submittedWord
      );

      if (
        !submittedKey ||
        countLetters(submittedWord) < 2
      ) {
        return respond(callback, {
          ok: false,
          error:
            "กรุณาพิมพ์คำอย่างน้อย 2 ตัวอักษร"
        });
      }

      if (room.usedWords.has(submittedKey)) {
        return eliminateDuplicate(
          room,
          player,
          submittedWord,
          callback
        );
      }

      clearTimeout(room.timer);
      room.timer = null;
      room.timerVersion += 1;

      const oldWord = room.currentWord;

      room.previousWord = oldWord;
      room.currentWord = submittedWord;

      room.usedWords.set(
        submittedKey,
        submittedWord
      );

      player.score += 1;

      room.history.push({
        playerId: player.id,
        playerName: player.name,
        previousWord: oldWord,
        word: submittedWord,
        createdAt: Date.now()
      });

      if (room.history.length > 100) {
        room.history.shift();
      }

      if (oldWord) {
        emitNotice(
          room,
          `${player.name} เชื่อม “${oldWord}” กับ “${submittedWord}”`
        );
      } else {
        emitNotice(
          room,
          `${player.name} เริ่มด้วยคำว่า “${submittedWord}”`
        );
      }

      emitPopup(room, {
        type: "answer",
        title: "ตอบสำเร็จ",
        message: oldWord
          ? `${oldWord} → ${submittedWord}`
          : submittedWord,
        duration: 1800
      });

      respond(callback, {
        ok: true
      });

      const next = nextPlayer(
        room,
        room.currentIndex
      );

      if (next >= 0) {
        beginTurn(room, next);
      }
    }
  );

  socket.on("disconnect", () => {
    const room = rooms.get(
      socket.data.roomCode
    );

    if (!room) {
      return;
    }

    const index = room.players.findIndex(
      (player) => player.id === socket.id
    );

    if (index < 0) {
      return;
    }

    const player = room.players[index];

    const wasCurrent =
      room.started &&
      index === room.currentIndex;

    player.connected = false;
    player.alive = false;

    if (socket.id === room.hostId) {
      const newHost = room.players.find(
        (candidate) => candidate.connected
      );

      room.hostId = newHost?.id || null;

      if (newHost) {
        emitNotice(
          room,
          `${newHost.name} เป็นเจ้าของห้องคนใหม่`
        );
      }
    }

    if (removeRoomIfEmpty(room)) {
      return;
    }

    emitNotice(
      room,
      `${player.name} ออกจากห้อง`
    );

    if (!room.started) {
      sendRoom(room);
      return;
    }

    if (finishIfNeeded(room)) {
      return;
    }

    if (wasCurrent) {
      const next = nextPlayer(room, index);

      if (next >= 0) {
        beginTurn(room, next);
      }
    } else {
      sendRoom(room);
    }
  });
});

/* =========================================================
   เริ่มเซิร์ฟเวอร์
========================================================= */

server.listen(PORT, () => {
  console.log(
    `Server started at http://localhost:${PORT}`
  );
});
