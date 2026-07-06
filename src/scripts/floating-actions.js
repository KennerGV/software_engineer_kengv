const toggleChatBtn = document.getElementById("toggle-chat");
const chatWindow = document.getElementById("chat-window");
const toggleMenuBtn = document.getElementById("toggle-menu");
const submenuContainer = document.getElementById("submenu-links");
const closeChatBtn = document.getElementById("close-chat-btn");
const floatingTriggers = document.querySelector(".floating-triggers");

if (toggleChatBtn && chatWindow && toggleMenuBtn && submenuContainer && floatingTriggers) {
  const setTriggersVisibility = (visible) => {
    if (visible) {
      floatingTriggers.classList.remove("hidden");
    } else {
      floatingTriggers.classList.add("hidden");
    }
  };

  toggleChatBtn.addEventListener("click", () => {
    chatWindow.classList.toggle("hidden");
    setTriggersVisibility(chatWindow.classList.contains("hidden"));
    submenuContainer.classList.remove("open");
    toggleMenuBtn.classList.remove("active");
  });

  toggleMenuBtn.addEventListener("click", () => {
    submenuContainer.classList.toggle("open");
    toggleMenuBtn.classList.toggle("active");
    chatWindow.classList.add("hidden");
    setTriggersVisibility(true);
  });

  // Añadimos el listener para el nuevo botón de cerrar
  closeChatBtn?.addEventListener("click", () => {
    toggleChatBtn.click(); // Reutilizamos la lógica de cierre existente
  });
}

const prepareForPrint = () => {
  const detailsContact = document.querySelector(".contact-accordion");
  const detailsEducation = document.querySelector(".education-accordion");
  if (detailsContact) detailsContact.setAttribute("open", "");
  if (detailsEducation) detailsEducation.setAttribute("open", "");
};

window.onbeforeprint = prepareForPrint;

const printCvBtn = document.getElementById("print-cv-btn");
printCvBtn?.addEventListener("click", () => {
  prepareForPrint();
  window.print();
});

const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatSubmitBtn = chatForm?.querySelector('button[type="submit"]');

function deshabilitarChatInput(placeholderTexto) {
  if (chatInput) chatInput.disabled = true;
  if (chatSubmitBtn) chatSubmitBtn.disabled = true;
  if (chatInput) chatInput.placeholder = placeholderTexto;
}

function habilitarChatInput(placeholderOriginal = "Escribe un mensaje...") {
  if (chatInput) chatInput.disabled = false;
  if (chatSubmitBtn) chatSubmitBtn.disabled = false;
  if (chatInput) {
    chatInput.placeholder = placeholderOriginal;
    chatInput.focus();
  }
}

function appendMessage(text, role) {
  if (!chatMessages) return null;

  const msgDiv = document.createElement("div");
  msgDiv.classList.add("message", `message--${role}`);

  const contentDiv = document.createElement("div");
  contentDiv.classList.add("message-content", `message-content--${role}`);
  contentDiv.textContent = text;

  msgDiv.appendChild(contentDiv);
  chatMessages.appendChild(msgDiv);

  chatMessages.scrollTop = chatMessages.scrollHeight;
  return contentDiv;
}

function renderAppointmentPrompt(assistantMessageDiv) {
  const parentMessageBlock = assistantMessageDiv?.closest(".message");
  if (parentMessageBlock) {
    parentMessageBlock.remove();
  }

  deshabilitarChatInput("Por favor, selecciona una opción en el menú de arriba...");

  const promptContainer = document.createElement("div");
  promptContainer.classList.add("message", "message--system");

  promptContainer.innerHTML = `
    <div class="appointment-prompt">
      <p class="appointment-prompt__text">📅 ¿Te gustaría agendar una entrevista o reunión corta directamente en mi Google Calendar?</p>
      <div class="appointment-prompt__actions">
        <button id="btn-agenda-si" class="button button--primary">Sí, agendar ahora</button>
        <button id="btn-agenda-no" class="button button--secondary">No, gracias</button>
      </div>
    </div>
  `;

  chatMessages?.appendChild(promptContainer);
  chatMessages && (chatMessages.scrollTop = chatMessages.scrollHeight);

  document.getElementById("btn-agenda-si")?.addEventListener("click", () => {
    deshabilitarChatInput("Conectando con Google Calendar...");
    console.log("Iniciando pasarela de autenticación de Google...");
  });

  document.getElementById("btn-agenda-no")?.addEventListener("click", (e) => {
    const target = e.target;
    const promptBox = target.closest(".appointment-prompt");
    if (promptBox) {
      promptBox.classList.add("appointment-prompt--dismissed");
    }

    habilitarChatInput();
    appendMessage("Entendido, podemos seguir conversando por texto.", "assistant");
  });
}

chatForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const messageText = chatInput?.value.trim();
  if (!messageText) return;

  appendMessage(messageText, "user");
  if (chatInput) chatInput.value = "";

  const assistantMessageDiv = appendMessage("", "assistant");

  let cleanHTML = "";
  let activeFormatText = "";
  let isInsideBold = false;

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({message: messageText}),
    });

    if (!response.ok || !response.body) throw new Error("Error de conexión.");

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          let content = line.replace("data: ", "");

          if (content.trim() === "[DONE]") {
            break;
          } else if (content.startsWith("❌")) {
            assistantMessageDiv.textContent = content;
          } else {
            if (content.startsWith("{") && content.endsWith("}")) {
              try {
                const jsonEvent = JSON.parse(content);
                if (jsonEvent.action === "SHOW_APPOINTMENT_PROMPT") {
                  renderAppointmentPrompt(assistantMessageDiv);
                  return;
                }
              } catch {
                // Ignorar si el cuerpo no es JSON
              }
            }

            content = content.replace(/【[^】]*】/g, "");

            let i = 0;
            while (i < content.length) {
              if (content.substring(i, i + 2) === "**") {
                isInsideBold = !isInsideBold;

                if (!isInsideBold) {
                  cleanHTML += `<strong>${activeFormatText}</strong>`;
                  activeFormatText = "";
                }
                i += 2;
                continue;
              }

              const char = content[i];
              if (isInsideBold) {
                activeFormatText += char;
              } else {
                cleanHTML += char.replace(/\n/g, "<br>");
              }
              i++;
            }

            if (isInsideBold) {
              assistantMessageDiv.innerHTML = `${cleanHTML}<strong>${activeFormatText}</strong>`;
            } else {
              assistantMessageDiv.innerHTML = cleanHTML;
            }

            chatMessages.scrollTop = chatMessages.scrollHeight;
          }
        }
      }
    }
  } catch (error) {
    console.error(error);
    if (assistantMessageDiv) {
      assistantMessageDiv.textContent = "❌ Hubo un error de conexión al intentar obtener la respuesta.";
    }
  }
});
