import {
  getChatTexts,
  simularStreamTexto,
  type CalendarCallbacks,
} from "./chat-renderer";

interface GoogleCodeResponse {
  code?: string;
  error?: string;
}

interface GoogleCodeClientConfig {
  client_id: string;
  scope: string;
  ux_mode?: "popup" | "redirect";
  callback: (response: GoogleCodeResponse) => void | Promise<void>;
  error_callback?: (error: unknown) => void;
}

declare const google: {
  accounts: {
    oauth2: {
      initCodeClient: (config: GoogleCodeClientConfig) => {
        requestCode: () => void;
      };
    };
  };
};

interface SlotsApiResponse {
  success: boolean;
  availableSlots?: string[];
  message?: string;
}

const FALLBACK_GOOGLE_CLIENT_ID =
  "766522036234-gl7tilknv9oafsg9mfotv9aq7l3k4coj.apps.googleusercontent.com";

export function initRibbonDrag(chatContainer: HTMLElement): void {
  let isDown = false;
  let startX = 0;
  let scrollLeft = 0;
  let activeRibbon: HTMLElement | null = null;

  chatContainer.addEventListener("mousedown", (e: MouseEvent) => {
    const ribbon = (e.target as HTMLElement | null)?.closest<HTMLElement>(
      ".days-ribbon"
    );
    if (!ribbon) return;

    isDown = true;
    activeRibbon = ribbon;
    activeRibbon.classList.add("dragging");
    activeRibbon.style.cursor = "grabbing";

    startX = e.pageX - activeRibbon.offsetLeft;
    scrollLeft = activeRibbon.scrollLeft;
  });

  const stopDragging = (): void => {
    if (!isDown || !activeRibbon) return;
    isDown = false;
    activeRibbon.classList.remove("dragging");
    activeRibbon.style.cursor = "grab";
    activeRibbon = null;
  };

  chatContainer.addEventListener("mouseleave", stopDragging);
  chatContainer.addEventListener("mouseup", stopDragging);

  chatContainer.addEventListener("mousemove", (e: MouseEvent) => {
    if (!isDown || !activeRibbon) return;
    e.preventDefault();

    const x = e.pageX - activeRibbon.offsetLeft;
    const walk = (x - startX) * 1.5;
    activeRibbon.scrollLeft = scrollLeft - walk;
  });
}

export function mostrarLoaderSistema(
  divDestino: HTMLElement | null,
  mensajeTexto: string
): HTMLElement | null {
  if (divDestino) {
    divDestino.innerHTML = "";
  }

  const loaderTemplate = document.getElementById(
    "loader-template"
  ) as HTMLTemplateElement | null;
  if (loaderTemplate && divDestino) {
    const loaderFragment = loaderTemplate.content.cloneNode(
      true
    ) as DocumentFragment;
    const loaderVivo = loaderFragment.querySelector(
      ".loader-container"
    ) as HTMLElement | null;

    if (loaderVivo) {
      const textLoader = loaderVivo.querySelector<HTMLElement>(".loader-text");
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

export function renderAppointmentPrompt(
  assistantMessageDiv: HTMLElement,
  callbacks: CalendarCallbacks
): void {
  const textos = getChatTexts();
  const { deshabilitarChatInput, habilitarChatInput } = callbacks;

  deshabilitarChatInput();

  const chatWindowEl = document.getElementById("chat-window");
  const googleAuthBtnLabel =
    chatWindowEl?.dataset?.googleAuthBtn ||
    (textos.isEnglish
      ? "Continue with Google Calendar"
      : "Continuar con Google Calendar");

  const actionsWrapper = document.createElement("div");
  actionsWrapper.className = "appointment-actions";
  actionsWrapper.innerHTML = `
    <button type="button" class="btn-agenda-login">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
      </svg>
      <span>${googleAuthBtnLabel}</span>
    </button>

    <button type="button" class="btn-agenda-no">
      ${textos.cancelText}
    </button>
  `;

  assistantMessageDiv.appendChild(actionsWrapper);

  const chatMessages = document.getElementById("chat-messages");
  if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;

  const loginBtn = actionsWrapper.querySelector(
    ".btn-agenda-login"
  ) as HTMLButtonElement | null;
  const cancelBtn = actionsWrapper.querySelector(
    ".btn-agenda-no"
  ) as HTMLButtonElement | null;

  const configuredClientId =
    chatWindowEl?.dataset.googleClientId || FALLBACK_GOOGLE_CLIENT_ID;

  loginBtn?.addEventListener("click", () => {
    const client = google.accounts.oauth2.initCodeClient({
      client_id: configuredClientId,
      scope:
        "openid email profile https://www.googleapis.com/auth/calendar.events",
      ux_mode: "popup",
      callback: async (authResponse: GoogleCodeResponse) => {
        if (authResponse.code) {
          loginBtn.disabled = true;
          const loaderActivo = mostrarLoaderSistema(
            assistantMessageDiv,
            textos.loaderVerificando
          );
          await enviarCodigoAlBackend(
            authResponse.code,
            loaderActivo ?? assistantMessageDiv,
            callbacks
          );
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

function mostrarErrorInline(container: HTMLElement, textoError: string): void {
  const existingError = container.querySelector(".inline-auth-error");
  if (existingError) existingError.remove();

  const errorMsg = document.createElement("p");
  errorMsg.className =
    "inline-auth-error text-red-500 text-xs text-center mt-2 font-medium";
  errorMsg.textContent = textoError;
  container.appendChild(errorMsg);
}

async function enviarCodigoAlBackend(
  authCode: string,
  assistantMessageDiv: HTMLElement,
  callbacks: CalendarCallbacks
): Promise<void> {
  const textos = getChatTexts();
  try {
    const response = await fetch("/api/calendar/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: authCode }),
    });

    if (!response.ok) throw new Error("Error obteniendo slots");

    const data = (await response.json()) as SlotsApiResponse;

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

function getTimezoneShortLabel(): string {
  try {
    const offsetMin = -new Date().getTimezoneOffset();
    const sign = offsetMin >= 0 ? "+" : "-";
    const hrs = Math.floor(Math.abs(offsetMin) / 60);
    return `🌐 GMT${sign}${hrs}`;
  } catch {
    return "🌐 Local";
  }
}

export function renderCalendarUI(
  availableSlots: string[] | undefined,
  assistantMessageDiv: HTMLElement,
  callbacks: CalendarCallbacks
): void {
  const textos = getChatTexts();
  const calendarTemplate = document.getElementById(
    "calendar-template"
  ) as HTMLTemplateElement | null;
  if (!calendarTemplate) return;

  const chatWindowEl = document.getElementById("chat-window");
  const availableLabel =
    chatWindowEl?.dataset?.availableLabel ||
    (textos.isEnglish ? "avail." : "disp.");

  const calendarFragment = calendarTemplate.content.cloneNode(
    true
  ) as DocumentFragment;
  const calendarVivo = calendarFragment.querySelector(
    ".calendar-wrapper"
  ) as HTMLElement | null;
  const calendarTitle =
    calendarVivo?.querySelector<HTMLElement>(".calendar-title");
  const tzBadge =
    calendarVivo?.querySelector<HTMLElement>(".calendar-tz-badge");
  const arrowPrev =
    calendarVivo?.querySelector<HTMLButtonElement>(".cal-arrow-prev");
  const arrowNext =
    calendarVivo?.querySelector<HTMLButtonElement>(".cal-arrow-next");
  const daysRibbon = calendarVivo?.querySelector(
    ".days-ribbon"
  ) as HTMLElement | null;
  const hoursContainer = calendarVivo?.querySelector(
    ".hours-container"
  ) as HTMLElement | null;
  const confirmBar = calendarVivo?.querySelector(
    ".calendar-confirm-bar"
  ) as HTMLElement | null;
  const confirmTextEl = calendarVivo?.querySelector<HTMLElement>(
    ".calendar-confirm-text"
  );
  const confirmPrimaryBtn = calendarVivo?.querySelector(
    ".calendar-confirm-btn--primary"
  ) as HTMLButtonElement | null;
  const confirmDangerBtn = calendarVivo?.querySelector(
    ".calendar-confirm-btn--danger"
  ) as HTMLButtonElement | null;

  if (!calendarVivo || !daysRibbon || !hoursContainer) return;

  calendarVivo.style.display = "block";
  calendarVivo.hidden = false;
  daysRibbon.innerHTML = "";
  hoursContainer.innerHTML = "";

  if (tzBadge) {
    tzBadge.textContent = getTimezoneShortLabel();
  }

  arrowPrev?.addEventListener("click", () => {
    daysRibbon.scrollBy({ left: -160, behavior: "smooth" });
  });
  arrowNext?.addEventListener("click", () => {
    daysRibbon.scrollBy({ left: 160, behavior: "smooth" });
  });

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
    if (calendarTitle) calendarTitle.textContent = textos.textCalendar;
    hoursContainer.innerHTML = `<p style="grid-column: span 3; text-align: center; font-size: 13px; color: #9ca3af; padding: 16px 0;">${textos.noSlotsText}</p>`;
    callbacks.habilitarChatInput();
    return;
  }

  const slotsByDate: Record<string, string[]> = {};
  availableSlots.forEach((slot) => {
    const dateKey = slot.split("T")[0];
    if (!slotsByDate[dateKey]) slotsByDate[dateKey] = [];
    slotsByDate[dateKey].push(slot);
  });

  const uniqueDates = Object.keys(slotsByDate);
  let activeDate = uniqueDates[0];

  function updateMonthHeader(dateKey: string): void {
    if (!calendarTitle) return;
    const d = new Date(dateKey + "T00:00:00");
    const monthYear = d.toLocaleDateString(textos.localTime, {
      month: "long",
      year: "numeric",
    });
    calendarTitle.textContent = monthYear;
  }

  updateMonthHeader(activeDate);

  function ocultarConfirmacionInline(): void {
    hoursContainer!.querySelectorAll<HTMLButtonElement>(".hour-btn").forEach((b) => {
      b.classList.remove("selected");
      if (b.dataset.rawTime) {
        b.textContent = b.dataset.rawTime;
      }
    });
    if (confirmBar) {
      confirmBar.style.display = "none";
      confirmBar.hidden = true;
    }
  }

  function mostrarConfirmacionInline(
    slotISO: string,
    buttonEl: HTMLButtonElement
  ): void {
    hoursContainer!.querySelectorAll<HTMLButtonElement>(".hour-btn").forEach((b) => {
      b.classList.remove("selected");
      if (b.dataset.rawTime) {
        b.textContent = b.dataset.rawTime;
      }
    });
    buttonEl.classList.add("selected");
    if (buttonEl.dataset.rawTime) {
      buttonEl.textContent = `${buttonEl.dataset.rawTime} ✓`;
    }

    const dateObj = new Date(slotISO);
    const currentLocale = textos.chatLocale === "en" ? "en-US" : "es-ES";
    const fechaLegible = dateObj.toLocaleDateString(currentLocale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

    if (confirmBar && confirmTextEl && confirmPrimaryBtn) {
      confirmTextEl.textContent = `📅 ${fechaLegible} (Google Meet)`;
      confirmPrimaryBtn.textContent = `${textos.confirmBtn} →`;

      confirmBar.style.display = "block";
      confirmBar.hidden = false;

      confirmPrimaryBtn.onclick = () => {
        callbacks.onConfirmSlot(slotISO, fechaLegible, assistantMessageDiv);
      };

      const chatMessages = document.getElementById("chat-messages");
      if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  function renderHours(dateKey: string): void {
    ocultarConfirmacionInline();
    hoursContainer!.style.opacity = "0";

    setTimeout(() => {
      hoursContainer!.innerHTML = "";
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
        btn.dataset.rawTime = timeLabel;
        btn.textContent = timeLabel;
        btn.addEventListener("click", () =>
          mostrarConfirmacionInline(slot, btn)
        );

        hoursContainer!.appendChild(btn);
      });

      hoursContainer!.style.opacity = "1";
    }, 120);
  }

  uniqueDates.forEach((dateKey) => {
    const dateObj = new Date(dateKey + "T00:00:00");
    const dayName = dateObj
      .toLocaleDateString(textos.localTime, { weekday: "short" })
      .replace(".", "");
    const monthShort = dateObj
      .toLocaleDateString(textos.localTime, { month: "short" })
      .replace(".", "");
    const dayNumber = dateObj.getDate();
    const count = (slotsByDate[dateKey] || []).length;

    const dayCard = document.createElement("button");
    dayCard.type = "button";
    dayCard.className = `day-card ${dateKey === activeDate ? "active" : ""}`;
    dayCard.innerHTML = `
      <div class="day-card-top">
        <span class="day-name">${dayName}</span>
        <span class="day-month">${monthShort}</span>
      </div>
      <div class="day-card-bottom">
        <span class="day-number">${dayNumber}</span>
        <span class="day-avail">● ${count} ${availableLabel}</span>
      </div>
    `;

    dayCard.addEventListener("click", () => {
      daysRibbon
        .querySelectorAll(".day-card")
        .forEach((card) => card.classList.remove("active"));
      dayCard.classList.add("active");
      activeDate = dateKey;
      updateMonthHeader(dateKey);
      renderHours(dateKey);
    });

    daysRibbon.appendChild(dayCard);
  });

  renderHours(activeDate);
}
