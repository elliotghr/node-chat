import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import morgan from "morgan";
import { fileURLToPath } from "node:url";
import path, { join } from "path";

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

  socket.on("chat-message", (message, id, username, color) => {
    io.emit("chat-message", message, id, username, color);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Example app listening on port http://localhost:${PORT}`);
});
