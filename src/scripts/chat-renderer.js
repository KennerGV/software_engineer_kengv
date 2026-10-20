const chatLocale = document.documentElement.lang === "es" ? "es" : "en";
const chatStateStorageKey = "kener-chat-state-" + chatLocale;
const chatOpenStorageKey = "kener-chat-is-open";

export function getChatTexts() {
  const i18n = window.ChatI18n || {};
  const isEnglish = document.documentElement.lang === "en";
  return {
    isEnglish,
    chatLocale,
    promptAgenda: i18n.SHOW_APPOINTMENT_PROMPT || "",
    cancelAppointment: i18n.CANCEL_APPOINTMENT || "",
    errorAutenticacion: i18n.ERROR_AUTENTICACION || "",
    loaderVerificando: i18n.LOADER_VERIFICANDO || "",
    loaderAgendando: i18n.LOADER_AGENDANDO || "",
    placeholderChat: i18n.PLACEHOLDER_CHAT || "",
    placeholderDeshabilitado: i18n.PLACEHOLDER_DESHABILITADO || "",
    connectionError: i18n.CONNECTION_ERROR || "",
    errorAgent: i18n.ERROR_AGENT || "",
    errorAgenda: i18n.ERROR_AGENDA || "",
    confirmAgenda: i18n.CONFIRM_AGENDA || "",
    confirmBtn: i18n.CONFIRM_BTN || (isEnglish ? "Confirm meeting" : "Confirmar cita"),
    changeTimeBtn: i18n.CHANGE_TIME_BTN || (isEnglish ? "Change time" : "Cambiar hora"),
    cancelText: i18n.CANCEL_BTN || (isEnglish ? "Cancel" : "Cancelar"),
    noSlotsText: i18n.NO_SLOTS || (isEnglish ? "No available time slots. 😢" : "No hay horarios disponibles. 😢"),
    textCalendar: i18n.TEXT_CALENDAR || "",
    localTime: i18n.LOCAL_TIME || (isEnglish ? "en-US" : "es-ES"),
    retryConnection: i18n.RETRY_CONNECTION || "",
  };
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Convierte texto Markdown ligero (**negrita**, enlaces https://..., viñetas y saltos de línea)
 * en HTML seguro y clicable.
 */
export function formatRichText(rawText) {
  if (!rawText) return "";

  let html = escapeHtml(rawText);

  // 1. Negritas completas **texto** y negritas aún abiertas al final del stream
  html = html.replace(
    /\*\*([\s\S]+?)\*\*/g,
    '<strong class="font-bold" style="color: inherit;">$1</strong>'
  );
  const openBoldIdx = html.lastIndexOf("**");
  if (openBoldIdx !== -1) {
    html =
      html.slice(0, openBoldIdx) +
      '<strong class="font-bold" style="color: inherit;">' +
      html.slice(openBoldIdx + 2) +
      "</strong>";
  }

  // 2. Enlaces clicables (por ejemplo https://meet.google.com/...)
  html = html.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => {
      const cleanUrl = url.replace(/[.,;!?)]+$/, "");
      const trailing = url.slice(cleanUrl.length);
      return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="chat-link">${cleanUrl}</a>${trailing}`;
    }
  );

  // 3. Viñetas simples (* item o - item al inicio de línea)
  html = html.replace(/^(?:\*|-)\s+(.+)$/gm, "• $1");

  // 4. Saltos de línea
  return html.replace(/\n/g, "<br>");
}

export function renderizarFragmento(chunk, container, state) {
  state.rawText = (state.rawText || "") + chunk;
  container.innerHTML = formatRichText(state.rawText);

  const chatMessages = document.getElementById("chat-messages");
  if (chatMessages) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

export function simularStreamTexto(textoPlano, container, callbackAlTerminar) {
  const estadoEstatico = { rawText: "" };
  container.innerHTML = "";

  let index = 0;
  const step = 3; // Avanza de a 3 caracteres para mayor fluidez y menor carga de CPU
  const intervalo = setInterval(() => {
    if (index < textoPlano.length) {
      const chunkAEnviar = textoPlano.slice(index, index + step);
      index += step;
      renderizarFragmento(chunkAEnviar, container, estadoEstatico);
    } else {
      clearInterval(intervalo);
      if (callbackAlTerminar) {
        callbackAlTerminar();
      }
    }
  }, 14);
}

export function persistChatState(chatMessages, chatWindow) {
  try {
    const isOpen = chatWindow ? !chatWindow.classList.contains("hidden") : false;
    sessionStorage.setItem(chatOpenStorageKey, isOpen ? "true" : "false");

    if (!chatMessages) return;

    // Clonamos el contenedor y limpiamos widgets transitorios cuyos listeners no sobreviven a recargas
    const clone = chatMessages.cloneNode(true);
    clone
      .querySelectorAll(".appointment-actions, .calendar-wrapper, .loader-container")
      .forEach((node) => {
        const msgWrapper = node.closest(".message--assistant");
        if (msgWrapper && clone.querySelectorAll(".message").length > 1) {
          const prevMsg = msgWrapper.previousElementSibling;
          if (prevMsg && prevMsg.classList.contains("message--user")) {
            prevMsg.remove();
          }
          msgWrapper.remove();
        } else {
          node.remove();
        }
      });

    const hasUserMessage = clone.querySelectorAll(".message--user").length > 0;
    const messageCount = clone.querySelectorAll(".message").length;
    const hasInteracted = hasUserMessage || messageCount > 1;

    if (hasInteracted) {
      clone.querySelectorAll(".quick-prompts-container").forEach((el) => el.remove());
      sessionStorage.setItem(
        chatStateStorageKey,
        JSON.stringify({
          hasInteracted: true,
          messages: clone.innerHTML,
        })
      );
    } else {
      sessionStorage.removeItem(chatStateStorageKey);
    }
  } catch (error) {
    console.warn("Unable to persist chat state", error);
  }
}

export function restoreChatState(chatMessages, chatWindow, floatingTriggers) {
  if (!chatMessages) return;

  try {
    const savedState = JSON.parse(sessionStorage.getItem(chatStateStorageKey) || "null");

    if (
      savedState &&
      savedState.hasInteracted &&
      typeof savedState.messages === "string" &&
      savedState.messages.trim()
    ) {
      chatMessages.innerHTML = savedState.messages;
      // Eliminar cualquier <template> antiguo guardado en sessionStorage para no duplicar IDs (#calendar-template)
      chatMessages.querySelectorAll("template").forEach((tpl) => tpl.remove());
      requestAnimationFrame(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      });
    }

    const isOpenGlobal =
      sessionStorage.getItem(chatOpenStorageKey) === "true" ||
      (savedState && savedState.isOpen);

    if (chatWindow && isOpenGlobal) {
      chatWindow.classList.remove("hidden");
      document.querySelector(".app-container")?.classList.add("is-chat-open");
      if (window.matchMedia("(max-width: 1024px)").matches) {
        floatingTriggers?.classList.add("hidden");
      }
    }
  } catch (error) {
    console.warn("Unable to restore chat state", error);
  }
}
