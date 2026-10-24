"use strict";

(() => {
  const DAY = 86400000;
  const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
    const elapsed = task.lastDone === null ? null : elapsedDays(task.lastDone, date, vacations);
    return { elapsed, due: elapsed === null || elapsed >= task.frequency, remaining: elapsed === null ? 0 : Math.max(0, task.frequency - elapsed) };
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
    }
    for (const vacation of state.vacations) {
      dayNumber(vacation.start);
      if (vacation.end !== null) {
        dayNumber(vacation.end);
        if (vacation.end <= vacation.start) throw new Error("Le retour doit suivre le départ.");
      }
    }
    return state;
  }

  function returnToday(vacations, date) {
    return vacations.flatMap((vacation) => {
      if (!isAway(vacation, date)) return [vacation];
      // A same-day return cancels this pause rather than storing an empty interval.
      return vacation.start === date ? [] : [{ ...vacation, end: date }];
    });
  }

  function snapshot(state) {
    validateState(state);
    return {
      version: 1,
      tasks: state.tasks.map(({ id, name, room, frequency, lastDone }) => ({ id, name, room, frequency, lastDone })),
      vacations: state.vacations.map(({ id, start, end }) => ({ id, start, end })),
    };
  }

  function serializeBackup(state, now = new Date()) {
    return JSON.stringify({
      format: "casa-backup",
      version: 1,
      exportedAt: now.toISOString(),
      data: snapshot(state),
    }, null, 2);
  }

  function parseBackup(text) {
    const backup = JSON.parse(text);
    if (!backup || backup.format !== "casa-backup" || backup.version !== 1 ||
        typeof backup.exportedAt !== "string" || !Number.isFinite(Date.parse(backup.exportedAt))) {
      throw new Error("Ce fichier n’est pas une sauvegarde Casa compatible.");
    }
    return { exportedAt: backup.exportedAt, data: snapshot(backup.data) };
  }

  const api = { dayNumber, today, isAway, elapsedDays, taskStatus, validateState, returnToday, serializeBackup, parseBackup };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.CasaCore = Object.freeze(api);
})();
