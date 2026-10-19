import {
  getChatTexts,
  renderizarFragmento,
  simularStreamTexto,
  persistChatState,
  restoreChatState,
} from "./chat-renderer.js";
import {
  initRibbonDrag,
  mostrarLoaderSistema,
  renderAppointmentPrompt,
} from "./calendar-widget.js";

const toggleChatBtn = document.getElementById("toggle-chat");
const chatWindow = document.getElementById("chat-window");
const toggleMenuBtn = document.getElementById("toggle-menu");
const submenuContainer = document.getElementById("submenu-links");
const closeChatBtn = document.getElementById("close-chat-btn");
const floatingTriggers = document.querySelector(".floating-triggers");
const chatContainer = document.getElementById("chat-container") || document.body;
const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatSubmitBtn = chatForm?.querySelector('button[type="submit"]');
const printCvStorageKey = "kener-print-cv-pending";

// 1. Inicializar arrastre de cinta de días y restaurar sesión
initRibbonDrag(chatContainer);
restoreChatState(chatMessages, chatWindow, floatingTriggers);

// 2. Control de botones flotantes (FAB) y ventana de chat
if (toggleChatBtn && chatWindow && toggleMenuBtn && submenuContainer && floatingTriggers) {
  const isMobile = () => window.matchMedia("(max-width: 1024px)").matches;

  const setTriggersVisibility = (visible) => {
    if (isMobile()) {
      floatingTriggers.classList.toggle("hidden", !visible);
    } else {
      floatingTriggers.classList.remove("hidden");
    }
  };

  toggleChatBtn.addEventListener("click", () => {
    chatWindow.classList.toggle("hidden");
    setTriggersVisibility(chatWindow.classList.contains("hidden"));

    const container = document.querySelector(".app-container");
    if (container) {
      const isOpen = !chatWindow.classList.contains("hidden");
      container.classList.toggle("is-chat-open", isOpen);
    }
    persistChatState(chatMessages, chatWindow);
    submenuContainer.classList.remove("open");
    toggleMenuBtn.classList.remove("active");
  });

  toggleMenuBtn.addEventListener("click", () => {
    submenuContainer.classList.toggle("open");
    toggleMenuBtn.classList.toggle("active");
    chatWindow.classList.add("hidden");
    setTriggersVisibility(true);
    persistChatState(chatMessages, chatWindow);
  });

  closeChatBtn?.addEventListener("click", () => {
    toggleChatBtn.click();
  });
}

// 3. Impresión de CV en PDF
const prepareForPrint = () => {
  const detailsContact = document.querySelector(".contact-accordion");
  const detailsEducation = document.querySelector(".education-accordion");
  if (detailsContact) detailsContact.setAttribute("open", "");
  if (detailsEducation) detailsEducation.setAttribute("open", "");
};

window.onbeforeprint = prepareForPrint;

const printCvBtn = document.getElementById("print-cv-btn");
printCvBtn?.addEventListener("click", () => {
  const cvUrl = printCvBtn.dataset.cvUrl;
  const cvPath = cvUrl
    ? new URL(cvUrl, window.location.origin).pathname
    : window.location.pathname;

  if (window.location.pathname !== cvPath) {
    sessionStorage.setItem(printCvStorageKey, "true");
    window.location.assign(cvUrl);
    return;
  }

  prepareForPrint();
  window.print();
});

if (sessionStorage.getItem(printCvStorageKey) === "true") {
  sessionStorage.removeItem(printCvStorageKey);
  setTimeout(() => {
    prepareForPrint();
    window.print();
  }, 0);
}

// 4. Control de Input y Mensajes del Chat
function deshabilitarChatInput() {
  const textos = getChatTexts();
  if (chatInput) {
    chatInput.disabled = true;
    chatInput.placeholder = textos.placeholderDeshabilitado;
  }
  if (chatSubmitBtn) chatSubmitBtn.disabled = true;
}

function habilitarChatInput() {
  const textos = getChatTexts();
  if (chatInput) {
    chatInput.disabled = false;
    chatInput.placeholder = textos.placeholderChat;
    chatInput.focus();
  }
  if (chatSubmitBtn) chatSubmitBtn.disabled = false;
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

const calendarCallbacks = {
  deshabilitarChatInput,
  habilitarChatInput,
  onConfirmSlot: async (slotISO, fechaLegible, assistantMessageDiv) => {
    const textos = getChatTexts();
    deshabilitarChatInput();
    const assistantLoaderDiv = mostrarLoaderSistema(
      assistantMessageDiv,
      textos.loaderAgendando
    );
    const mensajeReserva = textos.isEnglish
      ? `Please confirm and book my meeting on ${fechaLegible}.`
      : `Por favor confirma y agenda mi reunión para el ${fechaLegible}.`;

    try {
      await sendQueryToAI(mensajeReserva, false, slotISO, assistantLoaderDiv);
    } catch (error) {
      console.error(error);
      appendMessage(textos.errorAgenda, "assistant");
      habilitarChatInput();
    }
  },
};

chatForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const messageText = chatInput?.value.trim();
  if (!messageText) return;

  if (chatInput) chatInput.value = "";
  await sendQueryToAI(messageText, true);
});

async function sendQueryToAI(
  messageText,
  showInUi = true,
  bookingSlot = null,
  existingTargetDiv = null
) {
  if (!messageText) return;
  const textos = getChatTexts();

  if (showInUi) {
    appendMessage(messageText, "user");
  }

  const assistantMessageDiv = existingTargetDiv || appendMessage("", "assistant");
  const estadoIA = { rawText: "" };
  let firstChunkReceived = false;
  let holdsInteractiveWidget = false;

  try {
    const payload = { message: messageText };
    if (bookingSlot) {
      payload.bookingSlot = bookingSlot;
    }

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok || !response.body) throw new Error(textos.connectionError);

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const rawLine of lines) {
        const line = rawLine.trimStart();
        if (!line.startsWith("data: ")) continue;
        const content = line.slice(6);

        if (content.trim() === "[DONE]") {
          break;
        } else if (content.startsWith("❌")) {
          assistantMessageDiv.textContent = textos.errorAgent;
        } else {
          if (content.startsWith("{") && content.endsWith("}")) {
            try {
              const jsonEvent = JSON.parse(content);
              if (jsonEvent.action === "SHOW_APPOINTMENT_PROMPT") {
                holdsInteractiveWidget = true;
                simularStreamTexto(textos.promptAgenda, assistantMessageDiv, () => {
                  renderAppointmentPrompt(assistantMessageDiv, calendarCallbacks);
                });
                return;
              }
            } catch {
              // No es un evento JSON de control; continúa como texto normal
            }
          }

          if (!firstChunkReceived) {
            firstChunkReceived = true;
            assistantMessageDiv.innerHTML = "";
          }

          const decodedChunk = content.replace(/\\n/g, "\n");
          renderizarFragmento(decodedChunk, assistantMessageDiv, estadoIA);
        }
      }
    }
  } catch (error) {
    if (assistantMessageDiv) {
      assistantMessageDiv.textContent = textos.errorAgent;
    }
  } finally {
    if (!holdsInteractiveWidget) {
      habilitarChatInput();
    }
    persistChatState(chatMessages, chatWindow);
  }
}