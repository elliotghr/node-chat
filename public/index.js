// importamos la biblioteca
import { io } from "https://cdn.socket.io/4.3.2/socket.io.esm.min.js";
import { colores } from "./colors.js";

function getRandomColor() {
  const coloresKeys = Object.keys(colores);

  // Generar un índice aleatorio
  const indiceAleatorio = Math.floor(Math.random() * coloresKeys.length);

  // Obtener el color aleatorio
  const colorAleatorio = colores[coloresKeys[indiceAleatorio]];
  return colorAleatorio;
}

async function setUsernameAndColor() {
  let username = localStorage.getItem("username");
  let color = localStorage.getItem("color");

  if (!username || !color) {
    username = prompt("Escribe tu username");
    color = getRandomColor();
    localStorage.setItem("username", username);
    localStorage.setItem("color", color);
  }
  return { username, color };
}

const { username, color } = await setUsernameAndColor();

const socket = io({
  auth: {
    username,
    color,
    serverOffset: 0,
  },
});
const $input = document.querySelector("input");
const $usersCount = document.querySelector(".users-connected p");
const $usersList = document.querySelector(".users-connected ul");

const scrollBottom = () => {
  const height = document.querySelector(".messages ul").offsetHeight;
  document.querySelector(".messages").scroll({
    top: height,
  });
};

socket.on("count-users", (count, users) => {
  $usersCount.textContent = `Usuarios conectados: ${count}`;
  let item = "";

  users.forEach((user) => {
    item += `
        <li>
          <small>${user.username}</small>
        </li>
        `;
  });
  $usersList.innerHTML = null;
  $usersList.insertAdjacentHTML("beforeend", item);
});

socket.on("chat-message", (message, id, username, lastId, color) => {
  socket.auth.serverOffset = lastId;

  const itemMessage = `
      <li class="${
        username === localStorage.getItem("username") ? "align-self-right" : ""
      }">
      <small style="color: ${color}">${username}</small>
      <p>${message}</p>
      </li>
      `;
  document
    .querySelector(".messages-content ul")
    .insertAdjacentHTML("beforeend", itemMessage);
  scrollBottom();
});

document.addEventListener("submit", (e) => {
  e.preventDefault();
  if ($input.value) {
    socket.emit(
      "chat-message",
      $input.value,
      socket.id,
      localStorage.getItem("username"),
      socket.auth.serverOffset,
      localStorage.getItem("color")
    );
    $input.value = "";
  }
});
