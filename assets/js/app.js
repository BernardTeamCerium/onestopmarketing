/* =================================================================
   BEACON — Tasks module
   A self-contained, no-backend task manager:
     • One-off vs recurring (daily / weekly) tasks
     • In-app + browser-notification reminders
     • "Add to Google Calendar" + email actions per task
     • Share a set of tasks with a teammate via a link
   Data persists in localStorage on this device/browser.
   ================================================================= */
(function () {
  "use strict";

  var STORE_KEY = "beaconTasks.v1";
  var SETTINGS_KEY = "beaconTasks.settings.v1";

  /* ---------------- State ---------------- */
  var tasks = load();
  var settings = loadSettings();
  var view = "today";
  var sort = "smart";
  var query = "";
  var reminderTimers = [];

  /* ---------------- Storage ---------------- */
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return seed();
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(tasks)); } catch (e) {}
  }
  function loadSettings() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { notify: false };
  }
  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
  }

  // Friendly starter tasks so the app isn't empty on first visit.
  function seed() {
    var t = todayStr();
    return [
      { id: uid(), title: "Review this week's lead pipeline in Beacon", notes: "Check new inquiries and follow up with hot leads.", type: "oneoff", date: t, time: "16:00", priority: "high", assignee: "", completed: false, createdAt: Date.now() },
      { id: uid(), title: "Post a market-update insight", notes: "Keep the firm visible and build authority.", type: "weekly", weekday: 2, time: "09:00", priority: "medium", assignee: "", completed: false, lastCompleted: "", createdAt: Date.now() },
      { id: uid(), title: "Reply to new Google reviews", notes: "Protect the 5-star reputation — respond within 24h.", type: "daily", time: "08:30", priority: "medium", assignee: "", completed: false, lastCompleted: "", createdAt: Date.now() }
    ];
  }

  /* ---------------- Helpers ---------------- */
  function uid() { return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function todayStr() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseDate(str) { var p = (str || "").split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }

  // Monday-based start of the current week, as YYYY-MM-DD.
  function weekStartStr() {
    var d = new Date(); var day = (d.getDay() + 6) % 7; // 0 = Monday
    d.setDate(d.getDate() - day); d.setHours(0, 0, 0, 0);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function b64encode(str) { return btoa(unescape(encodeURIComponent(str))); }
  function b64decode(str) { return decodeURIComponent(escape(atob(str))); }

  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var GCAL_BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

  function isRecurring(t) { return t.type === "daily" || t.type === "weekly"; }
  function isEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || "").trim()); }

  // Is a recurring task scheduled to occur today?
  function recurringDueToday(t) {
    if (t.type === "daily") return true;
    if (t.type === "weekly") return new Date().getDay() === (t.weekday == null ? 1 : +t.weekday);
    return false;
  }

  // Has the task been completed for its current period?
  function completedThisPeriod(t) {
    if (!isRecurring(t)) return !!t.completed;
    if (!t.lastCompleted) return false;
    if (t.type === "daily") return t.lastCompleted === todayStr();
    if (t.type === "weekly") return t.lastCompleted >= weekStartStr();
    return false;
  }
  // Display "done" state.
  function isDone(t) { return isRecurring(t) ? completedThisPeriod(t) : !!t.completed; }

  // Returns { ts, state, label } for the next/active due moment, or null.
  function dueInfo(t) {
    var dateStr = null;
    if (t.type === "oneoff") { if (!t.date) return null; dateStr = t.date; }
    else if (recurringDueToday(t)) { dateStr = todayStr(); }
    else { return null; }

    var time = t.time || "23:59";
    var p = time.split(":");
    var d = parseDate(dateStr);
    d.setHours(+p[0] || 0, +p[1] || 0, 0, 0);
    var ts = d.getTime();
    var diff = ts - Date.now();

    var state = "normal";
    if (isDone(t)) state = "done";
    else if (diff < 0) state = "overdue";
    else if (diff <= 60 * 60 * 1000) state = "soon";

    return { ts: ts, state: state, label: dueLabel(t, dateStr, time) };
  }

  function dueLabel(t, dateStr, time) {
    var hm = formatTime(time);
    if (t.type === "daily") return "Daily" + (t.time ? " · " + hm : "");
    if (t.type === "weekly") return WEEKDAYS_SHORT[t.weekday == null ? 1 : +t.weekday] + (t.time ? " · " + hm : "");
    // one-off
    var d = parseDate(dateStr);
    var today = parseDate(todayStr());
    var dayDiff = Math.round((d - today) / 86400000);
    var rel = dayDiff === 0 ? "Today" : dayDiff === 1 ? "Tomorrow" : dayDiff === -1 ? "Yesterday"
      : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return rel + (t.time ? " · " + hm : "");
  }

  function formatTime(time) {
    if (!time) return "";
    var p = time.split(":"); var h = +p[0]; var m = p[1];
    var ap = h >= 12 ? "PM" : "AM"; var h12 = h % 12 || 12;
    return h12 + ":" + m + " " + ap;
  }

  /* ---------------- Filtering / views ---------------- */
  function matchesView(t, v) {
    var active = !isDone(t);
    switch (v) {
      case "today": {
        if (!active) return false;
        var di = dueInfo(t);
        if (isRecurring(t)) return recurringDueToday(t);
        return di && di.ts <= endOfToday(); // due today or overdue
      }
      case "upcoming": {
        if (!active) return false;
        if (isRecurring(t)) return !recurringDueToday(t);
        var d = dueInfo(t);
        return d && d.ts > endOfToday();
      }
      case "all": return active;
      case "oneoff": return active && t.type === "oneoff";
      case "daily": return active && t.type === "daily";
      case "weekly": return active && t.type === "weekly";
      case "shared": return active && !!(t.assignee && t.assignee.trim());
      case "done": return isDone(t);
      default: return active;
    }
  }
  function endOfToday() { var d = parseDate(todayStr()); d.setHours(23, 59, 59, 999); return d.getTime(); }

  function priorityRank(p) { return p === "high" ? 0 : p === "medium" ? 1 : 2; }

  function sortTasks(list) {
    var copy = list.slice();
    if (sort === "priority") {
      copy.sort(function (a, b) { return priorityRank(a.priority) - priorityRank(b.priority); });
    } else if (sort === "due") {
      copy.sort(function (a, b) {
        var da = dueInfo(a), db = dueInfo(b);
        return (da ? da.ts : Infinity) - (db ? db.ts : Infinity);
      });
    } else { // smart: overdue/soon first, then due time, then priority
      copy.sort(function (a, b) {
        var da = dueInfo(a), db = dueInfo(b);
        var sa = da ? da.ts : Infinity, sb = db ? db.ts : Infinity;
        if (sa !== sb) return sa - sb;
        return priorityRank(a.priority) - priorityRank(b.priority);
      });
    }
    return copy;
  }

  /* ---------------- Rendering ---------------- */
  var listEl = document.getElementById("taskList");

  var VIEW_META = {
    today: ["Today", "Everything due today, plus anything overdue."],
    upcoming: ["Upcoming", "Tasks scheduled beyond today."],
    all: ["All active tasks", "Every open task across one-off and recurring."],
    oneoff: ["One-off tasks", "Single tasks that are done once and cleared."],
    daily: ["Daily tasks", "Recurring routines that reset every day."],
    weekly: ["Weekly tasks", "Recurring routines that reset each week."],
    shared: ["Shared with team", "Tasks assigned to or shared with a teammate."],
    done: ["Completed", "Recently finished tasks (recurring reset each period)."]
  };

  function render() {
    // Title
    var meta = VIEW_META[view] || VIEW_META.today;
    document.getElementById("viewTitle").textContent = meta[0];
    document.getElementById("viewSub").textContent = meta[1];

    updateCounts();
    updateTeamList();

    var q = query.trim().toLowerCase();
    var filtered = tasks.filter(function (t) {
      if (!matchesView(t, view)) return false;
      if (q) {
        var hay = (t.title + " " + (t.notes || "") + " " + (t.assignee || "")).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    if (!filtered.length) {
      listEl.innerHTML = emptyState();
      return;
    }

    var ordered = sortTasks(filtered);
    listEl.innerHTML = "";

    if (view === "today" || view === "all" || view === "upcoming") {
      // Group by type for clarity
      var groups = [
        ["Overdue", ordered.filter(function (t) { var d = dueInfo(t); return d && d.state === "overdue"; })],
        ["One-off", ordered.filter(function (t) { var d = dueInfo(t); return t.type === "oneoff" && !(d && d.state === "overdue"); })],
        ["Recurring", ordered.filter(function (t) { var d = dueInfo(t); return isRecurring(t) && !(d && d.state === "overdue"); })]
      ];
      groups.forEach(function (g) {
        if (!g[1].length) return;
        listEl.appendChild(groupHead(g[0], g[1].length));
        g[1].forEach(function (t) { listEl.appendChild(taskNode(t)); });
      });
    } else {
      ordered.forEach(function (t) { listEl.appendChild(taskNode(t)); });
    }
  }

  function groupHead(label, n) {
    var div = document.createElement("div");
    div.className = "group-head";
    div.innerHTML = '<h2></h2><span class="g-count"></span><span class="g-line"></span>';
    div.querySelector("h2").textContent = label;
    div.querySelector(".g-count").textContent = n;
    return div;
  }

  function emptyState() {
    return '<div class="empty"><div class="e-ico">✦</div><h3>Nothing here yet</h3>' +
      '<p>Add a task above to stay organized and get reminded.</p></div>';
  }

  function taskNode(t) {
    var di = dueInfo(t);
    var done = isDone(t);
    var el = document.createElement("article");
    el.className = "task" + (done ? " done" : "") + (di && di.state === "overdue" ? " overdue" : "") + (di && di.state === "soon" ? " due-soon" : "");
    el.dataset.id = t.id;

    // checkbox
    var check = document.createElement("button");
    check.className = "check"; check.type = "button";
    check.setAttribute("aria-label", done ? "Mark incomplete" : "Mark complete");
    check.textContent = "✓";
    check.addEventListener("click", function () { toggle(t.id); });

    // main
    var main = document.createElement("div");
    main.className = "task-main";
    var title = document.createElement("div");
    title.className = "task-title"; title.textContent = t.title;
    main.appendChild(title);
    if (t.notes) {
      var notes = document.createElement("div");
      notes.className = "task-notes"; notes.textContent = t.notes;
      main.appendChild(notes);
    }
    main.appendChild(chips(t, di));

    // actions
    var actions = document.createElement("div");
    actions.className = "task-actions";
    actions.appendChild(iconBtn("📅", "Add to Google Calendar", function () { window.open(gcalUrl(t), "_blank", "noopener"); }));
    actions.appendChild(iconBtn("✉", "Email this task", function () { window.location.href = mailtoUrl(t); }));
    actions.appendChild(iconBtn("✎", "Edit task", function () { editTask(t.id); }));
    actions.appendChild(iconBtn("🗑", "Delete task", function () { removeTask(t.id); }, true));

    el.appendChild(check);
    el.appendChild(main);
    el.appendChild(actions);
    return el;
  }

  function iconBtn(label, title, fn, danger) {
    var b = document.createElement("button");
    b.className = "icon-btn" + (danger ? " danger" : "");
    b.type = "button"; b.title = title; b.setAttribute("aria-label", title);
    b.textContent = label;
    b.addEventListener("click", fn);
    return b;
  }

  function chips(t, di) {
    var wrap = document.createElement("div");
    wrap.className = "chips";

    // type
    var typeChip = document.createElement("span");
    if (t.type === "oneoff") { typeChip.className = "chip type-oneoff"; typeChip.textContent = "One-off"; }
    else if (t.type === "daily") { typeChip.className = "chip type-recurring"; typeChip.textContent = "↻ Daily"; }
    else { typeChip.className = "chip type-recurring"; typeChip.textContent = "↻ Weekly"; }
    wrap.appendChild(typeChip);

    // due
    if (di) {
      var dueChip = document.createElement("span");
      dueChip.className = "chip due" + (di.state === "overdue" ? " overdue" : di.state === "soon" ? " soon" : "");
      var prefix = di.state === "overdue" ? "⚠ " : "◷ ";
      dueChip.textContent = prefix + di.label;
      wrap.appendChild(dueChip);
    }

    // priority
    var pr = document.createElement("span");
    pr.className = "chip prio-" + (t.priority || "medium");
    pr.innerHTML = '<span class="dot"></span>';
    pr.appendChild(document.createTextNode((t.priority || "medium").charAt(0).toUpperCase() + (t.priority || "medium").slice(1)));
    wrap.appendChild(pr);

    // shared
    if (t.assignee && t.assignee.trim()) {
      var sh = document.createElement("span");
      sh.className = "chip shared";
      sh.textContent = "⊕ " + t.assignee.trim();
      wrap.appendChild(sh);
    }
    return wrap;
  }

  function updateCounts() {
    var views = ["today", "upcoming", "all", "oneoff", "daily", "weekly", "shared", "done"];
    views.forEach(function (v) {
      var n = tasks.filter(function (t) { return matchesView(t, v); }).length;
      document.querySelectorAll('[data-count="' + v + '"]').forEach(function (el) { el.textContent = n; });
    });
    // highlight overdue count on Today
    var overdue = tasks.filter(function (t) { if (isDone(t)) return false; var d = dueInfo(t); return d && d.state === "overdue"; }).length;
    var todayLink = document.querySelector('.side-link[data-view="today"]');
    if (todayLink) todayLink.classList.toggle("alert", overdue > 0);
  }

  function updateTeamList() {
    var names = {};
    tasks.forEach(function (t) { if (t.assignee && t.assignee.trim()) names[t.assignee.trim()] = true; });
    var dl = document.getElementById("teamList");
    dl.innerHTML = "";
    Object.keys(names).forEach(function (n) {
      var o = document.createElement("option"); o.value = n; dl.appendChild(o);
    });
  }

  /* ---------------- Mutations ---------------- */
  function toggle(id) {
    var t = find(id); if (!t) return;
    if (isRecurring(t)) {
      t.lastCompleted = completedThisPeriod(t) ? "" : todayStr();
    } else {
      t.completed = !t.completed;
    }
    commit();
  }
  function removeTask(id) {
    tasks = tasks.filter(function (t) { return t.id !== id; });
    commit();
    toast("Task deleted.", "warn");
  }
  function find(id) { for (var i = 0; i < tasks.length; i++) if (tasks[i].id === id) return tasks[i]; return null; }

  function commit() { save(); render(); scheduleReminders(); }

  /* ---------------- Composer ---------------- */
  var composer = document.getElementById("composer");
  var titleInput = document.getElementById("taskTitle");
  var typeSel = document.getElementById("taskType");
  var weekdayField = document.getElementById("weekdayField");
  var dueDateField = document.getElementById("dueDateField");
  var editingId = null;

  function openComposer() { composer.classList.add("open"); }
  function closeComposer() { composer.classList.remove("open"); }
  function setSubmitLabels(txt) {
    composer.querySelectorAll('button[type="submit"]').forEach(function (b) { b.textContent = txt; });
  }

  document.getElementById("composerToggle").addEventListener("click", function () {
    composer.classList.toggle("open");
  });
  document.getElementById("composerCancel").addEventListener("click", function () {
    resetComposer(); closeComposer();
  });
  titleInput.addEventListener("focus", openComposer);

  typeSel.addEventListener("change", function () {
    var v = typeSel.value;
    weekdayField.classList.toggle("show", v === "weekly");
    dueDateField.style.display = (v === "oneoff") ? "" : "none";
  });

  function resetComposer() {
    editingId = null;
    composer.reset();
    typeSel.value = "oneoff";
    weekdayField.classList.remove("show");
    dueDateField.style.display = "";
    setSubmitLabels("Add task");
  }

  function editTask(id) {
    var t = find(id); if (!t) return;
    editingId = id;
    openComposer();
    titleInput.value = t.title;
    typeSel.value = t.type;
    document.getElementById("taskWeekday").value = String(t.weekday == null ? 1 : t.weekday);
    document.getElementById("taskDate").value = t.date || "";
    document.getElementById("taskTime").value = t.time || "";
    document.getElementById("taskPriority").value = t.priority || "medium";
    document.getElementById("taskAssignee").value = t.assignee || "";
    document.getElementById("taskNotes").value = t.notes || "";
    weekdayField.classList.toggle("show", t.type === "weekly");
    dueDateField.style.display = (t.type === "oneoff") ? "" : "none";
    setSubmitLabels("Save changes");
    window.scrollTo({ top: 0, behavior: "smooth" });
    titleInput.focus();
  }

  composer.addEventListener("submit", function (e) {
    e.preventDefault();
    var title = titleInput.value.trim();
    if (!title) { titleInput.focus(); return; }

    var type = typeSel.value;
    var data = {
      title: title,
      notes: document.getElementById("taskNotes").value.trim(),
      type: type,
      weekday: type === "weekly" ? +document.getElementById("taskWeekday").value : undefined,
      date: type === "oneoff" ? (document.getElementById("taskDate").value || todayStr()) : undefined,
      time: document.getElementById("taskTime").value || "",
      priority: document.getElementById("taskPriority").value,
      assignee: document.getElementById("taskAssignee").value.trim()
    };

    if (editingId) {
      var t = find(editingId);
      for (var k in data) t[k] = data[k];
      toast("Task updated.", "ok");
    } else {
      data.id = uid();
      data.completed = false;
      data.lastCompleted = "";
      data.createdAt = Date.now();
      tasks.push(data);
      toast(isRecurring(data) ? "Recurring task added — it’ll reset each " + (type === "daily" ? "day." : "week.") : "Task added.", "ok");
    }
    resetComposer();
    closeComposer();
    commit();
  });

  /* ---------------- Google Calendar ---------------- */
  function gcalStamp(dateStr, time, allDay) {
    var p = (time || "09:00").split(":");
    var d = parseDate(dateStr);
    d.setHours(+p[0] || 0, +p[1] || 0, 0, 0);
    if (allDay) {
      return dateStr.replace(/-/g, "");
    }
    // UTC basic format
    function u(n) { return n < 10 ? "0" + n : "" + n; }
    return d.getUTCFullYear() + u(d.getUTCMonth() + 1) + u(d.getUTCDate()) + "T" +
      u(d.getUTCHours()) + u(d.getUTCMinutes()) + "00Z";
  }

  function gcalUrl(t) {
    var base = "https://calendar.google.com/calendar/render?action=TEMPLATE";
    var dateStr = t.type === "oneoff" ? (t.date || todayStr()) : todayStr();
    var dates;
    if (t.time) {
      var start = gcalStamp(dateStr, t.time, false);
      // +30 min end
      var p = t.time.split(":"); var d = parseDate(dateStr);
      d.setHours(+p[0] || 0, (+p[1] || 0) + 30, 0, 0);
      function u(n) { return n < 10 ? "0" + n : "" + n; }
      var end = d.getUTCFullYear() + u(d.getUTCMonth() + 1) + u(d.getUTCDate()) + "T" + u(d.getUTCHours()) + u(d.getUTCMinutes()) + "00Z";
      dates = start + "/" + end;
    } else {
      var dayStamp = dateStr.replace(/-/g, "");
      var next = parseDate(dateStr); next.setDate(next.getDate() + 1);
      var nextStamp = next.getFullYear() + pad(next.getMonth() + 1) + pad(next.getDate());
      dates = dayStamp + "/" + nextStamp;
    }
    var params = "&text=" + encodeURIComponent(t.title) + "&dates=" + dates;
    var details = (t.notes ? t.notes + "\n\n" : "") + "Reminder from Beacon Tasks" + (t.assignee ? " · shared with " + t.assignee : "");
    params += "&details=" + encodeURIComponent(details);
    if (t.type === "daily") params += "&recur=" + encodeURIComponent("RRULE:FREQ=DAILY");
    else if (t.type === "weekly") params += "&recur=" + encodeURIComponent("RRULE:FREQ=WEEKLY;BYDAY=" + GCAL_BYDAY[t.weekday == null ? 1 : +t.weekday]);
    return base + params;
  }

  /* ---------------- Email ---------------- */
  function mailtoUrl(t) {
    var to = isEmail(t.assignee) ? t.assignee.trim() : "";
    var di = dueInfo(t);
    var lines = [
      t.notes || "",
      "",
      "When: " + (di ? di.label : (t.type === "daily" ? "Every day" : t.type === "weekly" ? "Every " + WEEKDAYS[t.weekday == null ? 1 : +t.weekday] : "No date set")),
      "Priority: " + (t.priority || "medium"),
      t.assignee ? "Shared with: " + t.assignee : "",
      "",
      "Add to your calendar: " + gcalUrl(t),
      "",
      "— Sent from Beacon Tasks"
    ];
    return "mailto:" + encodeURIComponent(to) +
      "?subject=" + encodeURIComponent("Task reminder: " + t.title) +
      "&body=" + encodeURIComponent(lines.filter(function (l) { return l !== undefined; }).join("\n"));
  }

  /* ---------------- Reminders ---------------- */
  var bell = document.getElementById("bell");

  function refreshBell() {
    var granted = ("Notification" in window) && Notification.permission === "granted" && settings.notify;
    bell.classList.toggle("on", granted);
    bell.setAttribute("aria-pressed", String(granted));
    bell.querySelector(".lbl").textContent = granted ? "Reminders on" : "Reminders off";
  }

  bell.addEventListener("click", function () {
    if (!("Notification" in window)) {
      toast("This browser doesn’t support desktop notifications. In-app reminders still work.", "warn");
      return;
    }
    if (Notification.permission === "granted") {
      settings.notify = !settings.notify; saveSettings(); refreshBell();
      toast(settings.notify ? "Desktop reminders enabled." : "Desktop reminders muted.", settings.notify ? "ok" : "warn");
      scheduleReminders();
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(function (perm) {
        settings.notify = perm === "granted"; saveSettings(); refreshBell();
        if (perm === "granted") { toast("Desktop reminders enabled — you’ll be notified when tasks are due.", "ok"); scheduleReminders(); }
        else toast("Notifications blocked. You’ll still see in-app reminders.", "warn");
      });
    } else {
      toast("Notifications are blocked in your browser settings. In-app reminders still work.", "warn");
    }
  });

  function clearTimers() { reminderTimers.forEach(clearTimeout); reminderTimers = []; }

  function scheduleReminders() {
    clearTimers();
    var now = Date.now();
    tasks.forEach(function (t) {
      if (isDone(t)) return;
      var di = dueInfo(t);
      if (!di) return;
      var delay = di.ts - now;
      // schedule notifications for things due within the next 12h
      if (delay > 0 && delay <= 12 * 60 * 60 * 1000) {
        reminderTimers.push(setTimeout(function () { fireReminder(t); }, delay));
      }
    });
  }

  var notifiedOverdue = {};
  function fireReminder(t) {
    if (isDone(t)) return;
    var body = (t.notes ? t.notes + " · " : "") + (t.priority === "high" ? "High priority" : "Due now");
    if (("Notification" in window) && Notification.permission === "granted" && settings.notify) {
      try { new Notification("⏰ " + t.title, { body: body, tag: t.id }); } catch (e) {}
    }
    toast("⏰ <strong>" + escapeHtml(t.title) + "</strong> is due now.", "warn");
  }

  // Periodic re-check: refresh chips, catch overdue tasks, re-render across day boundaries.
  function tick() {
    render();
    var now = Date.now();
    tasks.forEach(function (t) {
      if (isDone(t)) return;
      var di = dueInfo(t);
      if (di && di.state === "overdue" && !notifiedOverdue[t.id]) {
        // only nudge once per session per task, and only if it just crossed
        if (now - di.ts < 90 * 1000) { notifiedOverdue[t.id] = true; fireReminder(t); }
      }
    });
  }
  setInterval(tick, 60 * 1000);

  function escapeHtml(s) { return (s || "").replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }

  /* ---------------- Toasts ---------------- */
  var toastWrap = document.getElementById("toasts");
  function toast(html, kind) {
    var el = document.createElement("div");
    el.className = "toast " + (kind || "");
    el.innerHTML = '<span class="t-ico">' + (kind === "ok" ? "✓" : kind === "warn" ? "!" : "i") + '</span><span>' + html + "</span>";
    toastWrap.appendChild(el);
    setTimeout(function () { el.style.opacity = "0"; el.style.transition = "opacity .4s"; setTimeout(function () { el.remove(); }, 400); }, 5200);
  }

  /* ---------------- Sidebar / toolbar wiring ---------------- */
  document.querySelectorAll(".side-link").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll(".side-link").forEach(function (x) { x.classList.remove("active"); });
      b.classList.add("active");
      view = b.dataset.view;
      render();
    });
  });
  document.querySelectorAll(".seg button").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll(".seg button").forEach(function (x) { x.classList.remove("active"); });
      b.classList.add("active");
      sort = b.dataset.sort;
      render();
    });
  });
  document.getElementById("search").addEventListener("input", function (e) { query = e.target.value; render(); });

  /* ---------------- Sharing ---------------- */
  var shareModal = document.getElementById("shareModal");
  var shareListEl = document.getElementById("shareList");
  var shareUrlEl = document.getElementById("shareUrl");

  function buildShareList() {
    shareListEl.innerHTML = "";
    var open = tasks.filter(function (t) { return !isDone(t); });
    if (!open.length) { shareListEl.innerHTML = '<div class="share-item">No open tasks to share.</div>'; return; }
    open.forEach(function (t) {
      var row = document.createElement("label");
      row.className = "share-item";
      var cb = document.createElement("input");
      cb.type = "checkbox"; cb.value = t.id; cb.checked = !!(t.assignee && t.assignee.trim());
      cb.addEventListener("change", updateShareUrl);
      var title = document.createElement("span");
      title.className = "s-title"; title.textContent = t.title;
      var meta = document.createElement("span");
      meta.className = "s-meta"; meta.textContent = t.type === "oneoff" ? "One-off" : t.type === "daily" ? "Daily" : "Weekly";
      row.appendChild(cb); row.appendChild(title); row.appendChild(meta);
      shareListEl.appendChild(row);
    });
    updateShareUrl();
  }

  function selectedShareTasks() {
    var ids = {};
    shareListEl.querySelectorAll('input[type="checkbox"]:checked').forEach(function (cb) { ids[cb.value] = true; });
    return tasks.filter(function (t) { return ids[t.id]; });
  }

  function updateShareUrl() {
    var sel = selectedShareTasks();
    if (!sel.length) { shareUrlEl.value = ""; return; }
    var payload = sel.map(function (t) {
      return { title: t.title, notes: t.notes || "", type: t.type, weekday: t.weekday, date: t.date, time: t.time || "", priority: t.priority || "medium", assignee: t.assignee || "" };
    });
    var data = b64encode(JSON.stringify(payload));
    var url = location.href.split("#")[0] + "#import=" + data;
    shareUrlEl.value = url;
  }

  document.getElementById("openShare").addEventListener("click", function () { buildShareList(); shareModal.classList.add("open"); });
  document.getElementById("closeShare").addEventListener("click", function () { shareModal.classList.remove("open"); });
  shareModal.addEventListener("click", function (e) { if (e.target === shareModal) shareModal.classList.remove("open"); });

  document.getElementById("copyShare").addEventListener("click", function () {
    if (!shareUrlEl.value) { toast("Select at least one task to share.", "warn"); return; }
    shareUrlEl.select();
    var ok = false;
    if (navigator.clipboard) { navigator.clipboard.writeText(shareUrlEl.value).then(function () { toast("Share link copied — send it to your team.", "ok"); }); ok = true; }
    if (!ok) { try { document.execCommand("copy"); toast("Share link copied.", "ok"); } catch (e) { toast("Copy the highlighted link.", "warn"); } }
  });

  document.getElementById("emailShare").addEventListener("click", function () {
    var sel = selectedShareTasks();
    if (!sel.length) { toast("Select at least one task to email.", "warn"); return; }
    var emails = sel.map(function (t) { return t.assignee; }).filter(isEmail);
    var body = "I'm sharing these tasks with you via Beacon Tasks:\n\n" +
      sel.map(function (t, i) {
        var di = dueInfo(t);
        return (i + 1) + ". " + t.title + (di ? " — " + di.label : "") + (t.assignee ? " (" + t.assignee + ")" : "");
      }).join("\n") +
      "\n\nImport them in one click:\n" + shareUrlEl.value +
      "\n\n— Sent from Beacon Tasks";
    window.location.href = "mailto:" + encodeURIComponent(emails.join(",")) +
      "?subject=" + encodeURIComponent("Shared tasks from Beacon (" + sel.length + ")") +
      "&body=" + encodeURIComponent(body);
  });

  // Import from a shared link (#import=...)
  function checkImport() {
    var m = location.hash.match(/#import=(.+)$/);
    if (!m) return;
    var incoming;
    try { incoming = JSON.parse(b64decode(m[1])); } catch (e) { return; }
    if (!Array.isArray(incoming) || !incoming.length) return;
    // Clear the hash so a refresh doesn't re-import
    history.replaceState(null, "", location.pathname);
    incoming.forEach(function (t) {
      tasks.push({
        id: uid(), title: t.title || "Untitled", notes: t.notes || "",
        type: t.type || "oneoff", weekday: t.weekday, date: t.date, time: t.time || "",
        priority: t.priority || "medium", assignee: t.assignee || "",
        completed: false, lastCompleted: "", createdAt: Date.now()
      });
    });
    save();
    toast("Imported <strong>" + incoming.length + "</strong> shared task" + (incoming.length > 1 ? "s" : "") + " into your list.", "ok");
  }

  /* ---------------- Init ---------------- */
  checkImport();
  refreshBell();
  // Re-enable scheduling if the user previously granted notifications
  if (("Notification" in window) && Notification.permission !== "granted") settings.notify = false;
  render();
  scheduleReminders();
  save(); // persist seed on first run
})();
