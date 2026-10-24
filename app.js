"use strict";

const core = globalThis.CasaCore;
const STORAGE_KEY = "casa-state-v1";
const $ = (selector) => document.querySelector(selector);
const taskDialog = $("#task-dialog");
const vacationDialog = $("#vacation-dialog");
let state = { version: 1, tasks: [], vacations: [] };
let storageBlocked = false;
let editingId = null;
let notificationTimeout;
let renderedDate;
const dateFormatter = new Intl.DateTimeFormat("fr", { day: "numeric", month: "short", year: "numeric" });

function formatDate(date) {
  return dateFormatter.format(new Date(`${date}T12:00:00`));
}

function storageError(error, message) {
  console.error(message, error);
  $("#storage-error").textContent = message;
  $("#storage-error").hidden = false;
}

try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved !== null) state = core.validateState(JSON.parse(saved));
} catch (error) {
  storageBlocked = true;
  storageError(error, "Impossible de lire vos données. Aucune donnée ne sera écrasée. Vérifiez que le stockage du navigateur est autorisé ; si le problème persiste, conservez les données du site avant toute réinitialisation.");
}

function save(next, { replaceBlocked = false } = {}) {
  if (storageBlocked && !replaceBlocked) {
    notify("Enregistrement bloqué : le stockage de cet appareil est inaccessible ou illisible.");
    return false;
  }
  try {
    next = core.validateState(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    storageError(error, "Modification non enregistrée. Le stockage est peut-être plein ou désactivé. Vos données précédentes sont conservées.");
    notify("Modification non enregistrée. Vérifiez le stockage disponible et les autorisations du navigateur.");
    return false;
  }
  state = next;
  storageBlocked = false;
  $("#storage-error").hidden = true;
  render();
  return true;
}

function notify(text) {
  const feedback = document.querySelector("dialog[open] .form-feedback");
  if (feedback) {
    feedback.textContent = text;
    feedback.hidden = false;
    return;
  }
  const notification = $("#notification");
  clearTimeout(notificationTimeout);
  notification.textContent = text;
  notification.hidden = false;
  notificationTimeout = setTimeout(() => { notification.hidden = true; }, 5000);
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function actionButton(text, className, action, label) {
  const button = makeElement("button", className, text);
  button.type = "button";
  if (label) button.setAttribute("aria-label", label);
  button.addEventListener("click", action);
  return button;
}

function frequencyLabel(task) {
  const unit = task.frequencyUnit ?? "days";
  if (unit === "months") return task.frequency === 1 ? "Chaque mois" : `Tous les ${task.frequency} mois`;
  if (unit === "weeks") return task.frequency === 1 ? "Chaque semaine" : `Toutes les ${task.frequency} semaines`;
  return task.frequency === 1 ? "Chaque jour" : `Tous les ${task.frequency} jours`;
}

function showView(focus = false) {
  const requested = location.hash.slice(1);
  const view = ["maison", "absences", "donnees"].includes(requested) ? requested : "maison";
  for (const section of document.querySelectorAll("[data-view]")) {
    section.hidden = section.dataset.view !== view;
  }
  for (const link of document.querySelectorAll(".app-nav a")) {
    if (link.hash === `#${view}`) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  if (focus) {
    document.querySelector(`[data-view="${view}"] h1`).focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}

window.addEventListener("hashchange", () => showView(true));

function render() {
  const date = core.today();
  renderedDate = date;
  const away = state.vacations.some((vacation) => core.isAway(vacation, date));
  $("#home-away-status").hidden = !away;
  $("#today-label").textContent = new Intl.DateTimeFormat("fr", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  $("#task-last-done").max = date;
  const tasks = state.tasks.map((task) => ({ task, ...core.taskStatus(task, date, state.vacations) }));
  const due = tasks.filter((task) => task.due).length;
  $("#stat-due").textContent = due;
  $("#stat-ok").textContent = tasks.length - due;
  $("#stat-total").textContent = tasks.length;
  const minutes = core.dailyMinutes(state.tasks, date, state.vacations);
  const hours = Math.floor(minutes / 60);
  $("#stat-duration").textContent = hours ? `${hours} h${minutes % 60 ? ` ${minutes % 60} min` : ""}` : `${minutes} min`;
  $("#duration-context").textContent = away ? "Suivi en pause pendant l’absence." : "Restantes aujourd’hui · toutes les pièces, indépendamment des filtres.";
  $("#vacation-status").textContent = away
    ? "Mode vacances activé. Les compteurs sont en pause. Profitez, la maison peut attendre."
    : "Les jours d’absence ne comptent pas dans vos fréquences.";
  $(".vacation").classList.toggle("is-away", away);
  $("#toggle-vacation").textContent = away ? "Je suis de retour" : "Je pars aujourd’hui";
  $("#vacation-count").textContent = `(${state.vacations.length})`;
  const vacationList = $("#vacation-list");
  vacationList.replaceChildren();
  if (!state.vacations.length) vacationList.append(makeElement("li", "hint", "Aucune absence pour le moment."));
  for (const vacation of [...state.vacations].sort((a, b) => b.start.localeCompare(a.start))) {
    const row = makeElement("li");
    const text = vacation.end === null
      ? `Depuis le ${formatDate(vacation.start)} · jusqu’à votre retour`
      : `${formatDate(vacation.start)} → ${formatDate(vacation.end)}`;
    const status = core.isAway(vacation, date) ? "En cours" : vacation.start > date ? "À venir" : "Terminée";
    row.append(makeElement("span", "", `${text} · ${status}`));
    row.append(actionButton("Supprimer", "text-button danger", () => {
      if (confirm("Supprimer cette absence ? Les jours correspondants compteront à nouveau dans les tâches.")) {
        if (save({ ...state, vacations: state.vacations.filter((item) => item.id !== vacation.id) })) notify("Absence supprimée.");
      }
    }, `Supprimer l’absence du ${formatDate(vacation.start)}`));
    vacationList.append(row);
  }

  const roomFilter = $("#room-filter");
  const selectedRoom = roomFilter.value;
  const rooms = [...new Set(state.tasks.map((task) => task.room))].sort((a, b) => a.localeCompare(b, "fr"));
  roomFilter.replaceChildren(new Option("Toutes les pièces", ""));
  $("#room-suggestions").replaceChildren();
  for (const room of rooms) {
    roomFilter.add(new Option(room, room));
    $("#room-suggestions").append(new Option(room, room));
  }
  roomFilter.value = rooms.includes(selectedRoom) ? selectedRoom : "";
  const statusFilter = $("#status-filter").value;
  const filtered = tasks.filter(({ task, due: taskDue }) =>
    (!roomFilter.value || task.room === roomFilter.value) &&
    (statusFilter === "all" || (statusFilter === "due" ? taskDue : !taskDue))
  ).sort((a, b) => Number(b.due) - Number(a.due) || a.task.room.localeCompare(b.task.room, "fr") || a.task.name.localeCompare(b.task.name, "fr"));
  const taskList = $("#task-list");
  taskList.replaceChildren();
  for (const { task, due: taskDue, elapsed, remaining } of filtered) {
    const card = makeElement("article", "task card");
    const top = makeElement("div", "section-heading");
    top.append(makeElement("span", "room-label", task.room));
    top.append(actionButton("Modifier", "text-button", () => openTask(task), `Modifier ${task.name}, ${task.room}`));
    card.append(top, makeElement("h3", "", task.name));
    const skipped = task.lastSkipped && (task.lastDone === null || task.lastSkipped > task.lastDone);
    const badge = skipped && !taskDue ? "Occurrence ignorée" : elapsed === null ? "À commencer" : taskDue ? "À faire" : "À jour";
    card.append(makeElement("span", `task-status ${taskDue ? "due" : "ok"}`, badge));
    const lastDone = task.lastDone === null ? "Pas encore effectuée" : `Dernier ménage : ${formatDate(task.lastDone)}`;
    card.append(makeElement("p", "last-done", lastDone));
    card.append(makeElement("p", "task-duration", `Durée estimée : ${task.durationMinutes} min`));
    if (skipped) card.append(makeElement("p", "hint", `Dernière occurrence ignorée : ${formatDate(task.lastSkipped)}`));
    const frequency = frequencyLabel(task);
    const schedule = elapsed === null ? frequency
      : taskDue ? `${frequency} · ${elapsed} jour${elapsed > 1 ? "s" : ""} de présence écoulé${elapsed > 1 ? "s" : ""}`
        : `${frequency} · dans ${remaining} jour${remaining > 1 ? "s" : ""} de présence`;
    card.append(makeElement("p", "hint", schedule));
    const progress = makeElement("div", "progress");
    const fill = makeElement("span");
    fill.style.width = `${elapsed === null ? 100 : Math.min(100, elapsed / core.intervalDays(task, date) * 100)}%`;
    progress.append(fill);
    progress.classList.toggle("due", taskDue);
    card.append(progress);
    const completedToday = task.lastDone === date;
    const complete = actionButton(away ? "En pause pendant l’absence" : completedToday ? "Fait aujourd’hui ✓" : "C’est fait ✓", "complete-button", () => {
      const completionDate = core.today();
      if (state.vacations.some((vacation) => core.isAway(vacation, completionDate))) {
        render();
        notify("Terminez votre absence avant de valider le ménage.");
        return;
      }
      if (save({ ...state, tasks: state.tasks.map((item) => item.id === task.id ? { ...item, lastDone: completionDate, lastSkipped: null } : item) })) {
        notify(`${task.name} : c’est noté !`);
      }
    }, `Marquer comme fait : ${task.name}, ${task.room}`);
    complete.disabled = away || completedToday;
    card.append(complete);
    if (taskDue) {
      const skip = actionButton("Ignorer cette fois", "text-button skip-button", () => {
        const skipDate = core.today();
        const current = state.tasks.find((item) => item.id === task.id);
        if (!current || state.vacations.some((vacation) => core.isAway(vacation, skipDate)) ||
            !core.taskStatus(current, skipDate, state.vacations).due) {
          render();
          notify("Cette tâche ne peut pas être ignorée : elle n’est plus à faire ou le suivi est en pause.");
          return;
        }
        if (save({ ...state, tasks: state.tasks.map((item) => item.id === task.id ? { ...item, lastSkipped: skipDate } : item) })) {
          notify(`${task.name} : occurrence ignorée. Le délai habituel redémarre aujourd’hui, sans enregistrer de ménage.`);
        }
      }, `Ignorer cette fois : ${task.name}, ${task.room}`);
      skip.disabled = away;
      card.append(skip);
    } else if (skipped) {
      card.append(actionButton("Rétablir cette occurrence", "text-button skip-button", () => {
        if (save({ ...state, tasks: state.tasks.map((item) => item.id === task.id ? { ...item, lastSkipped: null } : item) })) {
          notify(`${task.name} : occurrence rétablie.`);
        }
      }, `Rétablir cette occurrence : ${task.name}, ${task.room}`));
    }
    taskList.append(card);
  }
  $("#empty-state").hidden = filtered.length !== 0;
  $("#empty-title").textContent = state.tasks.length ? "Rien à afficher ici." : "Bienvenue chez vous.";
  $("#empty-text").textContent = state.tasks.length ? "Essayez un autre filtre, ou profitez de votre maison." : "Ajoutez votre première tâche ou démarrez avec quelques idées modifiables.";
  $("#add-examples").hidden = state.tasks.length !== 0;
}

const frequencyOptions = {
  daily: { unit: "days", count: 1 },
  days: { unit: "days" },
  weekly: { unit: "weeks", count: 1 },
  weeks: { unit: "weeks" },
  monthly: { unit: "months", count: 1 },
  months: { unit: "months" },
};

function selectedFrequency() {
  const type = $("#task-form input[name=frequencyType]:checked").value;
  const option = frequencyOptions[type];
  return {
    frequencyUnit: option.unit,
    frequency: option.count ?? Number($("#task-frequency").value),
    variable: option.count === undefined,
  };
}

function updateFrequencyControls() {
  const { frequencyUnit, frequency, variable } = selectedFrequency();
  const input = $("#task-frequency");
  $("#frequency-adjustment").hidden = !variable;
  input.disabled = !variable;
  input.max = core.FREQUENCY_LIMITS[frequencyUnit];
  $("#frequency-quantity-label").textContent = `Nombre de ${{ days: "jours", weeks: "semaines", months: "mois" }[frequencyUnit]}`;
  const valid = Number.isInteger(frequency) && frequency >= 1 && frequency <= Number(input.max);
  $("#frequency-decrease").disabled = !valid || frequency <= 1;
  $("#frequency-increase").disabled = !valid || frequency >= Number(input.max);
}

document.querySelectorAll("input[name=frequencyType]").forEach((input) => input.addEventListener("change", () => {
  $("#task-frequency").value = 2;
  updateFrequencyControls();
}));
$("#task-frequency").addEventListener("input", updateFrequencyControls);
$("#frequency-decrease").addEventListener("click", () => {
  $("#task-frequency").stepDown();
  updateFrequencyControls();
});
$("#frequency-increase").addEventListener("click", () => {
  $("#task-frequency").stepUp();
  updateFrequencyControls();
});

function openTask(task = null) {
  editingId = task?.id ?? null;
  $("#task-form").reset();
  $("#task-dialog .form-feedback").hidden = true;
  $("#task-dialog-title").textContent = task ? "Modifier la tâche" : "Nouvelle tâche";
  $("#task-name").value = task?.name ?? "";
  $("#task-room").value = task?.room ?? "";
  const unit = task?.frequencyUnit ?? "days";
  const count = task?.frequency ?? 7;
  const type = unit === "days" && count === 7 ? "weekly"
    : count === 1 ? { days: "daily", weeks: "weekly", months: "monthly" }[unit] : unit;
  $(`#task-form input[name=frequencyType][value="${type}"]`).checked = true;
  $("#task-frequency").value = frequencyOptions[type].count === undefined ? count : 2;
  updateFrequencyControls();
  $("#task-duration").value = task?.durationMinutes ?? core.DEFAULT_DURATION_MINUTES;
  $("#task-last-done").value = task?.lastDone ?? "";
  $("#task-last-done").max = core.today();
  $("#delete-task").hidden = !task;
  taskDialog.showModal();
}

$("#add-task").addEventListener("click", () => openTask());
$("#mobile-add-task").addEventListener("click", () => openTask());
$("#task-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("#task-name").value.trim();
  const room = $("#task-room").value.trim();
  if (!name || !room) {
    notify("Renseignez un nom de tâche et une pièce.");
    return;
  }
  const lastDone = $("#task-last-done").value || null;
  if (lastDone !== null && lastDone > core.today()) {
    notify("Le dernier ménage ne peut pas être dans le futur.");
    return;
  }
  const previous = state.tasks.find((item) => item.id === editingId);
  const { frequency, frequencyUnit } = selectedFrequency();
  if (!Number.isInteger(frequency) || frequency < 1 || frequency > core.FREQUENCY_LIMITS[frequencyUnit]) {
    notify("Indiquez une quantité entière dans les limites affichées pour cette fréquence.");
    return;
  }
  const durationMinutes = Number($("#task-duration").value);
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) {
    notify("Indiquez une durée entière entre 1 et 1440 minutes.");
    return;
  }
  const task = {
    id: editingId ?? crypto.randomUUID(), name, room, frequency, frequencyUnit,
    lastDone, durationMinutes, lastSkipped: previous?.lastSkipped ?? null,
  };
  const tasks = editingId ? state.tasks.map((item) => item.id === editingId ? task : item) : [...state.tasks, task];
  if (save({ ...state, tasks })) {
    taskDialog.close();
    location.hash = "maison";
    notify("Tâche enregistrée.");
  }
});

$("#delete-task").addEventListener("click", () => {
  if (confirm("Supprimer cette tâche et sa date de dernier ménage ?") &&
      save({ ...state, tasks: state.tasks.filter((task) => task.id !== editingId) })) {
    taskDialog.close();
    notify("Tâche supprimée.");
  }
});

$("#toggle-vacation").addEventListener("click", () => {
  const date = core.today();
  const away = state.vacations.some((vacation) => core.isAway(vacation, date));
  if (away && !confirm("Reprendre le suivi aujourd’hui ? Toutes les absences en cours se termineront aujourd’hui. Les absences futures restent programmées.")) return;
  const vacations = away ? core.returnToday(state.vacations, date)
    : [...state.vacations, { id: crypto.randomUUID(), start: date, end: null }];
  if (save({ ...state, vacations })) notify(away ? "Bon retour ! Les compteurs reprennent." : "Bonnes vacances ! Les compteurs sont en pause.");
});

$("#plan-vacation").addEventListener("click", () => {
  $("#vacation-form").reset();
  $("#vacation-dialog .form-feedback").hidden = true;
  $("#vacation-start").value = core.today();
  $("#vacation-end").min = core.today();
  $("#vacation-end").setCustomValidity("");
  vacationDialog.showModal();
});
$("#vacation-start").addEventListener("input", () => {
  $("#vacation-end").min = $("#vacation-start").value;
  $("#vacation-end").setCustomValidity("");
});
$("#vacation-end").addEventListener("input", () => $("#vacation-end").setCustomValidity(""));
$("#vacation-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const start = $("#vacation-start").value;
  const end = $("#vacation-end").value;
  if (end <= start) {
    $("#vacation-end").setCustomValidity("Le retour doit être après le départ.");
    $("#vacation-end").reportValidity();
    return;
  }
  const vacation = { id: crypto.randomUUID(), start, end };
  if (save({ ...state, vacations: [...state.vacations, vacation] })) {
    vacationDialog.close();
    notify("Absence enregistrée. La pause et la reprise seront automatiques.");
  }
});
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
$("#room-filter").addEventListener("change", render);
$("#status-filter").addEventListener("change", render);
$("#add-examples").addEventListener("click", () => {
  const examples = [
    ["Passer l’aspirateur", "Salon", 7],
    ["Nettoyer le plan de travail", "Cuisine", 1],
    ["Nettoyer les sanitaires", "Salle de bain", 7],
    ["Changer les draps", "Chambre", 14],
  ].map(([name, room, frequency]) => ({ id: crypto.randomUUID(), name, room, frequency, lastDone: null }));
  if (save({ ...state, tasks: [...state.tasks, ...examples] })) notify("Quelques idées ajoutées. Adaptez-les à votre maison.");
});

function backupFeedback(text, error = false) {
  const feedback = $("#backup-feedback");
  feedback.textContent = text;
  feedback.classList.toggle("error", error);
  feedback.hidden = false;
}

$("#export-backup").addEventListener("click", async () => {
  if (storageBlocked) {
    backupFeedback("Sauvegarde impossible : les données locales sont illisibles ou inaccessibles. Aucune copie vide ne sera créée à leur place.", true);
    return;
  }
  const button = $("#export-backup");
  button.disabled = true;
  try {
    const now = new Date();
    const filename = `casa-sauvegarde-${now.toISOString().replace(/[:.]/g, "-")}.json`;
    const file = new File([core.serializeBackup(state, now)], filename, { type: "application/json" });
    if (typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
      backupFeedback("Fichier transmis au menu de partage. Vérifiez qu’il a bien été enregistré dans Fichiers / iCloud Drive : Casa ne peut pas le vérifier.");
    } else {
      const url = URL.createObjectURL(file);
      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.append(link);
        link.click();
        link.remove();
        backupFeedback("Téléchargement demandé. Vérifiez le fichier JSON dans Téléchargements ou Fichiers, puis conservez-le dans iCloud Drive si souhaité.");
      } finally {
        // Safari may still be consuming the file after the click returns.
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
    }
  } catch (error) {
    if (error.name === "AbortError") {
      backupFeedback("Partage annulé. Aucun enregistrement de fichier n’a été confirmé.");
    } else {
      console.error("Impossible de créer ou de partager la sauvegarde :", error);
      backupFeedback("Sauvegarde non effectuée. Réessayez et vérifiez les autorisations de téléchargement ou de partage du navigateur.", true);
    }
  } finally {
    button.disabled = false;
  }
});

$("#import-backup").addEventListener("click", () => {
  $("#backup-file").value = "";
  $("#backup-file").click();
});
$("#backup-file").addEventListener("change", async () => {
  const file = $("#backup-file").files[0];
  if (!file) return;
  const button = $("#import-backup");
  button.disabled = true;
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error("La sauvegarde dépasse la limite de 10 Mo.");
    const backup = core.parseBackup(await file.text());
    const exportedAt = new Intl.DateTimeFormat("fr", { dateStyle: "medium", timeStyle: "short" }).format(new Date(backup.exportedAt));
    const confirmed = confirm(`Restaurer la sauvegarde du ${exportedAt} (${backup.data.tasks.length} tâche(s), ${backup.data.vacations.length} absence(s)) ?\n\nToutes les données actuelles de Casa sur cet appareil seront remplacées, même si elles sont illisibles. Conservez d’abord une copie de vos données actuelles si nécessaire. Cette action n’est pas une fusion.`);
    if (!confirmed) {
      backupFeedback("Restauration annulée. Les données actuelles sont conservées.");
      return;
    }
    if (save(backup.data, { replaceBlocked: true })) {
      $("#room-filter").value = "";
      $("#status-filter").value = "all";
      render();
      backupFeedback("Sauvegarde restaurée et enregistrée sur cet appareil. Vos tâches et absences sont à nouveau disponibles, même hors ligne.");
    } else {
      backupFeedback("Restauration non enregistrée. Les données précédentes n’ont pas été remplacées. Vérifiez l’espace disponible et les autorisations de stockage.", true);
    }
  } catch (error) {
    console.error("Impossible de restaurer la sauvegarde :", error);
    backupFeedback("Fichier illisible, trop volumineux (10 Mo maximum) ou sauvegarde Casa invalide / incompatible. Aucune donnée n’a été remplacée.", true);
  } finally {
    button.disabled = false;
    $("#backup-file").value = "";
  }
});

async function updateStoragePersistence(request = false) {
  const button = $("#request-persistence");
  const status = $("#persistence-status");
  const storage = navigator.storage;
  button.disabled = true;
  if (!storage || typeof storage.persisted !== "function") {
    status.textContent = "Ce navigateur ne permet pas de vérifier ni de demander le stockage persistant. Conservez une sauvegarde dans un fichier.";
    return;
  }
  const canRequest = typeof storage.persist === "function";
  try {
    const persistent = request && canRequest ? await storage.persist() : await storage.persisted();
    status.textContent = persistent
      ? "Stockage persistant accordé : le risque de suppression automatique est réduit, mais cela ne protège pas d’un effacement volontaire. Gardez une sauvegarde."
      : !canRequest ? "Stockage persistant non accordé et demande indisponible dans ce navigateur. Conservez une sauvegarde."
        : request ? "Le navigateur n’a pas accordé le stockage persistant. Installez Casa sur l’écran d’accueil, réessayez depuis son icône et gardez une sauvegarde."
          : "Stockage local standard. Vous pouvez demander une protection contre la suppression automatique ; le navigateur décide de l’accorder ou non.";
    button.disabled = persistent || !canRequest;
  } catch (error) {
    console.error("Impossible de vérifier ou de demander le stockage persistant :", error);
    status.textContent = "Protection du stockage non vérifiée : la demande ou la vérification a échoué. Réessayez et conservez une sauvegarde.";
    button.disabled = !canRequest;
  }
}
$("#request-persistence").addEventListener("click", () => updateStoragePersistence(true));

// Refresh on return and at midnight, including after suspended mobile sessions.
document.addEventListener("visibilitychange", () => { if (!document.hidden) render(); });
setInterval(() => { if (core.today() !== renderedDate) render(); }, 1000);
window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  // Avoid overwriting newer data with an edit started in another window.
  taskDialog.close();
  vacationDialog.close();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    state = saved === null ? { version: 1, tasks: [], vacations: [] } : core.validateState(JSON.parse(saved));
    storageBlocked = false;
    $("#storage-error").hidden = true;
    render();
    notify("Données actualisées depuis une autre fenêtre.");
  } catch (error) {
    storageBlocked = true;
    storageError(error, "Les données d’une autre fenêtre sont illisibles. Enregistrement bloqué pour éviter de les écraser.");
  }
});

let offlineRegistration = null;
let reloadForUpdate = false;
let updateActivated = false;

function showUpdateNotice() {
  $("#update-notice").hidden = false;
  $("#offline-status").textContent = "Nouvelle version prête.";
  $("#update-status").textContent = "Une nouvelle version est prête. Utilisez le bouton Mettre à jour.";
}

$("#apply-update").addEventListener("click", () => {
  if (document.querySelector("dialog[open]") &&
      !confirm("La mise à jour rechargera Casa. Les modifications du formulaire non enregistrées seront perdues. Continuer ?")) return;
  if (updateActivated) {
    location.reload();
    return;
  }
  const worker = offlineRegistration?.waiting;
  if (!worker) {
    $("#update-message").textContent = "La mise à jour n’est plus disponible. Relancez la recherche dans Données.";
    return;
  }
  reloadForUpdate = true;
  worker.postMessage({ type: "SKIP_WAITING" });
});

async function checkForUpdate(manual = false) {
  if (!offlineRegistration || $("#check-update").disabled) return;
  const button = $("#check-update");
  button.disabled = true;
  try {
    if (manual) $("#update-status").textContent = "Recherche d’une nouvelle version…";
    if (!navigator.onLine) throw new Error("Aucune connexion disponible.");
    await offlineRegistration.update();
    if (offlineRegistration.waiting || updateActivated) showUpdateNotice();
    else if (offlineRegistration.installing) $("#update-status").textContent = "Téléchargement de la mise à jour…";
    else if (manual) $("#update-status").textContent = "Casa est à jour.";
  } catch (error) {
    console.error("Impossible de rechercher une mise à jour :", error);
    $("#update-status").textContent = "Recherche impossible. Vérifiez votre connexion et réessayez.";
    if (manual) notify("Recherche de mise à jour impossible. Vérifiez votre connexion.");
  } finally {
    button.disabled = false;
  }
}

$("#check-update").addEventListener("click", () => checkForUpdate(true));
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) checkForUpdate();
});
window.addEventListener("online", () => checkForUpdate());

async function prepareOfflineMode() {
  const status = $("#offline-status");
  if (!("serviceWorker" in navigator) || !window.isSecureContext) {
    status.textContent = "Mode hors ligne indisponible : utilisez HTTPS ou localhost et un navigateur compatible.";
    $("#update-status").textContent = "Mises à jour indisponibles : utilisez HTTPS ou localhost et un navigateur compatible.";
    return;
  }
  let controlled = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!controlled) {
      controlled = true;
      return;
    }
    updateActivated = true;
    if (reloadForUpdate) location.reload();
    else showUpdateNotice();
  });
  try {
    const registration = await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
    offlineRegistration = registration;
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && registration.active) showUpdateNotice();
        else if (worker.state === "redundant") {
          console.error("Installation de la version hors ligne échouée.");
          $("#update-status").textContent = "Téléchargement de la version hors ligne échoué. Vérifiez votre connexion et réessayez.";
        }
      });
    });
    if (!registration.active) {
      const worker = registration.installing || registration.waiting;
      if (!worker) throw new Error("Aucun service worker disponible.");
      await new Promise((resolve, reject) => {
        const checkState = () => {
          if (worker.state === "activated" || worker.state === "redundant") {
            worker.removeEventListener("statechange", checkState);
            if (worker.state === "activated") resolve();
            else reject(new Error("Installation du cache hors ligne échouée."));
          }
        };
        worker.addEventListener("statechange", checkState);
        checkState();
      });
    }
    await navigator.serviceWorker.ready;
    status.textContent = "Prête à fonctionner hors ligne";
    $("#update-status").textContent = "Les mises à jour sont recherchées à l’ouverture et au retour dans Casa.";
    $("#check-update").disabled = false;
    if (registration.waiting) showUpdateNotice();
    await checkForUpdate();
  } catch (error) {
    console.error("Impossible de préparer le mode hors ligne :", error);
    status.textContent = "Mode hors ligne indisponible. Rechargez avec une connexion.";
    $("#update-status").textContent = "Initialisation des mises à jour impossible. Rechargez avec une connexion.";
  }
}

showView();
render();
updateStoragePersistence();
prepareOfflineMode();
