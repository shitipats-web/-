import "dotenv/config";
import express from "express";
import http from "node:http";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("กรุณาตั้งค่า OPENAI_API_KEY ในไฟล์ .env");
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 8192 });

app.disable("x-powered-by");
app.use(express.static(fileURLToPath(new URL("./public", import.meta.url))));

const ai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 8000,
  maxRetries: 0
});

const rooms = new Map();
const MAX_PLAYERS = 8;
const MAX_ROOMS = 200;

function normalizeWord(value) {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ");
}

function firstConsonant(word) {
  return word.match(/[ก-ฮ]/u)?.[0] ?? "";
}

function alivePlayers(room) {
  return room.players.filter(p => p.alive && p.connected);
}

function currentPlayer(room) {
  return room.players[room.turn];
}

function broadcast(room) {
  io.to(room.code).emit("state", {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    players: room.players,
    currentId: room.status === "playing" ? currentPlayer(room)?.id : null,
    deadline: room.deadline,
    duration: room.duration,
    remaining: room.remaining,
    validating: room.validating,
    serverNow: Date.now(),
    history: room.history,
    usedLetters: [...room.usedLetters],
    winner: room.winner
  });
}

function notify(room, kind, title, detail = "") {
  io.to(room.code).emit("notice", { kind, title, detail });
}

function clearTurn(room) {
  clearTimeout(room.timer);
  room.timer = null;
  room.token++;
  room.validating = false;
}

function finishIfNeeded(room) {
  const alive = alivePlayers(room);
  if (alive.length > 1) return false;

  clearTurn(room);
  room.status = "ended";
  room.deadline = 0;
  room.remaining = 0;
  room.winner = alive[0] ? { id: alive[0].id, name: alive[0].name } : null;

  broadcast(room);
  notify(room, "winner", room.winner ? `${room.winner.name} ชนะ!` : "จบเกม", room.winner ? "เป็นคนสุดท้ายที่ยังอยู่ในเกม" : "ไม่มีผู้เล่นเหลือ");
  return true;
}

function scheduleTimeout(room, milliseconds) {
  clearTimeout(room.timer);
  const token = room.token;
  const playerId = currentPlayer(room)?.id;

  room.remaining = milliseconds;
  room.deadline = Date.now() + milliseconds;

  room.timer = setTimeout(() => {
    if (rooms.get(room.code) !== room || room.status !== "playing" || room.token !== token || room.validating || currentPlayer(room)?.id !== playerId) return;
    eliminateCurrent(room, "หมดเวลาตอบ");
  }, milliseconds);
}

function startTurn(room) {
  clearTurn(room);
  if (finishIfNeeded(room)) return;

  room.duration = alivePlayers(room).length === 2 ? 10000 : 15000;
  scheduleTimeout(room, room.duration);
  broadcast(room);
}

function nextTurn(room) {
  if (finishIfNeeded(room)) return;
  for (let i = 0; i < room.players.length; i++) {
    room.turn = (room.turn + 1) % room.players.length;
    const p = currentPlayer(room);
    if (p.alive && p.connected) {
      startTurn(room);
      return;
    }
  }
}

function eliminateCurrent(room, reason, word = "") {
  const player = currentPlayer(room);
  if (!player || room.status !== "playing") return;

  player.alive = false;
  player.reason = reason;
  notify(room, "error", `${player.name} ตกรอบ`, `${word ? `“${word}” — ` : ""}${reason}`);
  nextTurn(room);
}

async function judgeWord(word, previous) {
  const completion = await ai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "คุณเป็นกรรมการเกมเชื่อมคำนามภาษาไทย ตรวจสอบว่าคำเป็นคำนามและเชื่อมโยงกับคำก่อนหน้าหรือไม่ ตอบกลับเป็น JSON ที่มี isNoun (boolean), related (boolean), reason (string ภาษาไทยสั้นๆ)"
      },
      {
        role: "user",
        content: JSON.stringify({ candidate: word, previous: previous || null })
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "noun_judgment",
        strict: true,
        schema: {
          type: "object",
          properties: {
            isNoun: { type: "boolean" },
            related: { type: "boolean" },
            reason: { type: "string" }
          },
          required: ["isNoun", "related", "reason"],
          additionalProperties: false
        }
      }
    }
  });

  const message = completion.choices[0]?.message;
  if (!message?.content || message.refusal) throw new Error("ผลการตัดสินผิดพลาด");
  return JSON.parse(message.content);
}

function generateRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from({ length: 6 }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function sanitizeName(value) {
  if (typeof value !== "string") return "";
  return value.normalize("NFC").replace(/[\p{Cc}\p{Cf}]/gu, "").trim().slice(0, 20);
}

io.on("connection", socket => {
  let lastAction = 0;
  const error = message => socket.emit("errorMessage", message);
  const getRoom = () => rooms.get(socket.data.roomCode);
  const allowAction = () => {
    const now = Date.now();
    if (now - lastAction < 350) return false;
    lastAction = now;
    return true;
  };

  function addPlayer(room, name) {
    room.players.push({ id: socket.id, name, connected: true, alive: true, reason: "" });
    socket.data.roomCode = room.code;
    socket.join(room.code);
    socket.emit("joined", { code: room.code });
    broadcast(room);
  }

  socket.on("createRoom", payload => {
    if (!allowAction()) return;
    if (getRoom()) return error("คุณอยู่ในห้องแล้ว");
    const name = sanitizeName(payload?.name);
    if (!name) return error("กรุณาใส่ชื่อผู้เล่น");

    const code = generateRoomCode();
    const room = {
      code, hostId: socket.id, status: "lobby", players: [], turn: 0,
      timer: null, token: 0, deadline: 0, duration: 15000, remaining: 15000,
      validating: false, history: [], usedWords: new Set(), usedLetters: new Set(), winner: null
    };
    rooms.set(code, room);
    addPlayer(room, name);
  });

  socket.on("joinRoom", payload => {
    if (!allowAction()) return;
    if (getRoom()) return error("คุณอยู่ในห้องแล้ว");
    const name = sanitizeName(payload?.name);
    const code = typeof payload?.code === "string" ? payload.code.trim().toUpperCase() : "";
    const room = rooms.get(code);

    if (!name) return error("กรุณาใส่ชื่อผู้เล่น");
    if (!room) return error("ไม่พบห้องนี้");
    if (room.status !== "lobby") return error("ห้องนี้เริ่มเกมแล้ว");
    if (room.players.length >= MAX_PLAYERS) return error("ห้องเต็มแล้ว");

    addPlayer(room, name);
    notify(room, "info", `${name} เข้าห้องแล้ว`);
  });

  socket.on("startGame", () => {
    if (!allowAction()) return;
    const room = getRoom();
    if (!room || room.hostId !== socket.id || room.status !== "lobby") return;
    if (room.players.length < 2) return error("ต้องมีผู้เล่นอย่างน้อย 2 คน");

    room.players.forEach(p => { p.alive = true; p.reason = ""; });
    room.status = "playing";
    room.turn = 0;
    room.history = [];
    room.usedWords.clear();
    room.usedLetters.clear();
    room.winner = null;

    startTurn(room);
    notify(room, "info", "เริ่มเกม!", "คนแรกเริ่มด้วยคำนามอะไรก็ได้");
  });

  socket.on("resetGame", () => {
    if (!allowAction()) return;
    const room = getRoom();
    if (!room || room.hostId !== socket.id || room.status !== "ended") return;

    clearTurn(room);
    room.players = room.players.filter(p => p.connected);
    room.players.forEach(p => { p.alive = true; p.reason = ""; });
    room.status = "lobby";
    room.turn = 0;
    room.history = [];
    room.usedWords.clear();
    room.usedLetters.clear();
    room.winner = null;
    room.deadline = 0;

    broadcast(room);
  });

  socket.on("submitWord", async payload => {
    if (!allowAction()) return;
    const room = getRoom();
    if (!room || room.status !== "playing" || room.validating || currentPlayer(room)?.id !== socket.id) return;
    if (Date.now() >= room.deadline) { eliminateCurrent(room, "หมดเวลาตอบ"); return; }

    const word = normalizeWord(payload?.word);
    if (!word || !/^[\u0E01-\u0E3A\u0E40-\u0E4C ]+$/u.test(word)) {
      return error("ใช้คำภาษาไทย ความยาวไม่เกิน 40 ตัวอักษร");
    }

    const initial = firstConsonant(word);
    const wordKey = word.replace(/\s/gu, "");

    if (room.usedWords.has(wordKey)) { eliminateCurrent(room, "คำนี้ถูกใช้ไปแล้ว", word); return; }
    if (room.usedLetters.has(initial)) { eliminateCurrent(room, `พยัญชนะต้น “${initial}” ถูกใช้ไปแล้ว`, word); return; }

    const remaining = Math.max(1, room.deadline - Date.now());
    clearTimeout(room.timer);
    room.timer = null;
    room.remaining = remaining;
    room.validating = true;

    const token = ++room.token;
    const previous = room.history.at(-1)?.word || null;
    broadcast(room);

    function stillCurrent() {
      return rooms.get(room.code) === room && room.status === "playing" && room.token === token && currentPlayer(room)?.id === socket.id;
    }

    try {
      const result = await judgeWord(word, previous);
      if (!stillCurrent()) return;
      room.validating = false;

      if (!result.isNoun || (previous && !result.related)) {
        const reason = !result.isNoun ? `ไม่ผ่านเกณฑ์คำนาม: ${result.reason}` : `ไม่เชื่อมโยงกับคำก่อนหน้า: ${result.reason}`;
        eliminateCurrent(room, reason, word);
        return;
      }

      const player = currentPlayer(room);
      room.usedWords.add(wordKey);
      room.usedLetters.add(initial);
      room.history.push({ id: crypto.randomUUID(), playerId: player.id, playerName: player.name, word, initial, reason: result.reason });

      notify(room, "success", word, `${player.name} · ${result.reason}`);
      nextTurn(room);
    } catch (err) {
      if (!stillCurrent()) return;
      room.validating = false;
      scheduleTimeout(room, Math.max(3000, remaining));
      broadcast(room);
      error("ตัวตรวจภาษาขัดข้อง กรุณาลองส่งอีกครั้ง");
    }
  });

  socket.on("disconnect", () => {
    const room = getRoom();
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    const wasCurrent = currentPlayer(room)?.id === socket.id;
    player.connected = false;
    player.alive = false;
    player.reason = "ออกจากห้อง";

    const connected = room.players.filter(p => p.connected);
    if (!connected.length) { clearTurn(room); rooms.delete(room.code); return; }
    if (room.hostId === socket.id) room.hostId = connected[0].id;

    if (room.status === "playing") {
      if (wasCurrent) { clearTurn(room); nextTurn(room); }
      else if (!finishIfNeeded(room)) broadcast(room);
    } else {
      room.players = connected;
      broadcast(room);
    }
  });
});

const port = Number(process.env.PORT || 3000);
server.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on port ${port}`);
});
