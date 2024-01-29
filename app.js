import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path, { join } from "node:path";
import { Server } from "socket.io";
import morgan from "morgan";
import { createClient } from "@libsql/client";
import "dotenv/config";
import { config } from "./socketConfig.js";

const PORT = process.env.PORT ?? 3002;
const __dirname = fileURLToPath(new URL(".", import.meta.url)); // nueva manera de especificar la carpeta de trabajo en windows

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  connectionStateRecovery: {
    // the backup duration of the sessions and the packets
    maxDisconnectionDuration: 2 * 60 * 1000,
    // whether to skip middlewares upon successful recovery
    skipMiddlewares: true,
  },
});

const db = createClient(config);
await db.execute(`CREATE TABLE IF NOT EXISTS messages2(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT,
  user TEXT,
  color VARCHAR(10)
  )`);

app.use(express.static(path.join(__dirname, "public")));
app.set("views", path.join(__dirname, "views")); // Definimos la carpeta de las views
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "views/index.html"));
});

async function listUsers() {
  let userList = [];
  // Obtenemos las instancias de los sockets
  const sockets = await io.fetchSockets();

  sockets.forEach((connectedSocket) => {
    // Acceder al objeto handshake de cada socket
    const handshake = connectedSocket.handshake;

    // Accedemos a campos específicos del handshake
    let username = handshake.auth.username;

    let user = {
      id: connectedSocket.id,
      username,
    };

    userList = [...userList, user];
  });

  io.emit("count-users", io.engine.clientsCount, userList);
}

io.on("connection", async (socket) => {
  listUsers();

  socket.on("disconnect", (reason) => {
    listUsers();
  });

  socket.on(
    "chat-message",
    async (message, id, username, serverOffset, color) => {
      try {
        const insert = await db.execute({
          sql: "INSERT INTO messages2 (content, user, color) VALUES ($message, $username, $color)",
          args: { message, username, color },
        });

        const lastId = parseInt(insert.lastInsertRowid);
        io.emit("chat-message", message, id, username, lastId, color);
      } catch (error) {
        console.log(error);
        return;
      }
    }
  );

  if (!socket.recovered) {
    try {
      const messages = await db.execute({
        sql: "SELECT * FROM messages2 WHERE id > ?",
        args: [socket.handshake.auth.serverOffset],
      });
      messages.rows.forEach((row) => {
        socket.emit(
          "chat-message",
          row.content,
          row.id,
          row.user,
          socket.handshake.auth.color,
          row.color
        );
      });
    } catch (error) {
      console.log(error);
    }
  }
});

httpServer.listen(PORT, () => {
  console.log(`Example app listening on port http://localhost:${PORT}`);
});
