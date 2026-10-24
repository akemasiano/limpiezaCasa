"use strict";

(() => {
  const DAY = 86400000;
  const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
  const DEFAULT_DURATION_MINUTES = 15;

  function dayNumber(date) {
    if (typeof date !== "string" || !DATE_PATTERN.test(date)) throw new Error("Date invalide.");
    const value = Date.parse(`${date}T00:00:00Z`);
    if (!Number.isFinite(value) || new Date(value).toISOString().slice(0, 10) !== date) {
      throw new Error("Date invalide.");
    }
    return value / DAY;
  }

  function today(now = new Date()) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function isAway(vacation, date) {
    return vacation.start <= date && (vacation.end === null || date < vacation.end);
  }

  function elapsedDays(from, to, vacations) {
    const start = dayNumber(from);
    const end = dayNumber(to);
    if (end <= start) return 0;
    const intervals = vacations.map((vacation) => [
      Math.max(start, dayNumber(vacation.start)),
      Math.min(end, vacation.end === null ? end : dayNumber(vacation.end)),
    ]).filter(([left, right]) => right > left).sort((a, b) => a[0] - b[0]);
    let paused = 0;
    let coveredUntil = start;
    for (const [left, right] of intervals) {
      paused += Math.max(0, right - Math.max(left, coveredUntil));
      coveredUntil = Math.max(coveredUntil, right);
    }
    return end - start - paused;
  }

  function taskStatus(task, date, vacations) {
    const reference = task.lastSkipped && (task.lastDone === null || task.lastSkipped > task.lastDone)
      ? task.lastSkipped : task.lastDone;
    const elapsed = reference === null ? null : elapsedDays(reference, date, vacations);
    return { elapsed, due: elapsed === null || elapsed >= task.frequency, remaining: elapsed === null ? 0 : Math.max(0, task.frequency - elapsed) };
  }

  function dailyMinutes(tasks, date, vacations) {
    if (vacations.some((vacation) => isAway(vacation, date))) return 0;
    return tasks.filter((task) => taskStatus(task, date, vacations).due)
      .reduce((total, task) => total + (task.durationMinutes ?? DEFAULT_DURATION_MINUTES), 0);
  }

  function validText(value, max) {
    return typeof value === "string" && value.trim().length > 0 && value.length <= max;
  }

  function validateState(state) {
    if (!state || state.version !== 1 || !Array.isArray(state.tasks) || !Array.isArray(state.vacations)) {
      throw new Error("Format de sauvegarde non reconnu.");
    }
    const ids = new Set();
    for (const item of [...state.tasks, ...state.vacations]) {
      if (!item || !validText(item.id, 100) || ids.has(item.id)) throw new Error("Identifiant invalide ou dupliqué.");
      ids.add(item.id);
    }
    for (const task of state.tasks) {
      if (!validText(task.name, 100) || !validText(task.room, 60) ||
          !Number.isInteger(task.frequency) || task.frequency < 1 || task.frequency > 3650) {
        throw new Error("Tâche invalide.");
      }
      if (task.lastDone !== null) dayNumber(task.lastDone);
      if (task.lastSkipped !== undefined && task.lastSkipped !== null) dayNumber(task.lastSkipped);
      if (task.durationMinutes !== undefined &&
          (!Number.isInteger(task.durationMinutes) || task.durationMinutes < 1 || task.durationMinutes > 1440)) {
        throw new Error("La durée estimée doit être un nombre entier de minutes entre 1 et 1440.");
      }
    }
    for (const vacation of state.vacations) {
      dayNumber(vacation.start);
      if (vacation.end !== null) {
        dayNumber(vacation.end);
        if (vacation.end <= vacation.start) throw new Error("Le retour doit suivre le départ.");
      }
    }
    return {
      ...state,
      tasks: state.tasks.map((task) => ({
        ...task,
        durationMinutes: task.durationMinutes ?? DEFAULT_DURATION_MINUTES,
        lastSkipped: task.lastSkipped ?? null,
      })),
    };
  }

  function returnToday(vacations, date) {
    return vacations.flatMap((vacation) => {
      if (!isAway(vacation, date)) return [vacation];
      // A same-day return cancels this pause rather than storing an empty interval.
      return vacation.start === date ? [] : [{ ...vacation, end: date }];
    });
  }

  function snapshot(state) {
    state = validateState(state);
    return {
      version: 1,
      tasks: state.tasks.map(({ id, name, room, frequency, lastDone, durationMinutes, lastSkipped }) =>
        ({ id, name, room, frequency, lastDone, durationMinutes, lastSkipped })),
      vacations: state.vacations.map(({ id, start, end }) => ({ id, start, end })),
    };
  }

  function serializeBackup(state, now = new Date()) {
    return JSON.stringify({
      format: "casa-backup",
      version: 2,
      exportedAt: now.toISOString(),
      data: snapshot(state),
    }, null, 2);
  }

  function parseBackup(text) {
    const backup = JSON.parse(text);
    if (!backup || backup.format !== "casa-backup" || ![1, 2].includes(backup.version) ||
        typeof backup.exportedAt !== "string" || !Number.isFinite(Date.parse(backup.exportedAt))) {
      throw new Error("Ce fichier n’est pas une sauvegarde Casa compatible.");
    }
    return { exportedAt: backup.exportedAt, data: snapshot(backup.data) };
  }

  const api = { DEFAULT_DURATION_MINUTES, dayNumber, today, isAway, elapsedDays, taskStatus, dailyMinutes, validateState, returnToday, serializeBackup, parseBackup };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.CasaCore = Object.freeze(api);
})();
