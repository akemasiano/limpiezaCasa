"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const core = require("../core.js");
const vacation = (start, end = null, id = "v1") => ({ id, start, end });
const task = (lastDone = "2026-10-01", frequency = 7) => ({ id: "t1", name: "Aspirateur", room: "Salon", frequency, lastDone });
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
    JSON.stringify({ ...valid, version: 2 }),
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
