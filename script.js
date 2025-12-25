// ====== GLOBAL DATA ======
const MAX_HOURS_DEFAULT = 8;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

let setupData = JSON.parse(localStorage.getItem("setupData")) || null;
let attendanceRecords = JSON.parse(localStorage.getItem("attendanceRecords")) || {};

// ====== PAGE SWITCH ======
function showPage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");

  if (id === "daily") initDailyPage();
  if (id === "dashboard") loadDashboard();
}

// ====== TIMETABLE GRID (SETUP) ======
function buildTimetableGrid() {
  const hoursPerDay = Number(document.getElementById("hoursPerDay").value) || MAX_HOURS_DEFAULT;

  const gridDiv = document.getElementById("timetableGrid");
  gridDiv.innerHTML = "";

  const table = document.createElement("table");
  table.className = "tt-table";

  // Header
  const thead = document.createElement("thead");
  const hRow = document.createElement("tr");

  let thDay = document.createElement("th");
  thDay.innerText = "Day / Hour";
  hRow.appendChild(thDay);

  for (let h = 1; h <= hoursPerDay; h++) {
    const th = document.createElement("th");
    th.innerText = "Hour " + h;
    hRow.appendChild(th);
  }
  thead.appendChild(hRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  // Row per day
  DAYS.forEach((dayName, dayIndex) => {
    const tr = document.createElement("tr");

    const dayCell = document.createElement("td");
    dayCell.innerText = dayName;
    dayCell.className = "tt-day-label";
    tr.appendChild(dayCell);

    for (let h = 1; h <= hoursPerDay; h++) {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.type = "text";
      input.className = "tt-cell-input";
      input.placeholder = "Subject";

      input.dataset.dayIndex = dayIndex;
      input.dataset.hourIndex = h - 1;

      // load old value if exists
      if (setupData && setupData.timetable &&
          setupData.timetable[dayIndex] &&
          setupData.timetable[dayIndex][h - 1]) {
        input.value = setupData.timetable[dayIndex][h - 1];
      }

      td.appendChild(input);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  gridDiv.appendChild(table);
}

function saveSetup() {
  const student = document.getElementById("studentName").value.trim();
  const start = document.getElementById("startDate").value;
  const end = document.getElementById("endDate").value;
  const hoursPerDay = Number(document.getElementById("hoursPerDay").value) || MAX_HOURS_DEFAULT;

  if (!student || !start || !end) {
    alert("Please fill student name and semester dates.");
    return;
  }

  // Build timetable array: [day][hour] = subject or ""
  let timetable = [];
  for (let d = 0; d < DAYS.length; d++) {
    timetable[d] = [];
  }

  document.querySelectorAll(".tt-cell-input").forEach(inp => {
    const d = Number(inp.dataset.dayIndex);
    const h = Number(inp.dataset.hourIndex);
    timetable[d][h] = inp.value.trim();
  });

  setupData = {
    student,
    start,
    end,
    hoursPerDay,
    timetable
  };

  localStorage.setItem("setupData", JSON.stringify(setupData));
  alert("Setup saved / updated!");
}

// ====== DAILY ATTENDANCE ======
function initDailyPage() {
  if (!setupData) {
    alert("Please complete Setup first.");
    showPage("setup");
    return;
  }

  populateMonthOptions();

  const today = new Date().toISOString().split("T")[0];
  document.getElementById("attendanceDate").value = today;
  onDateChange();
}

function populateMonthOptions() {
  const select = document.getElementById("monthSelect");
  select.innerHTML = '<option value="">Select Month</option>';

  const start = new Date(setupData.start);
  const end = new Date(setupData.end);

  let cur = new Date(start);
  const monthsAdded = new Set();

  while (cur <= end) {
    const key = cur.toISOString().slice(0, 7); // YYYY-MM
    if (!monthsAdded.has(key)) {
      monthsAdded.add(key);
      const label = cur.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
      const opt = new Option(label, key);
      select.appendChild(opt);
    }
    cur.setMonth(cur.getMonth() + 1);
  }
}

function onMonthChange() {
  const monthKey = document.getElementById("monthSelect").value; // YYYY-MM
  if (!monthKey) return;
  // set date to first day of that month within sem
  const [y, m] = monthKey.split("-");
  let date = new Date(Number(y), Number(m) - 1, 1);
  // clamp inside sem range
  const semStart = new Date(setupData.start);
  const semEnd = new Date(setupData.end);
  if (date < semStart) date = semStart;
  if (date > semEnd) date = semStart;

  const iso = date.toISOString().split("T")[0];
  document.getElementById("attendanceDate").value = iso;
  onDateChange();
}

function onDateChange() {
  const dateStr = document.getElementById("attendanceDate").value;
  if (!dateStr || !setupData) return;

  const dateObj = new Date(dateStr);
  const dow = dateObj.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  let dayIndex = -1;

  if (dow >= 1 && dow <= 6) {
    dayIndex = dow - 1; // Mon=0..Sat=5
  } else {
    // Sunday -> no class
    document.getElementById("attendanceContainer").innerHTML =
      "<p>No classes on Sunday.</p>";
    document.getElementById("selectedDayInfo").innerText =
      dateStr + " (Sun) - Holiday";
    return;
  }

  const dayName = DAYS[dayIndex];
  document.getElementById("selectedDayInfo").innerText =
    `${dateStr} (${dayName})`;

  renderDayAttendance(dateStr, dayIndex);
}

function renderDayAttendance(dateStr, dayIndex) {
  const container = document.getElementById("attendanceContainer");
  container.innerHTML = "";

  const subjectsRow = setupData.timetable[dayIndex] || [];
  const hoursPerDay = setupData.hoursPerDay || MAX_HOURS_DEFAULT;

  for (let h = 0; h < hoursPerDay; h++) {
    const subject = subjectsRow[h] || "";
    if (!subject) continue; // no class that hour

    const box = document.createElement("div");
    box.className = "subject-box";

    const label = document.createElement("label");
    label.innerText = `${subject} - Hour ${h + 1}`;
    box.appendChild(label);

    const span = document.createElement("label");
    span.className = "attendance-hour";

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.id = `chk-${dateStr}-${dayIndex}-${h}`;

    // load old value if exists
    if (
      attendanceRecords[dateStr] &&
      attendanceRecords[dateStr][subject] &&
      attendanceRecords[dateStr][subject][h] === "Absent"
    ) {
      chk.checked = true;
    }

    span.appendChild(chk);
    span.appendChild(document.createTextNode("Hour " + (h + 1) + " Absent"));
    box.appendChild(span);

    container.appendChild(box);
  }

  if (!container.innerHTML) {
    container.innerHTML = "<p>No classes scheduled for this day.</p>";
  }
}

function saveTodayAttendance() {
  if (!setupData) return;

  const dateStr = document.getElementById("attendanceDate").value;
  if (!dateStr) {
    alert("Select a date.");
    return;
  }

  if (!attendanceRecords[dateStr]) attendanceRecords[dateStr] = {};

  const dateObj = new Date(dateStr);
  const dow = dateObj.getDay();
  if (dow === 0) {
    alert("No classes on Sunday.");
    return;
  }
  const dayIndex = dow - 1;
  const subjectsRow = setupData.timetable[dayIndex] || [];
  const hoursPerDay = setupData.hoursPerDay || MAX_HOURS_DEFAULT;

  for (let h = 0; h < hoursPerDay; h++) {
    const subject = subjectsRow[h] || "";
    if (!subject) continue;

    if (!attendanceRecords[dateStr][subject]) {
      attendanceRecords[dateStr][subject] = [];
    }

    const chkId = `chk-${dateStr}-${dayIndex}-${h}`;
    const chk = document.getElementById(chkId);
    const absent = chk && chk.checked;

    attendanceRecords[dateStr][subject][h] = absent ? "Absent" : "Present";
  }

  localStorage.setItem("attendanceRecords", JSON.stringify(attendanceRecords));
  alert("Attendance saved for " + dateStr);
}

// ====== DASHBOARD ======
function loadDashboard() {
  if (!setupData) {
    showPage("setup");
    return;
  }

  const container = document.getElementById("dashboardData");
  container.innerHTML = `<h3>${setupData.student}</h3>`;

  const start = new Date(setupData.start);
  const end = new Date(setupData.end);
  const hoursPerDay = setupData.hoursPerDay || MAX_HOURS_DEFAULT;

  // collect all subjects from timetable
  const subjectSet = new Set();
  setupData.timetable.forEach(row => {
    row.forEach(sub => {
      if (sub && sub.trim()) subjectSet.add(sub.trim());
    });
  });
  const allSubjects = Array.from(subjectSet);

  // compute totals
  const totalClasses = {};
  const absentClasses = {};
  const absentDates = {};

  allSubjects.forEach(s => {
    totalClasses[s] = 0;
    absentClasses[s] = 0;
    absentDates[s] = [];
  });

  // loop every day in sem
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().split("T")[0];
    const dow = d.getDay();
    if (dow === 0) continue; // Sunday

    const dayIndex = dow - 1;
    const row = setupData.timetable[dayIndex] || [];

    for (let h = 0; h < hoursPerDay; h++) {
      const subject = (row[h] || "").trim();
      if (!subject) continue;

      totalClasses[subject]++;

      const record = attendanceRecords[iso] &&
                     attendanceRecords[iso][subject] &&
                     attendanceRecords[iso][subject][h];

      if (record === "Absent") {
        absentClasses[subject]++;
        absentDates[subject].push(iso.slice(5)); // MM-DD
      }
      // if there is no record, auto-present (do nothing, counted in total only)
    }
  }

  // render cards
  allSubjects.forEach(subject => {
    const total = totalClasses[subject];
    const absent = absentClasses[subject];
    const present = total - absent;
    const percent = total ? ((present / total) * 100).toFixed(1) : 100;

    const zone =
      percent >= 75 ? "safe" :
      percent >= 65 ? "risk" : "danger";

    const div = document.createElement("div");
    div.className = "subject-box";
    div.innerHTML = `
      <strong>${subject}</strong>: ${percent}% 
      <span class="${zone}">${zone.toUpperCase()}</span>
      <div class="absent-logs">
        Absent classes: ${absent} / ${total}<br>
        Dates: ${
          absentDates[subject].length
            ? absentDates[subject].slice(0, 6).join(", ") +
              (absentDates[subject].length > 6
                ? " +" + (absentDates[subject].length - 6) + " more"
                : "")
            : "None"
        }
      </div>
    `;
    container.appendChild(div);
  });
}

// ====== INITIAL LOAD ======
window.onload = () => {
  if (setupData) {
    document.getElementById("studentName").value = setupData.student || "";
    document.getElementById("startDate").value = setupData.start || "";
    document.getElementById("endDate").value = setupData.end || "";
    document.getElementById("hoursPerDay").value =
      setupData.hoursPerDay || MAX_HOURS_DEFAULT;
  }
  buildTimetableGrid();
  showPage("setup");
};