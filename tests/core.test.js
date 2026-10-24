"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const core = require("../core.js");
const vacation = (start, end = null, id = "v1") => ({ id, start, end });
const task = (lastDone = "2026-10-01", frequency = 7) => ({
  id: "t1", name: "Aspirateur", room: "Salon", frequency, frequencyUnit: "days", lastDone, durationMinutes: 15, lastSkipped: null,
});
const state = (tasks = [task()], vacations = []) => ({ version: 1, tasks, vacations });

test("counts calendar days across month, year and daylight-saving boundaries", () => {
  assert.equal(core.elapsedDays("2026-03-28", "2026-03-30", []), 2);
  assert.equal(core.elapsedDays("2026-10-24", "2026-10-26", []), 2);
  assert.equal(core.elapsedDays("2025-12-31", "2026-01-02", []), 2);
  assert.equal(core.elapsedDays("2024-02-28", "2024-03-01", []), 2);
  assert.equal(core.elapsedDays("2026-10-05", "2026-10-01", []), 0);
});

test("vacations freeze existing age, include departure and exclude return", () => {
  const pauses = [vacation("2026-10-04", "2026-10-11")];
  assert.equal(core.elapsedDays("2026-10-01", "2026-10-04", pauses), 3);
  assert.equal(core.elapsedDays("2026-10-01", "2026-10-08", pauses), 3);
  assert.equal(core.elapsedDays("2026-10-01", "2026-10-11", pauses), 3);
  assert.equal(core.elapsedDays("2026-10-01", "2026-10-12", pauses), 4);
  assert.equal(core.isAway(pauses[0], "2026-10-04"), true);
  assert.equal(core.isAway(pauses[0], "2026-10-11"), false);
});

test("overlapping, nested, adjacent and unordered absences are counted only once", () => {
  const pauses = [
    vacation("2026-10-07", "2026-10-12"),
    vacation("2026-10-04", "2026-10-09"),
    vacation("2026-10-05", "2026-10-06"),
    vacation("2026-10-12", "2026-10-14"),
  ];
  assert.equal(core.elapsedDays("2026-10-01", "2026-10-15", pauses), 4);
});

test("clips pauses before completion, after today, and open manual absences", () => {
  assert.equal(core.elapsedDays("2026-10-05", "2026-10-15", [
    vacation("2026-10-01", "2026-10-08"),
    vacation("2026-10-20", "2026-10-25"),
  ]), 7);
  assert.equal(core.elapsedDays("2026-10-01", "2026-10-15", [vacation("2026-10-04")]), 3);
  assert.equal(core.elapsedDays("2026-10-05", "2026-10-15", [vacation("2026-10-04")]), 0);
});

test("never-done tasks are due, exact thresholds are due, existing delays persist", () => {
  assert.deepEqual(core.taskStatus(task(null), "2026-10-01", []), { elapsed: null, due: true, remaining: 0 });
  assert.deepEqual(core.taskStatus(task(), "2026-10-07", []), { elapsed: 6, due: false, remaining: 1 });
  assert.deepEqual(core.taskStatus(task(), "2026-10-08", []), { elapsed: 7, due: true, remaining: 0 });
  assert.equal(core.taskStatus(task(), "2026-10-24", [vacation("2026-10-10")]).elapsed, 9);
  assert.equal(core.taskStatus(task(), "2026-10-24", [vacation("2026-10-10")]).due, true);
  assert.equal(core.taskStatus(task("2026-10-24"), "2026-10-24", []).elapsed, 0);
});

test("return ends all current pauses, preserves future ones, and cancels same-day departures", () => {
  const pauses = [
    vacation("2026-10-01", null, "a"),
    vacation("2026-10-03", "2026-10-20", "b"),
    vacation("2026-10-10", null, "c"),
    vacation("2026-10-15", "2026-10-20", "d"),
    vacation("2026-09-01", "2026-09-10", "e"),
  ];
  const result = core.returnToday(pauses, "2026-10-10");
  assert.deepEqual(result.map((item) => [item.id, item.end]), [
    ["a", "2026-10-10"], ["b", "2026-10-10"], ["d", "2026-10-20"], ["e", "2026-09-10"],
  ]);
  assert.equal(result.some((item) => core.isAway(item, "2026-10-10")), false);
  assert.equal(pauses[0].end, null);
  assert.equal(core.validateState(state([], result)).vacations.length, 4);
});

test("invalid dates and malformed or unknown storage are rejected without fallback", () => {
  for (const date of ["2026-02-30", "2026-13-01", "2026-1-01", "", null, 12]) {
    assert.throws(() => core.dayNumber(date));
  }
  for (const invalid of [
    null, {}, { version: 2, tasks: [], vacations: [] },
    state([{ ...task(), frequency: 0 }]),
    state([{ ...task(), frequency: 1.5 }]),
    state([{ ...task(), frequency: 3651 }]),
    state([{ ...task(), name: " " }]),
    state([{ ...task(), room: "" }]),
    state([{ ...task(), lastDone: "2026-02-30" }]),
    state([task(), task()]),
    state([], [vacation("2026-10-10", "2026-10-10")]),
    state([], [vacation("2026-10-10", "2026-10-09")]),
    state([task()], [vacation("2026-10-10", null, "t1")]),
  ]) assert.throws(() => core.validateState(invalid));
  assert.deepEqual(core.validateState(state()), state());
  assert.deepEqual(core.validateState(state([], [vacation("2026-10-10")])), state([], [vacation("2026-10-10")]));
});

test("today uses local date components", () => {
  assert.equal(core.today(new Date(2026, 0, 2, 0, 1)), "2026-01-02");
  assert.equal(core.today(new Date(2026, 11, 31, 23, 59)), "2026-12-31");
});

test("backup round-trip preserves every task and vacation without changing live state", () => {
  const original = state([
    { ...task(), name: "Évier <script>", room: "Cuisine" },
    { ...task(null, 1), id: "t2" },
  ], [
    vacation("2026-10-04", "2026-10-11"),
    vacation("2026-11-01", null, "v2"),
  ]);
  const before = JSON.stringify(original);
  const now = new Date("2026-10-24T08:15:00Z");
  const text = core.serializeBackup(original, now);
  const restored = core.parseBackup(text);
  assert.equal(restored.exportedAt, now.toISOString());
  assert.deepEqual(restored.data, original);
  assert.equal(JSON.stringify(original), before);
  restored.data.tasks[0].name = "Changed";
  assert.equal(JSON.stringify(original), before);
  assert.equal(JSON.parse(text).format, "casa-backup");
  assert.deepEqual(core.parseBackup(core.serializeBackup(state([], []))).data, state([], []));
});

test("backup validation rejects malformed, foreign, future and damaged backups", () => {
  const valid = JSON.parse(core.serializeBackup(state()));
  for (const invalid of [
    "{", "null", "[]", JSON.stringify(state()), JSON.stringify({ ...valid, format: "other" }),
    JSON.stringify({ ...valid, version: 4 }),
    JSON.stringify({ ...valid, exportedAt: null }),
    JSON.stringify({ ...valid, exportedAt: "not a date" }),
    JSON.stringify({ ...valid, data: { ...state(), version: 2 } }),
    JSON.stringify({ ...valid, data: state([{ ...task(), frequency: 0 }]) }),
    JSON.stringify({ ...valid, data: state([task(), task()]) }),
    JSON.stringify({ ...valid, data: state([], [vacation("2026-10-11", "2026-10-04")]) }),
  ]) assert.throws(() => core.parseBackup(invalid));
  assert.throws(() => core.serializeBackup(state([{ ...task(), room: "" }])));
});

test("backup only includes known fields, not arbitrary imported properties", () => {
  const original = { ...state([{ ...task(), extra: "ignored" }]), unrelated: true };
  const backup = JSON.parse(core.serializeBackup(original));
  backup.data.unknown = "ignored";
  backup.data.tasks[0].extra = "ignored";
  assert.deepEqual(core.parseBackup(JSON.stringify(backup)).data, state());
});

test("legacy tasks and backups receive 15 minutes without mutating their source", () => {
  const { durationMinutes, lastSkipped, frequencyUnit, ...legacyTask } = task();
  const legacy = state([legacyTask]);
  const before = JSON.stringify(legacy);
  assert.deepEqual(core.validateState(legacy), state());
  assert.equal(JSON.stringify(legacy), before);
  const backup = { format: "casa-backup", version: 1, exportedAt: "2026-10-24T08:00:00Z", data: legacy };
  assert.deepEqual(core.parseBackup(JSON.stringify(backup)).data, state());
  assert.equal(core.dailyMinutes([legacyTask], "2026-10-24", []), 15);
});

test("invalid durations and skipped dates are rejected in storage and backups", () => {
  for (const durationMinutes of [0, -1, 1.5, 1441, null, "15", NaN, Infinity]) {
    const invalid = state([{ ...task(), durationMinutes }]);
    assert.throws(() => core.validateState(invalid));
    assert.throws(() => core.serializeBackup(invalid));
  }
  for (const lastSkipped of ["", "2026-02-30", false, 42]) {
    assert.throws(() => core.validateState(state([{ ...task(), lastSkipped }])));
  }
  for (const durationMinutes of [1, 1440]) {
    assert.equal(core.validateState(state([{ ...task(), durationMinutes }])).tasks[0].durationMinutes, durationMinutes);
  }
  const backup = JSON.parse(core.serializeBackup(state()));
  backup.data.tasks[0].durationMinutes = null;
  assert.throws(() => core.parseBackup(JSON.stringify(backup)));
});

test("skipping restarts the interval without claiming a cleaning took place", () => {
  for (const lastDone of [null, "2026-10-01"]) {
    const skipped = { ...task(lastDone), lastSkipped: "2026-10-24" };
    assert.deepEqual(core.taskStatus(skipped, "2026-10-24", []), { elapsed: 0, due: false, remaining: 7 });
    assert.equal(core.taskStatus(skipped, "2026-10-30", []).due, false);
    assert.equal(core.taskStatus(skipped, "2026-10-31", []).due, true);
    assert.equal(skipped.lastDone, lastDone);
    assert.equal(core.taskStatus({ ...skipped, lastSkipped: null }, "2026-10-24", []).due, true);
  }
  assert.equal(core.taskStatus({ ...task("2026-10-25"), lastSkipped: "2026-10-24" }, "2026-10-31", []).due, false);
  assert.equal(core.taskStatus({ ...task(null, 1), lastSkipped: "2026-10-24" }, "2026-10-25", []).due, true);
});

test("skipped intervals respect overlapping vacations and calendar boundaries", () => {
  const skipped = { ...task(null), lastSkipped: "2026-10-24" };
  const pauses = [vacation("2026-10-25", "2026-10-28"), vacation("2026-10-26", "2026-10-29", "v2")];
  assert.deepEqual(core.taskStatus(skipped, "2026-10-31", pauses), { elapsed: 3, due: false, remaining: 4 });
  assert.equal(core.taskStatus(skipped, "2026-11-04", pauses).due, true);
});

test("daily estimate sums all due rooms and excludes completed or skipped tasks", () => {
  const tasks = [
    { ...task(null), durationMinutes: 20 },
    { ...task("2026-10-01"), id: "t2", room: "Cuisine", durationMinutes: 45 },
    { ...task("2026-10-24"), id: "t3", durationMinutes: 30 },
    { ...task("2026-10-23"), id: "t4", durationMinutes: 10 },
    { ...task(null), id: "t5", lastSkipped: "2026-10-24", durationMinutes: 25 },
  ];
  assert.equal(core.dailyMinutes(tasks, "2026-10-24", []), 65);
  assert.equal(core.dailyMinutes([], "2026-10-24", []), 0);
  assert.equal(core.dailyMinutes(tasks, "2026-10-24", [vacation("2026-10-24")]), 0);
  assert.equal(core.dailyMinutes(tasks, "2026-10-25", [vacation("2026-10-24", "2026-10-25")]), 65);
  assert.equal(core.dailyMinutes([{ ...task(null, 1), lastSkipped: "2026-10-24", durationMinutes: 25 }], "2026-10-25", []), 25);
});

test("backups preserve duration and skip dates", () => {
  const original = state([{ ...task(), durationMinutes: 95, lastSkipped: "2026-10-24" }]);
  const backup = core.serializeBackup(original);
  assert.equal(JSON.parse(backup).version, 3);
  assert.deepEqual(core.parseBackup(backup).data, original);
});

test("daily, custom days, weekly and custom weeks use presence days", () => {
  for (const [unit, count, days] of [["days", 1, 1], ["days", 3, 3], ["weeks", 1, 7], ["weeks", 2, 14]]) {
    const scheduled = { ...task("2026-10-01", count), frequencyUnit: unit };
    assert.equal(core.intervalDays(scheduled, "2026-10-01"), days);
    const dueDate = new Date(Date.UTC(2026, 9, 1 + days)).toISOString().slice(0, 10);
    assert.equal(core.taskStatus(scheduled, dueDate, []).due, true);
    assert.equal(core.taskStatus(scheduled, dueDate, [vacation("2026-10-01", "2026-10-02")]).remaining, 1);
  }
});

test("calendar months clamp to month end without treating a month as 30 days", () => {
  for (const [reference, months, days] of [
    ["2026-01-31", 1, 28],
    ["2024-01-31", 1, 29],
    ["2026-01-31", 2, 59],
    ["2026-03-31", 1, 30],
    ["2026-04-30", 1, 30],
    ["2026-12-31", 2, 59],
    ["2024-02-29", 12, 365],
  ]) {
    const scheduled = { ...task(reference, months), frequencyUnit: "months" };
    assert.equal(core.intervalDays(scheduled, reference), days);
    const dueDate = new Date((core.dayNumber(reference) + days) * 86400000).toISOString().slice(0, 10);
    const previousDate = new Date((core.dayNumber(reference) + days - 1) * 86400000).toISOString().slice(0, 10);
    assert.equal(core.taskStatus(scheduled, previousDate, []).remaining, 1);
    assert.equal(core.taskStatus(scheduled, dueDate, []).due, true);
  }
  assert.equal(core.taskStatus({ ...task(null, 1), frequencyUnit: "months" }, "2026-02-01", []).due, true);
});

test("calendar months postpone across overlapping and additional vacation intervals", () => {
  const scheduled = { ...task("2026-01-31", 1), frequencyUnit: "months" };
  const pauses = [
    vacation("2026-02-10", "2026-02-15"),
    vacation("2026-02-12", "2026-02-17", "v2"),
    vacation("2026-03-01", "2026-03-03", "v3"),
  ];
  assert.equal(core.taskStatus(scheduled, "2026-03-08", pauses).remaining, 1);
  assert.equal(core.taskStatus(scheduled, "2026-03-09", pauses).due, true);
  assert.equal(core.taskStatus(scheduled, "2026-05-01", [vacation("2026-02-01")]).remaining, 27);
});

test("monthly skip uses the skipped date, and completion restarts the calendar interval", () => {
  const skipped = { ...task("2026-01-31", 1), frequencyUnit: "months", lastSkipped: "2026-02-15" };
  assert.equal(core.taskStatus(skipped, "2026-03-14", []).remaining, 1);
  assert.equal(core.taskStatus(skipped, "2026-03-15", []).due, true);
  assert.equal(core.dailyMinutes([skipped], "2026-02-28", []), 0);
  assert.equal(core.dailyMinutes([skipped], "2026-03-15", []), 15);
  const completed = { ...skipped, lastDone: "2026-02-28", lastSkipped: null };
  assert.equal(core.taskStatus(completed, "2026-03-27", []).remaining, 1);
  assert.equal(core.taskStatus(completed, "2026-03-28", []).due, true);
});

test("frequency units and limits are validated in storage and backups", () => {
  for (const frequencyUnit of [null, "", "years", 7, {}, "toString", "constructor"]) {
    assert.throws(() => core.validateState(state([{ ...task(), frequencyUnit }])));
  }
  for (const frequencyUnit of ["days", "weeks", "months"]) {
    for (const frequency of [0, 1.5, "2", core.FREQUENCY_LIMITS[frequencyUnit] + 1]) {
      const invalid = state([{ ...task(), frequency, frequencyUnit }]);
      assert.throws(() => core.validateState(invalid));
      assert.throws(() => core.serializeBackup(invalid));
    }
    assert.equal(core.validateState(state([{ ...task(), frequency: core.FREQUENCY_LIMITS[frequencyUnit], frequencyUnit }])).tasks[0].frequencyUnit, frequencyUnit);
  }
});

test("v3 backups preserve calendar frequencies and legacy backups remain day-based", () => {
  const original = state([
    { ...task("2026-01-31", 2), frequencyUnit: "months" },
    { ...task(null, 3), frequencyUnit: "weeks", id: "t2" },
  ]);
  assert.deepEqual(core.parseBackup(core.serializeBackup(original)).data, original);
  for (const version of [1, 2]) {
    const { frequencyUnit, ...legacy } = task("2026-01-31", 30);
    const restored = core.parseBackup(JSON.stringify({
      format: "casa-backup", version, exportedAt: "2026-10-24T08:00:00Z", data: state([legacy]),
    })).data.tasks[0];
    assert.equal(restored.frequencyUnit, "days");
    assert.equal(restored.frequency, 30);
    assert.equal(core.intervalDays(restored, "2026-02-01"), 30);
  }
});
