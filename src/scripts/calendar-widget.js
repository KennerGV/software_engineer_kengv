import { getChatTexts, simularStreamTexto } from "./chat-renderer.js";

const FALLBACK_GOOGLE_CLIENT_ID =
  "766522036234-gl7tilknv9oafsg9mfotv9aq7l3k4coj.apps.googleusercontent.com";

export function initRibbonDrag(chatContainer) {
  let isDown = false;
  let startX = 0;
  let scrollLeft = 0;
  let activeRibbon = null;

  chatContainer.addEventListener("mousedown", (e) => {
    const ribbon = e.target.closest(".days-ribbon");
    if (!ribbon) return;

    isDown = true;
    activeRibbon = ribbon;
    activeRibbon.classList.add("dragging");
    activeRibbon.style.cursor = "grabbing";

    startX = e.pageX - activeRibbon.offsetLeft;
    scrollLeft = activeRibbon.scrollLeft;
  });

  const stopDragging = () => {
    if (!isDown || !activeRibbon) return;
    isDown = false;
    activeRibbon.classList.remove("dragging");
    activeRibbon.style.cursor = "grab";
    activeRibbon = null;
  };

  chatContainer.addEventListener("mouseleave", stopDragging);
  chatContainer.addEventListener("mouseup", stopDragging);

  chatContainer.addEventListener("mousemove", (e) => {
    if (!isDown || !activeRibbon) return;
    e.preventDefault();

    const x = e.pageX - activeRibbon.offsetLeft;
    const walk = (x - startX) * 1.5;
    activeRibbon.scrollLeft = scrollLeft - walk;
  });
}

export function mostrarLoaderSistema(divDestino, mensajeTexto) {
  if (divDestino) {
    divDestino.innerHTML = "";
  }

  const loaderTemplate = document.getElementById("loader-template");
  if (loaderTemplate && divDestino) {
    const loaderFragment = loaderTemplate.content.cloneNode(true);
    const loaderVivo = loaderFragment.querySelector(".loader-container");

    if (loaderVivo) {
      const textLoader = loaderVivo.querySelector(".loader-text");
      if (textLoader) {
        textLoader.textContent = mensajeTexto;
      }

      divDestino.appendChild(loaderVivo);
      loaderVivo.style.display = "block";
    }
  }

  const chatMessages = document.getElementById("chat-messages");
  if (chatMessages) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  return divDestino;
}

export function renderAppointmentPrompt(assistantMessageDiv, callbacks) {
  const textos = getChatTexts();
  const { deshabilitarChatInput, habilitarChatInput, onConfirmSlot } = callbacks;

  deshabilitarChatInput();

  const actionsWrapper = document.createElement("div");
  actionsWrapper.className = "appointment-actions";
  actionsWrapper.innerHTML = `
    <button type="button" class="btn btn-agenda-login">
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
      </svg>
      <div id="container-stars"><div id="stars"></div></div>
      <div id="glow"><div class="circle"></div><div class="circle"></div></div>
    </button>

    <button type="button" class="btn btn-cancel btn-agenda-no">
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="z-index: 2; color: #ffffff;">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
      <strong style="z-index: 2; margin-left: 0.5rem; color: #ffffff;">${textos.cancelText}</strong>
      <div id="glow"><div class="circle"></div><div class="circle"></div></div>
    </button>
  `;

  assistantMessageDiv.appendChild(actionsWrapper);

  const chatMessages = document.getElementById("chat-messages");
  if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;

  const loginBtn = actionsWrapper.querySelector(".btn-agenda-login");
  const cancelBtn = actionsWrapper.querySelector(".btn-agenda-no");

  const configuredClientId =
    document.getElementById("chat-window")?.dataset.googleClientId ||
    FALLBACK_GOOGLE_CLIENT_ID;

  loginBtn?.addEventListener("click", () => {
    const client = google.accounts.oauth2.initCodeClient({
      client_id: configuredClientId,
      scope: "openid email profile https://www.googleapis.com/auth/calendar.events",
      ux_mode: "popup",
      callback: async (authResponse) => {
        if (authResponse.code) {
          loginBtn.disabled = true;
          const loaderActivo = mostrarLoaderSistema(
            assistantMessageDiv,
            textos.loaderVerificando
          );
          await enviarCodigoAlBackend(authResponse.code, loaderActivo, callbacks);
        }
      },
      error_callback: () => {
        mostrarErrorInline(assistantMessageDiv, textos.errorAgenda);
      },
    });

    client.requestCode();
  });

  cancelBtn?.addEventListener("click", () => {
    assistantMessageDiv.innerHTML = "";
    simularStreamTexto(textos.cancelAppointment, assistantMessageDiv, () => {
      habilitarChatInput();
    });
  });
}

function mostrarErrorInline(container, textoError) {
  const existingError = container.querySelector(".inline-auth-error");
  if (existingError) existingError.remove();

  const errorMsg = document.createElement("p");
  errorMsg.className = "inline-auth-error text-red-500 text-xs text-center mt-2 font-medium";
  errorMsg.textContent = textoError;
  container.appendChild(errorMsg);
}

async function enviarCodigoAlBackend(authCode, assistantMessageDiv, callbacks) {
  const textos = getChatTexts();
  try {
    const response = await fetch("/api/calendar/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: authCode }),
    });

    if (!response.ok) throw new Error("Error obteniendo slots");

    const data = await response.json();

    if (data.success) {
      assistantMessageDiv.innerHTML = "";
      renderCalendarUI(data.availableSlots, assistantMessageDiv, callbacks);
    } else {
      throw new Error(data.message || "Error");
    }
  } catch (error) {
    console.error(error);
    assistantMessageDiv.innerHTML = "";
    mostrarErrorInline(assistantMessageDiv, textos.errorAutenticacion);
    renderAppointmentPrompt(assistantMessageDiv, callbacks);
  }
}

export function renderCalendarUI(availableSlots, assistantMessageDiv, callbacks) {
  const textos = getChatTexts();
  const calendarTemplate = document.getElementById("calendar-template");
  if (!calendarTemplate) return;

  const calendarFragment = calendarTemplate.content.cloneNode(true);
  const calendarVivo = calendarFragment.querySelector(".calendar-wrapper");
  const calendarTitle = calendarVivo?.querySelector(".calendar-title");
  const daysRibbon = calendarVivo?.querySelector(".days-ribbon");
  const hoursContainer = calendarVivo?.querySelector(".hours-container");
  const confirmBar = calendarVivo?.querySelector(".calendar-confirm-bar");
  const confirmTextEl = calendarVivo?.querySelector(".calendar-confirm-text");
  const confirmPrimaryBtn = calendarVivo?.querySelector(".calendar-confirm-btn--primary");
  const confirmSecondaryBtn = calendarVivo?.querySelector(".calendar-confirm-btn--secondary");
  const confirmDangerBtn = calendarVivo?.querySelector(".calendar-confirm-btn--danger");

  if (!calendarVivo || !daysRibbon || !hoursContainer) return;

  calendarVivo.style.display = "block";
  calendarVivo.hidden = false;
  daysRibbon.innerHTML = "";
  hoursContainer.innerHTML = "";
  if (calendarTitle) calendarTitle.textContent = textos.textCalendar;

  if (confirmDangerBtn) {
    confirmDangerBtn.textContent = textos.cancelText;
    confirmDangerBtn.onclick = () => {
      assistantMessageDiv.innerHTML = "";
      simularStreamTexto(textos.cancelAppointment, assistantMessageDiv, () => {
        callbacks.habilitarChatInput();
      });
    };
  }

  assistantMessageDiv.appendChild(calendarVivo);

  if (!availableSlots || availableSlots.length === 0) {
    hoursContainer.innerHTML = `<p style="grid-column: span 3; text-align: center; font-size: 13px; color: #9ca3af; padding: 16px 0;">${textos.noSlotsText}</p>`;
    callbacks.habilitarChatInput();
    return;
  }

  const slotsByDate = {};
  availableSlots.forEach((slot) => {
    const dateKey = slot.split("T")[0];
    if (!slotsByDate[dateKey]) slotsByDate[dateKey] = [];
    slotsByDate[dateKey].push(slot);
  });

  const uniqueDates = Object.keys(slotsByDate);
  let activeDate = uniqueDates[0];
  let selectedSlotISO = null;

  function ocultarConfirmacionInline() {
    selectedSlotISO = null;
    hoursContainer
      .querySelectorAll(".hour-btn.selected")
      .forEach((b) => b.classList.remove("selected"));
    if (confirmBar) {
      confirmBar.style.display = "none";
      confirmBar.hidden = true;
    }
  }

  function mostrarConfirmacionInline(slotISO, buttonEl) {
    selectedSlotISO = slotISO;
    hoursContainer
      .querySelectorAll(".hour-btn.selected")
      .forEach((b) => b.classList.remove("selected"));
    buttonEl.classList.add("selected");

    const dateObj = new Date(slotISO);
    const currentLocale = textos.chatLocale === "en" ? "en-US" : "es-ES";
    const fechaLegible = dateObj.toLocaleDateString(currentLocale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });

    if (confirmBar && confirmTextEl && confirmPrimaryBtn && confirmSecondaryBtn) {
      confirmTextEl.textContent = textos.confirmAgenda.replace("{fecha}", fechaLegible);
      confirmPrimaryBtn.textContent = textos.confirmBtn;
      confirmSecondaryBtn.textContent = textos.changeTimeBtn;

      confirmBar.style.display = "block";
      confirmBar.hidden = false;

      confirmPrimaryBtn.onclick = () => {
        callbacks.onConfirmSlot(slotISO, fechaLegible, assistantMessageDiv);
      };
      confirmSecondaryBtn.onclick = () => {
        ocultarConfirmacionInline();
      };

      const chatMessages = document.getElementById("chat-messages");
      if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  function renderHours(dateKey) {
    ocultarConfirmacionInline();
    hoursContainer.style.opacity = "0";

    setTimeout(() => {
      hoursContainer.innerHTML = "";
      const hours = slotsByDate[dateKey] || [];

      hours.forEach((slot) => {
        const dateObj = new Date(slot);
        const timeLabel = dateObj.toLocaleTimeString(textos.localTime, {
          hour: "2-digit",
          minute: "2-digit",
        });

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "hour-btn";
        btn.innerText = timeLabel;
        btn.addEventListener("click", () => mostrarConfirmacionInline(slot, btn));

        hoursContainer.appendChild(btn);
      });

      hoursContainer.style.opacity = "1";
    }, 150);
  }

  uniqueDates.forEach((dateKey) => {
    const dateObj = new Date(dateKey + "T00:00:00");
    const dayName = dateObj.toLocaleDateString(textos.localTime, { weekday: "short" });
    const dayNumber = dateObj.getDate();

    const dayCard = document.createElement("button");
    dayCard.type = "button";
    dayCard.className = `day-card ${dateKey === activeDate ? "active" : ""}`;
    dayCard.innerHTML = `
      <span class="day-name">${dayName}</span>
      <span class="day-number">${dayNumber}</span>
    `;

    dayCard.addEventListener("click", () => {
      daysRibbon.querySelectorAll(".day-card").forEach((card) => card.classList.remove("active"));
      dayCard.classList.add("active");
      activeDate = dateKey;
      renderHours(dateKey);
    });

    daysRibbon.appendChild(dayCard);
  });

  renderHours(activeDate);
}
