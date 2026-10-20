# AGENTS.md — Guía de Arquitectura y Convenciones para Agentes (Antigravity & Jules)

Este repositorio contiene el portafolio profesional interactivo y asistente de IA (**KenerAI**) de **Kener Gutiérrez Vásquez** (`kengv.dev`), construido con **Astro 5 (Híbrido SSG + SSR)**, **TypeScript** y **Vitest**.

---

## 1. Entorno y Comandos Obligatorios de Verificación

- **Versión de Node.js requerida:** `>=22.12.0`
- **Instalación de dependencias:** `npm install`
- **Ejecución de pruebas unitarias (obligatorio antes de entregar cambios):**
  ```bash
  npm test
  ```
- **Compilación de producción (obligatorio antes de abrir un PR o hacer commit):**
  ```bash
  npm run build
  ```

> **Regla crítica:** Ningún cambio debe romper `npm test` ni `npm run build`.

---

## 2. Estructura del Proyecto

- `src/data/es/cv.json` y `src/data/en/cv.json`:
  - Única fuente de verdad (Single Source of Truth) para todos los textos del CV, etiquetas de interfaz (`ui`), textos del asistente (`asistente`) y política de privacidad (`politicaPrivacidad`).
  - **Cualquier nueva etiqueta de interfaz debe agregarse en ambos idiomas (`es` y `en`).**
- `src/pages/`:
  - `index.astro` (Inglés, prerenderizado SSG) y `es/index.astro` (Español, prerenderizado SSG).
  - `privacy.astro` y `es/privacy.astro`: Páginas de política de privacidad.
  - `api/chat.ts`: Endpoint SSR que conecta con el backend de IA y transmite respuestas vía Server-Sent Events (SSE).
  - `api/calendar/slots.ts`: Endpoint SSR que consulta disponibilidad real en Google Calendar OAuth.
- `src/services/` y `src/utils/`:
  - `src/utils/sanitizer.ts`: Sanitización de entradas de usuario (`sanitizeInput`).
  - `src/services/sessionValidation.ts`: Validación de cookies de sesión (`validateUserSession`).
  - `src/services/calendarUtils.ts`: Cálculo de zonas horarias y generación de slots de calendario (`generarSlotsDia`).
- `src/tests/`:
  - Pruebas unitarias en Vitest (`*.test.ts`). Todo nuevo servicio o utilidad en `src/services/` o `src/utils/` debe incluir su archivo de pruebas correspondiente.
- `src/layouts/MainLayout.astro` y `src/components/`:
  - Componentes Astro de la interfaz (Cabecera ejecutiva sticky `.hero-sticky-shell`, `SideBar.astro` con avatar 3D `/avatar-3d.jpg`, `Experience.astro`, `SeccionHabilidades.astro`, `Badges.astro`, `FloatingActions.astro`, `ui/ChatUI.astro`).
- `src/scripts/`:
  - Scripts del cliente en TypeScript estricto (`floating-actions.ts`, `chat-renderer.ts`, `calendar-widget.ts`, `sidebar.ts`).

---

## 3. Reglas de Diseño UI/UX y Restricciones

1. **Estabilidad de Layout (Zero Layout Shift):**
   - La cabecera superior (`.main-header.hero-card`) está envuelta en `.hero-sticky-shell` (`#hero-sticky-shell`) para mantener su espacio en el flujo del documento cuando se compacta al hacer scroll (`.is-scrolled`). No eliminar `.hero-sticky-shell`.
   - Los botones de habilidad (`.ui-tag.skill-badge`) compensan su `padding` horizontal al mostrar `.skill-ask-icon` en `:hover` para no alterar su ancho exterior ni provocar saltos de línea.
2. **Compatibilidad con Impresión / Exportación a PDF (`@media print`):**
   - El botón **Descargar CV (PDF)** utiliza `window.print()`.
   - Cualquier elemento interactivo nuevo (botones de IA `.ask-ai-btn`, widgets flotantes, canvas interactivos `.avatar-canvas`) **debe ocultarse explícitamente en `@media print` (`display: none !important;`)** para preservar el diseño limpio de una sola hoja en PDF.
3. **Persistencia Multi-Idioma del Chat:**
   - El estado de apertura del chat se guarda en `sessionStorage` bajo `kener-chat-is-open` y el historial por idioma en `kener-chat-state-es` / `kener-chat-state-en` (solo cuando el usuario ya interactuó con ese idioma). No romper esta lógica en `src/scripts/chat-renderer.ts`.
4. **Seguridad en Endpoints (`src/pages/api/*`):**
   - Mantener siempre las cabeceras `SECURITY_HEADERS` (`X-Content-Type-Options: nosniff`, `Strict-Transport-Security`), validación estricta de tipos de payload y mensajes de error sanitizados sin exponer trazas internas.
