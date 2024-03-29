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
await db.execute(`CREATE TABLE IF NOT EXISTS messages5(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT,
  user TEXT,
  color VARCHAR(10),
  room TEXT,
  date VARCHAR(50)
  )`);

app.use(express.static(path.join(__dirname, "public")));
app.set("views", path.join(__dirname, "views")); // Definimos la carpeta de las views
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "views/form.html"));
});

async function listUsers(room) {
  let userList = [];

  // Obtenemos los sockets conectados a la room dada
  let fetchSockets = await io.in(room).fetchSockets();

  // Por cada socket obtendremos su id y su username para enviarlo al conteo de los usuarios online
  fetchSockets.forEach((fetchSocket) => {
    let user = {
      id: fetchSocket.id,
      username: fetchSocket.handshake.auth.username,
    };

    userList = [...userList, user];
  });

  // Enviamos el número de usuarios y el nombre de cada uno a la room dada
  io.to(room).emit("count-users", userList.length, userList);
}

// Middleweare para asignar la propiedad username y room al socket
io.use((socket, next) => {
  socket.username = socket.handshake.auth.username;
  socket.room = socket.handshake.auth.room;
  next();
});

io.on("connection", async (socket) => {
  socket.on("join", () => {
    // Ingreamos al usuario a la room especificada
    socket.join(socket.room);
    // Obtenemos la lista de usuarios
    listUsers(socket.room);

    socket
      .to(socket.room)
      .emit(
        "admin-message",
        `${socket.username} ha ingresado al chat`,
        "Admin",
        "#1B1B1D"
      );
  });

  socket.on("disconnect", (reason) => {
    // Actualizamos la lista de usuarios en dicha room
    listUsers(socket.handshake.auth.room);
  });

  socket.on(
    "chat-message",
    async (message, id, username, serverOffset, color) => {
      try {
        let date = new Date().getTime();
        // Insertamos el mensaje en la DB
        const insert = await db.execute({
          sql: `INSERT INTO messages5 (content, user, color, room, date) VALUES ($message, $username, $color, $room, ${date})`,
          args: {
            message,
            username,
            color,
            room: socket.handshake.auth.room,
          },
        });

        const lastId = parseInt(insert.lastInsertRowid);
        // Emitimos el mensaje a toda la room
        io.to(socket.handshake.auth.room).emit(
          "chat-message",
          message,
          id,
          username,
          lastId,
          color,
          date
        );
      } catch (error) {
        console.log(error);
        return;
      }
    }
  );

  // Si tenemos una conexión nueva...
  if (!socket.recovered) {
    try {
      // Obtenemos los datos en la DB
      const { rows } = await db.execute({
        sql: "SELECT * FROM messages5 WHERE id > $id AND room = $room",
        args: {
          id: socket.handshake.auth.serverOffset,
          room: socket.handshake.auth.room,
        },
      });
      // Emitimos cada uno de los mensajes
      rows.forEach((row) => {
        socket.emit(
          "chat-message",
          row.content,
          row.id,
          row.user,
          socket.handshake.auth.serverOffset,
          row.color,
          row.date,
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
