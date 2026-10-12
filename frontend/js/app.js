import { apiRequest, clearAccessToken, getAccessToken, saveAccessToken } from "./api.js";

const page = document.body.dataset.page;

function showMessage(element, message, kind = "info") {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("feedback-error", kind === "error");
  element.classList.toggle("feedback-success", kind === "success");
  element.hidden = !message;
}

function updateNavigation() {
  const signedIn = Boolean(getAccessToken());
  document.querySelectorAll("[data-login-link]").forEach((link) => { link.hidden = signedIn; });
  document.querySelectorAll("[data-logout-button]").forEach((button) => {
    button.hidden = !signedIn;
    button.addEventListener("click", () => {
      clearAccessToken();
      window.location.href = "index.html";
    }, { once: true });
  });
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function renderSpaceCard(space) {
  const article = makeElement("article", "card space-card");
  const banner = makeElement("div", "space-banner", space.type?.name || "Espacio institucional");
  const body = makeElement("div", "card-body");
  body.append(makeElement("h3", "", space.name));
  if (space.description) body.append(makeElement("p", "", space.description));
  const metadata = makeElement("div", "space-meta");
  metadata.append(makeElement("span", "", space.location));
  metadata.append(makeElement("span", "", `${space.capacity} personas`));
  body.append(metadata);
  body.append(makeElement("span", "status", "Espacio activo"));

  const link = makeElement("a", "button button-outline", "Solicitar reserva");
  link.href = `reservations.html?space=${encodeURIComponent(space.id)}`;
  body.append(link);
  article.append(banner, body);
  return article;
}

async function loadHome() {
  const container = document.querySelector("[data-featured-spaces]");
  try {
    const spaces = await apiRequest("/api/v1/spaces");
    container.replaceChildren(...spaces.slice(0, 3).map(renderSpaceCard));
    if (!spaces.length) showMessage(container, "Aún no hay espacios activos en el catálogo.");
  } catch (error) {
    showMessage(container, error.message, "error");
  }
}

async function loadSpaceCatalog() {
  const form = document.querySelector("[data-space-filters]");
  const result = document.querySelector("[data-space-results]");
  const feedback = document.querySelector("[data-feedback]");
  const typeSelect = form.elements.type;
  const searchParams = new URLSearchParams(window.location.search);
  form.elements.search.value = searchParams.get("query") || "";
  form.elements.capacity.value = searchParams.get("minimumCapacity") || "";

  try {
    const types = await apiRequest("/api/v1/space-types");
    for (const type of types) typeSelect.add(new Option(type.name, type.name));
    typeSelect.value = searchParams.get("type") || "";
  } catch (error) {
    showMessage(feedback, error.message, "error");
  }

  const renderResults = async () => {
    const params = new URLSearchParams();
    if (form.elements.search.value.trim()) params.set("query", form.elements.search.value.trim());
    if (typeSelect.value) params.set("type", typeSelect.value);
    if (form.elements.capacity.value) params.set("minimumCapacity", form.elements.capacity.value);
    const suffix = params.size ? `?${params}` : "";
    window.history.replaceState(null, "", `${window.location.pathname}${suffix}`);
    showMessage(feedback, "Cargando catálogo…");
    try {
      const spaces = await apiRequest(`/api/v1/spaces${suffix}`);
      result.replaceChildren(...spaces.map(renderSpaceCard));
      showMessage(feedback, spaces.length ? `${spaces.length} espacio(s) encontrado(s).` : "No encontramos espacios con esos filtros.");
    } catch (error) {
      result.replaceChildren();
      showMessage(feedback, error.message, "error");
    }
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    renderResults();
  });
  await renderResults();
}

function configureAuthForm() {
  const form = document.querySelector("[data-auth-form]");
  const nameField = form.querySelector("[data-name-field]");
  const nameInput = form.elements.name;
  const passwordInput = form.elements.password;
  const title = form.querySelector("[data-auth-title]");
  const description = form.querySelector("[data-auth-description]");
  const submit = form.querySelector("[data-auth-submit]");
  const toggle = form.querySelector("[data-auth-toggle]");
  const feedback = form.querySelector("[data-feedback]");
  let registering = false;

  toggle.addEventListener("click", () => {
    registering = !registering;
    nameField.hidden = !registering;
    nameInput.required = registering;
    passwordInput.autocomplete = registering ? "new-password" : "current-password";
    passwordInput.minLength = registering ? 12 : 0;
    title.textContent = registering ? "Crea tu cuenta" : "Te damos la bienvenida";
    description.textContent = registering ? "Regístrate para solicitar y consultar tus reservas." : "Inicia sesión para solicitar, consultar o administrar tus reservas.";
    submit.textContent = registering ? "Crear cuenta" : "Iniciar sesión";
    toggle.textContent = registering ? "Ya tengo una cuenta" : "Crear una cuenta";
    showMessage(feedback, "");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    showMessage(feedback, registering ? "Creando cuenta…" : "Iniciando sesión…");
    const credentials = { email: form.elements.email.value.trim(), password: passwordInput.value };
    try {
      const result = await apiRequest(registering ? "/api/v1/auth/register" : "/api/v1/auth/login", {
        method: "POST",
        body: registering ? { ...credentials, name: nameInput.value.trim() } : credentials,
      });
      saveAccessToken(result.accessToken);
      const requestedPage = new URLSearchParams(window.location.search).get("next");
      const next = requestedPage && /^[a-z0-9_-]+\.html$/i.test(requestedPage) ? requestedPage : "reservations.html";
      window.location.href = next;
    } catch (error) {
      showMessage(feedback, error.message, "error");
      submit.disabled = false;
    }
  });
}

function setLocalDateMinimum(input) {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  input.min = now.toISOString().slice(0, 16);
}

async function loadReservationPage() {
  const form = document.querySelector("[data-reservation-form]");
  const select = form.elements.space;
  const formFeedback = form.querySelector("[data-feedback]");
  const historyFeedback = document.querySelector("[data-history-feedback]");
  const reservationList = document.querySelector("[data-reservation-list]");
  const sessionNote = document.querySelector("[data-session-note]");
  const startInput = form.elements.start;
  const endInput = form.elements.end;
  setLocalDateMinimum(startInput);
  setLocalDateMinimum(endInput);

  try {
    const spaces = await apiRequest("/api/v1/spaces");
    select.replaceChildren(new Option("Selecciona un espacio", ""));
    for (const space of spaces) select.add(new Option(`${space.name} · ${space.capacity} personas`, space.id));
    select.value = new URLSearchParams(window.location.search).get("space") || "";
  } catch (error) {
    select.replaceChildren(new Option("No se pudo cargar el catálogo", ""));
    showMessage(formFeedback, error.message, "error");
  }

  if (getAccessToken()) {
    showMessage(sessionNote, "Sesión iniciada. El servicio validará disponibilidad, capacidad y permisos.");
    await loadMyReservations();
  } else {
    showMessage(sessionNote, "Inicia sesión para crear y consultar tus reservas.");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!getAccessToken()) {
      window.location.href = "login.html?next=reservations.html";
      return;
    }
    const startAt = new Date(startInput.value);
    const endAt = new Date(endInput.value);
    if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || startAt >= endAt) {
      showMessage(formFeedback, "La hora de inicio debe ser anterior a la finalización.", "error");
      return;
    }

    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    showMessage(formFeedback, "Enviando solicitud…");
    try {
      await apiRequest("/api/v1/reservations", {
        method: "POST",
        authenticated: true,
        body: {
          spaceId: select.value,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          purpose: form.elements.purpose.value.trim(),
          attendees: Number(form.elements.attendees.value),
        },
      });
      form.reset();
      setLocalDateMinimum(startInput);
      setLocalDateMinimum(endInput);
      showMessage(formFeedback, "Reserva creada. Puedes consultar su estado en Mis reservas.", "success");
      await loadMyReservations();
    } catch (error) {
      showMessage(formFeedback, error.message, "error");
    } finally {
      submit.disabled = false;
    }
  });

  async function loadMyReservations() {
    if (!getAccessToken()) return;
    showMessage(historyFeedback, "Cargando reservas…");
    try {
      const reservations = await apiRequest("/api/v1/reservations/me", { authenticated: true });
      reservationList.replaceChildren();
      if (!reservations.length) {
        showMessage(historyFeedback, "Todavía no tienes reservas.");
        return;
      }
      showMessage(historyFeedback, `${reservations.length} reserva(s).`);
      reservations.forEach((reservation) => reservationList.append(renderReservation(reservation)));
    } catch (error) {
      showMessage(historyFeedback, error.message, "error");
    }
  }

  function renderReservation(reservation) {
    const item = makeElement("article", "reservation-item");
    const details = makeElement("div", "reservation-details");
    details.append(makeElement("h3", "", reservation.spaceName));
    details.append(makeElement("p", "", `${formatDate(reservation.startAt)} – ${formatDate(reservation.endAt)}`));
    details.append(makeElement("p", "", `${reservation.purpose} · ${reservation.attendees} asistentes`));
    const isPast = new Date(reservation.endAt) <= new Date();
    const status = reservation.status === "ACTIVE" && isPast ? "Finalizada" : reservation.status;
    details.append(makeElement("span", `reservation-status status-${status.toLowerCase()}`, status));
    item.append(details);
    if (reservation.status === "ACTIVE" && !isPast) {
      const cancelButton = makeElement("button", "button button-outline", "Cancelar");
      cancelButton.type = "button";
      cancelButton.addEventListener("click", async () => {
        const reason = window.prompt("Indica el motivo de la cancelación:");
        if (!reason?.trim()) return;
        cancelButton.disabled = true;
        try {
          await apiRequest(`/api/v1/reservations/${reservation.id}/cancel`, {
            method: "PATCH",
            authenticated: true,
            body: { reason: reason.trim() },
          });
          showMessage(formFeedback, "La reserva fue cancelada.", "success");
          await loadMyReservations();
        } catch (error) {
          showMessage(historyFeedback, error.message, "error");
          cancelButton.disabled = false;
        }
      });
      item.append(cancelButton);
    }
    return item;
  }
}

updateNavigation();
if (page === "home") loadHome();
if (page === "spaces") loadSpaceCatalog();
if (page === "login") configureAuthForm();
if (page === "reservations") loadReservationPage();
