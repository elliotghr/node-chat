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

const username = localStorage.getItem("username");
if (!username) {
  const username = prompt("Escribe tu username");
  localStorage.setItem("username", username);
  localStorage.setItem("color", getRandomColor());
}

const socket = io({
  auth: {
    username,
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

socket.on("chat-message", (message, id, username, color) => {
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
      localStorage.getItem("color")
    );
    $input.value = "";
  }
});
