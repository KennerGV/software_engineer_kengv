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

const toggleChatBtn = document.getElementById("toggle-chat") as HTMLButtonElement | null;
const chatWindow = document.getElementById("chat-window");
const toggleMenuBtn = document.getElementById("toggle-menu") as HTMLButtonElement | null;
const submenuContainer = document.getElementById("submenu-links");
const closeChatBtn = document.getElementById("close-chat-btn") as HTMLButtonElement | null;
const floatingTriggers = document.querySelector(".floating-triggers");
const chatContainer = document.getElementById("chat-container") || document.body;
const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form") as HTMLFormElement | null;
const chatInput = document.getElementById("chat-input") as HTMLInputElement | null;
const chatSubmitBtn = chatForm?.querySelector('button[type="submit"]') as HTMLButtonElement | null;
const printCvStorageKey = "kener-print-cv-pending";

// 1. Inicializar arrastre de cinta de días y restaurar sesión
initRibbonDrag(chatContainer);
restoreChatState(chatMessages, chatWindow, floatingTriggers);

// 2. Control de botones flotantes (FAB) y ventana de chat
if (toggleChatBtn && chatWindow) {
  const isMobile = () => window.matchMedia("(max-width: 1024px)").matches;

  const setTriggersVisibility = (visible: boolean) => {
    if (!floatingTriggers) return;
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
    submenuContainer?.classList.remove("open");
    toggleMenuBtn?.classList.remove("active");
  });

  toggleMenuBtn?.addEventListener("click", () => {
    submenuContainer?.classList.toggle("open");
    toggleMenuBtn?.classList.toggle("active");
    chatWindow.classList.add("hidden");
    setTriggersVisibility(true);
    persistChatState(chatMessages, chatWindow);
  });

  closeChatBtn?.addEventListener("click", () => {
    toggleChatBtn.click();
  });
}

document.querySelectorAll(".lang-switch-link").forEach((link) => {
  link.addEventListener("click", () => {
    persistChatState(chatMessages, chatWindow);
    if (window.location.hash) {
      const baseHref = link.getAttribute("href") || "/";
      if (!baseHref.includes("#")) {
        link.setAttribute("href", `${baseHref}${window.location.hash}`);
      }
    }
  });
});

// Función auxiliar para abrir el chat garantizando estado visible
function openChatWidget() {
  if (!chatWindow || !toggleChatBtn) return;
  if (chatWindow.classList.contains("hidden")) {
    toggleChatBtn.click();
  }
  setTimeout(() => {
    chatInput?.focus();
  }, 150);
}

// Función auxiliar para disparar directamente el agendamiento de entrevista
function triggerScheduleFlow(userLabel?: string) {
  openChatWidget();
  const quickPromptsEl = document.getElementById("quick-prompts");
  quickPromptsEl?.classList.add("hidden");

  const textos = getChatTexts();
  const label =
    userLabel ||
    (textos.isEnglish ? "📅 Schedule an interview" : "📅 Agendar una entrevista");

  appendMessage(label, "user");
  const assistantMessageDiv = appendMessage("", "assistant");
  if (assistantMessageDiv) {
    simularStreamTexto(textos.promptAgenda, assistantMessageDiv, () => {
      renderAppointmentPrompt(assistantMessageDiv, calendarCallbacks);
    });
  }
}

// 3. Impresión de CV en PDF ( desde el submenú flotante o desde el botón del Hero )
const prepareForPrint = () => {
  const detailsContact = document.querySelector(".contact-accordion");
  const detailsEducation = document.querySelector(".education-accordion");
  if (detailsContact) detailsContact.setAttribute("open", "");
  if (detailsEducation) detailsEducation.setAttribute("open", "");
};

window.onbeforeprint = prepareForPrint;

function handlePrintCv(buttonEl?: HTMLElement | null) {
  const cvUrl = buttonEl?.dataset?.cvUrl;
  const cvPath = cvUrl
    ? new URL(cvUrl, window.location.origin).pathname
    : window.location.pathname;

  if (cvUrl && window.location.pathname !== cvPath) {
    sessionStorage.setItem(printCvStorageKey, "true");
    window.location.assign(cvUrl);
    return;
  }

  prepareForPrint();
  window.print();
}

const printCvBtn = document.getElementById("print-cv-btn");
printCvBtn?.addEventListener("click", () => handlePrintCv(printCvBtn));

const heroPdfBtn = document.getElementById("hero-pdf-btn");
heroPdfBtn?.addEventListener("click", () => handlePrintCv(heroPdfBtn));

const heroChatBtn = document.getElementById("hero-chat-btn");
heroChatBtn?.addEventListener("click", () => openChatWidget());

const heroCalendarBtn = document.getElementById("hero-calendar-btn");
heroCalendarBtn?.addEventListener("click", () => triggerScheduleFlow());

const heroHeader = document.querySelector(".main-header.hero-card") as HTMLElement | null;
const heroStickyShell = document.getElementById("hero-sticky-shell");
if (heroHeader) {
  const syncHeroShellHeight = () => {
    if (heroStickyShell && !heroHeader.classList.contains("is-scrolled")) {
      heroStickyShell.style.minHeight = `${heroHeader.offsetHeight}px`;
    }
  };
  syncHeroShellHeight();

  let scrollTicking = false;
  const handleHeroScroll = () => {
    const y = window.scrollY;
    if (y > 45 && !heroHeader.classList.contains("is-scrolled")) {
      syncHeroShellHeight();
      heroHeader.classList.add("is-scrolled");
    } else if (y < 10 && heroHeader.classList.contains("is-scrolled")) {
      heroHeader.classList.remove("is-scrolled");
    }
    scrollTicking = false;
  };
  handleHeroScroll();
  window.addEventListener(
    "scroll",
    () => {
      if (!scrollTicking) {
        scrollTicking = true;
        window.requestAnimationFrame(handleHeroScroll);
      }
    },
    { passive: true }
  );
  window.addEventListener("resize", syncHeroShellHeight, { passive: true });
}

function triggerContextualQuestion(promptText?: string) {
  if (!promptText) return;
  openChatWidget();
  document.getElementById("quick-prompts")?.classList.add("hidden");

  if (chatInput?.disabled) {
    chatMessages
      ?.querySelectorAll(".appointment-actions, .calendar-wrapper")
      .forEach((el) => el.remove());
    habilitarChatInput();
  }

  sendQueryToAI(promptText, true);
}

document.addEventListener("click", (e: MouseEvent) => {
  const triggerBtn = (e.target as HTMLElement).closest(".ask-ai-trigger") as HTMLElement | null;
  if (!triggerBtn) return;
  const promptText = triggerBtn.dataset.aiPrompt?.trim();
  if (promptText) {
    triggerContextualQuestion(promptText);
  }
});

if (sessionStorage.getItem(printCvStorageKey) === "true") {
  sessionStorage.removeItem(printCvStorageKey);
  setTimeout(() => {
    prepareForPrint();
    window.print();
  }, 0);
}

// 4. Control de Input, Quick Prompts y Mensajes del Chat
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

function appendMessage(text: string, role: string) {
  if (!chatMessages) return null;

  const quickPromptsEl = document.getElementById("quick-prompts");
  quickPromptsEl?.classList.add("hidden");

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
  onConfirmSlot: async (slotISO: string, fechaLegible: string, assistantMessageDiv: HTMLElement) => {
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

// Delegación de eventos para los chips de sugerencias rápidas (Quick Prompts)
chatMessages?.addEventListener("click", async (e: MouseEvent) => {
  const chip = (e.target as HTMLElement).closest(".quick-prompt-chip") as HTMLElement | null;
  if (!chip) return;

  const action = chip.dataset.action;
  const message = chip.dataset.message || chip.textContent?.trim();

  if (action === "schedule") {
    triggerScheduleFlow(chip.textContent.trim());
  } else if (message) {
    await sendQueryToAI(message, true);
  }
});

chatForm?.addEventListener("submit", async (e: Event) => {
  e.preventDefault();
  const messageText = chatInput?.value.trim();
  if (!messageText) return;

  if (chatInput) chatInput.value = "";
  await sendQueryToAI(messageText, true);
});

async function sendQueryToAI(
  messageText: string,
  showInUi: boolean = true,
  bookingSlot: string | null = null,
  existingTargetDiv: HTMLElement | null = null
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
    const payload: { message: string; bookingSlot?: string } = { message: messageText };
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
          if (assistantMessageDiv) assistantMessageDiv.textContent = textos.errorAgent;
        } else {
          if (content.startsWith("{") && content.endsWith("}")) {
            try {
              const jsonEvent = JSON.parse(content);
              if (jsonEvent.action === "SHOW_APPOINTMENT_PROMPT") {
                holdsInteractiveWidget = true;
                if (assistantMessageDiv) {
                  simularStreamTexto(textos.promptAgenda, assistantMessageDiv, () => {
                    renderAppointmentPrompt(assistantMessageDiv!, calendarCallbacks);
                  });
                }
                return;
              }
            } catch {
              // No es un evento JSON de control; continúa como texto normal
            }
          }

          if (!firstChunkReceived) {
            firstChunkReceived = true;
            if (assistantMessageDiv) assistantMessageDiv.innerHTML = "";
          }

          const decodedChunk = content.replace(/\\n/g, "\n");
          if (assistantMessageDiv) renderizarFragmento(decodedChunk, assistantMessageDiv, estadoIA);
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