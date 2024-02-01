// importamos la biblioteca
import { io } from "https://cdn.socket.io/4.3.2/socket.io.esm.min.js";
import { colores } from "./colors.js";

function getRandomColor() {
  // Creamos un array de los colores
  const coloresKeys = Object.keys(colores);

  // Generamos un índice aleatorio
  const indiceAleatorio = Math.floor(Math.random() * coloresKeys.length);

  // Obtenemos el color aleatorio al acceder al indice del array de colores
  const colorAleatorio = colores[coloresKeys[indiceAleatorio]];
  return colorAleatorio;
}

async function setUsernameAndColor(user) {
  localStorage.setItem("username", user);
  let username = user;
  let color = localStorage.getItem("color");

  if (!color) {
    color = getRandomColor();
    localStorage.setItem("color", color);
  }
  return { username, color };
}

function getURLParamsObject() {
  return JSON.parse(
    '{"' +
      decodeURI(location.search.substring(1))
        .replace(/"/g, '\\"')
        .replace(/&/g, '","')
        .replace(/\+/g, " ")
        .replace(/=/g, '":"') +
      '"}'
  );
}

const scrollBottom = () => {
  const height = document.querySelector(".messages ul").offsetHeight; // Obtenemos el height del contenedor de los mensajes
  // Generamos un scroll hasta abajo en los mensajes
  document.querySelector(".messages").scroll({
    top: height,
  });
};

const paramsObject = getURLParamsObject();
const { username, color } = await setUsernameAndColor(paramsObject.username);

const socket = io({
  auth: {
    username,
    color,
    serverOffset: 0,
    room: paramsObject.room,
  },
});
const $input = document.querySelector("textarea");
const $usersCount = document.querySelector(".users-connected p");
const $usersList = document.querySelector(".users-connected ul");

document.addEventListener("DOMContentLoaded", (e) => {
  // Renderizamos el nombre de la room
  document.querySelector(".messages-header p").textContent = paramsObject.room;
});

document.addEventListener("submit", (e) => {
  e.preventDefault();
  // Validamos que el mensaje no se vaya en blanco
  if ($input.value) {
    // Emitimos los datos del mensaje
    socket.emit(
      "chat-message",
      $input.value,
      socket.id,
      localStorage.getItem("username"),
      socket.auth.serverOffset,
      localStorage.getItem("color"),
      true,
      (response) => {
        console.log("client: ", response);
      }
    );
    // Limpiamos el input
    $input.value = "";
  }
});

document.querySelector("textarea").addEventListener("keyup", (e) => {
  e.target.style.height = "2rem"; // Restablecemos la altura a '2rem'
  e.target.style.height = e.target.scrollHeight + "px"; // Establecer la altura según el contenido
  // Los maximos y minimos en el css nos ayudan a definir los limites
});

socket.on("connect", () => {
  // Al conectar el socket ingresamos al cliente a la room dada
  socket.emit("join");
  // Renderizamos el mensaje
  socket.on("admin-message", (message, username, color) => {
    // Generamos la estructura del mensaje nuevo
    const itemMessage = `
      <li>
      <small style="color: ${color}">${username}</small>
      <p>${message}</p>
      </li>
      `;
    // Insertamos el mensaje en el DOM
    document
      .querySelector(".messages-content ul")
      .insertAdjacentHTML("beforeend", itemMessage);

    // Generamos el scroll
    scrollBottom();
  });
});

socket.on("count-users", (count, users) => {
  // Actualizamos el conteo de la lista de usuarios
  $usersCount.textContent = `Usuarios conectados: ${count}`;

  // Iteramos el username de cada cliente conectado en dicha room
  let item = "";

  users.forEach((user) => {
    item += `
        <li>
          <small>${user.username}</small>
        </li>
        `;
  });
  // Limpiamos el listado
  $usersList.innerHTML = null;

  // Escribimos la nueva lista
  $usersList.insertAdjacentHTML("beforeend", item);
});

socket.on("chat-message", (message, id, username, lastId, color) => {
  // Actualizamos el serverOffset
  socket.auth.serverOffset = lastId;

  // Generamos la estructura del mensaje nuevo
  const itemMessage = `
      <li class="${
        username === localStorage.getItem("username") ? "align-self-right" : ""
      }">
      <small style="color: ${color}">${username}</small>
      <p>${message}</p>
      </li>
      `;
  // Insertamos el mensaje en el DOM
  document
    .querySelector(".messages-content ul")
    .insertAdjacentHTML("beforeend", itemMessage);

  // Generamos el scroll
  scrollBottom();
});
