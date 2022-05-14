const path = require("path");
const http = require("http");
const debug = require("debug");
const express = require("express");
const socketIO = require("socket.io");
const fallback = require("express-history-api-fallback");

const ioDebug = debug("io");
const socketDebug = debug("socket");

const app = express();
const port = parseInt(
  process.env.NODE_ENV === "production" ? process.env.BLOCKLET_PORT : 3030,
  10,
);

app.set("trust proxy", true);

if (process.env.NODE_ENV === "production") {
  const staticDir = path.resolve(__dirname, "../", "build");
  app.use(express.static(staticDir, { index: "index.html" }));
  app.use(fallback("index.html", { root: staticDir }));
}

const server = http.createServer(app);

server.listen(port, () => {
  console.info(`listening on port: ${port}`);
});

const io = socketIO(server, {
  handlePreflightRequest: (req, res) => {
    const headers = {
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true,
    };
    res.writeHead(200, headers);
    res.end();
  },
});

io.on("connection", (socket) => {
  ioDebug("connection established!");
  io.to(`${socket.id}`).emit("init-room");
  socket.on("join-room", (roomID) => {
    socketDebug(`${socket.id} has joined ${roomID}`);
    socket.join(roomID);
    if (io.sockets.adapter.rooms[roomID].length <= 1) {
      io.to(`${socket.id}`).emit("first-in-room");
    } else {
      socket.broadcast.to(roomID).emit("new-user", socket.id);
    }
    io.in(roomID).emit(
      "room-user-change",
      Object.keys(io.sockets.adapter.rooms[roomID].sockets),
    );
  });

  socket.on("server-broadcast", (roomID, encryptedData, iv) => {
    socketDebug(`${socket.id} sends update to ${roomID}`);
    socket.broadcast.to(roomID).emit("client-broadcast", encryptedData, iv);
  });

  socket.on("server-volatile-broadcast", (roomID, encryptedData, iv) => {
    socketDebug(`${socket.id} sends volatile update to ${roomID}`);
    socket.volatile.broadcast
      .to(roomID)
      .emit("client-broadcast", encryptedData, iv);
  });

  socket.on("disconnecting", () => {
    const rooms = io.sockets.adapter.rooms;
    for (const roomID in socket.rooms) {
      const clients = Object.keys(rooms[roomID].sockets).filter(
        (id) => id !== socket.id,
      );
      if (clients.length > 0) {
        socket.broadcast.to(roomID).emit("room-user-change", clients);
      }
    }
  });

  socket.on("disconnect", () => {
    socket.removeAllListeners();
  });
});
