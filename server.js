const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();

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
  return String(value || "").trim().slice(0, 20);
}

function cleanWord(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("th-TH")
    .replace(/\s+/g, "");
}

function letters(word) {
  return cleanWord(word).match(/[ก-ฮa-z]/gi) || [];
}

function firstLetter(word) {
  const list = letters(word);
  return list[0]?.toLowerCase() || "";
}

function lastLetter(word) {
  const list = letters(word);
  return list.at(-1)?.toLowerCase() || "";
}

function alivePlayers(room) {
  return room.players.filter(
    (player) => player.connected && player.alive
  );
}

function nextPlayer(room, currentIndex) {
  for (let offset = 1; offset <= room.players.length; offset++) {
    const index = (currentIndex + offset) % room.players.length;
    const player = room.players[index];

    if (player.connected && player.alive) {
      return index;
    }
  }

  return -1;
}

function publicRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    started: room.started,
    currentWord: room.currentWord,
    usedWords: [...room.usedWords],
    turnId: room.started
      ? room.players[room.currentIndex]?.id
      : null,
    deadline: room.deadline,
    turnSeconds: alivePlayers(room).length <= 3 ? 5 : 10,
    winner: room.winner,
    players: room.players
      .filter((player) => player.connected)
      .map((player) => ({
        id: player.id,
        name: player.name,
        alive: player.alive,
        score: player.score
      }))
  };
}

function sendRoom(room) {
  io.to(room.code).emit("roomState", publicRoom(room));
}

function finishIfNeeded(room) {
  const alive = alivePlayers(room);

  if (alive.length > 1) return false;

  clearTimeout(room.timer);
  room.started = false;
  room.deadline = 0;
  room.winner = alive[0]?.name || "ไม่มีผู้ชนะ";

  sendRoom(room);
  io.to(room.code).emit("notice", `จบเกม: ${room.winner} ชนะ`);
  return true;
}

function beginTurn(room, index) {
  clearTimeout(room.timer);

  if (finishIfNeeded(room)) return;

  room.currentIndex = index;
  const seconds = alivePlayers(room).length <= 3 ? 5 : 10;

  room.deadline = Date.now() + seconds * 1000;
  sendRoom(room);

  room.timer = setTimeout(() => {
    const player = room.players[room.currentIndex];

    if (player?.connected && player.alive) {
      player.alive = false;
      io.to(room.code).emit(
        "notice",
        `${player.name} หมดเวลาและถูกคัดออก`
      );
    }

    if (finishIfNeeded(room)) return;

    const next = nextPlayer(room, room.currentIndex);
    if (next >= 0) beginTurn(room, next);
  }, seconds * 1000);
}

io.on("connection", (socket) => {
  socket.on("createRoom", ({ name }, callback) => {
    const playerName = cleanName(name);

    if (!playerName) {
      return callback({ ok: false, error: "กรุณากรอกชื่อ" });
    }

    const code = makeCode();
    const room = {
      code,
      hostId: socket.id,
      players: [{
        id: socket.id,
        name: playerName,
        alive: true,
        connected: true,
        score: 0
      }],
      usedWords: new Set(),
      currentWord: "",
      currentIndex: 0,
      started: false,
      deadline: 0,
      winner: null,
      timer: null
    };

    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;

    sendRoom(room);
    callback({ ok: true, code });
  });

  socket.on("joinRoom", ({ name, code }, callback) => {
    const playerName = cleanName(name);
    const roomCode = String(code || "").trim().toUpperCase();
    const room = rooms.get(roomCode);

    if (!playerName) {
      return callback({ ok: false, error: "กรุณากรอกชื่อ" });
    }

    if (!room) {
      return callback({ ok: false, error: "ไม่พบห้องนี้" });
    }

    if (room.started) {
      return callback({
        ok: false,
        error: "เกมเริ่มแล้ว ไม่สามารถเข้ากลางเกมได้"
      });
    }

    const nameUsed = room.players.some(
      (player) =>
        player.connected &&
        player.name.toLowerCase() === playerName.toLowerCase()
    );

    if (nameUsed) {
      return callback({
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
    callback({ ok: true, code: roomCode });
  });

  socket.on("startGame", (callback) => {
    const room = rooms.get(socket.data.roomCode);

    if (!room) {
      return callback?.({ ok: false, error: "ไม่พบห้อง" });
    }

    if (socket.id !== room.hostId) {
      return callback?.({
        ok: false,
        error: "เฉพาะเจ้าของห้องเท่านั้นที่เริ่มเกมได้"
      });
    }

    room.players = room.players.filter(
      (player) => player.connected
    );

    if (room.players.length < 2) {
      return callback?.({
        ok: false,
        error: "ต้องมีผู้เล่นอย่างน้อย 2 คน"
      });
    }

    room.players.forEach((player) => {
      player.alive = true;
      player.score = 0;
    });

    room.usedWords.clear();
    room.currentWord = "";
    room.currentIndex = 0;
    room.deadline = 0;
    room.winner = null;
    room.started = true;

    io.to(room.code).emit("notice", "เริ่มเกมแล้ว");
    beginTurn(room, 0);
    callback?.({ ok: true });
  });

  socket.on("submitWord", ({ word }, callback) => {
    const room = rooms.get(socket.data.roomCode);

    if (!room?.started) {
      return callback?.({
        ok: false,
        error: "เกมยังไม่เริ่ม"
      });
    }

    const player = room.players[room.currentIndex];

    if (player?.id !== socket.id) {
      return callback?.({
        ok: false,
        error: "ยังไม่ถึงตาของคุณ"
      });
    }

    const submittedWord = cleanWord(word);

    if (letters(submittedWord).length < 2) {
      return callback?.({
        ok: false,
        error: "กรุณาพิมพ์คำอย่างน้อย 2 ตัวอักษร"
      });
    }

    if (room.usedWords.has(submittedWord)) {
      return callback?.({
        ok: false,
        error: "คำนี้ถูกใช้ไปแล้ว"
      });
    }

    if (
      room.currentWord &&
      firstLetter(submittedWord) !== lastLetter(room.currentWord)
    ) {
      return callback?.({
        ok: false,
        error: `คำต้องขึ้นต้นด้วย “${lastLetter(room.currentWord)}”`
      });
    }

    clearTimeout(room.timer);
    room.usedWords.add(submittedWord);
    room.currentWord = submittedWord;
    player.score += 1;

    io.to(room.code).emit(
      "notice",
      `${player.name} ตอบว่า “${submittedWord}”`
    );

    callback?.({ ok: true });

    const next = nextPlayer(room, room.currentIndex);
    if (next >= 0) beginTurn(room, next);
  });

  socket.on("disconnect", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;

    const index = room.players.findIndex(
      (player) => player.id === socket.id
    );

    if (index < 0) return;

    const wasCurrent =
      room.started && index === room.currentIndex;

    room.players[index].connected = false;
    room.players[index].alive = false;

    if (socket.id === room.hostId) {
      const newHost = room.players.find(
        (player) => player.connected
      );
      room.hostId = newHost?.id || null;
    }

    if (room.started) {
      if (finishIfNeeded(room)) return;

      if (wasCurrent) {
        const next = nextPlayer(room, index);
        if (next >= 0) beginTurn(room, next);
      } else {
        sendRoom(room);
      }
    } else {
      sendRoom(room);
    }

    if (!room.players.some((player) => player.connected)) {
      clearTimeout(room.timer);
      rooms.delete(room.code);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
