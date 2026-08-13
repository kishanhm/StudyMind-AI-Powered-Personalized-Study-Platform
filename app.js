import { auth, db, model } from "./firebase.js";
import {
    saveProfile,
    loadProfile,
    saveTasks,
    loadTasks
} from "./database.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

console.log("Firebase Connected");
console.log(auth);



async function logout() {
    await signOut(auth);
    window.location.href = "login.html";
}

window.logout = logout;

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  profile: { wake: 7, type: 'morning', focus: 45, goal: 4 },
  energyCurve: [],
  tasks: [],
  schedule: [],
  completedCount: 0,
  streak: 3,
  profileBuilt: false
};
 
const TASK_COLORS = ['#2de090','#f5b800','#5b8cf5','#a56cff','#ff5c5c','#ff9f45','#45d4ff'];
 
// ─── Utilities ────────────────────────────────────────────────────────────────
function scrollToSection(id) {
  document.querySelector(id)?.scrollIntoView({ behavior: 'smooth' });
}
 
function fmtTime(h) {
  const ampm = h < 12 ? 'AM' : 'PM';
  const hh = h % 12 || 12;
  return `${hh}:00 ${ampm}`;
}
 
function todayStr() {
  return new Date().toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' });
}
 
// FIX: Get today's date in LOCAL timezone as YYYY-MM-DD (avoids UTC offset bug)
function getTodayLocalISO() {
  const d = new Date();
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day   = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
 
// ─── Onboarding Picks ─────────────────────────────────────────────────────────
function pick(btn, key) {
  const group = btn.closest('.oc-options');
  group.querySelectorAll('.oc-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.profile[key] = btn.dataset.val;
}
 
function updateGoal(v) {
  document.getElementById('goal-val').textContent = v;
  state.profile.goal = parseFloat(v);
}
 
// ─── Segmented Controls ───────────────────────────────────────────────────────
document.querySelectorAll('.seg-ctrl').forEach(ctrl => {
  ctrl.querySelectorAll('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      ctrl.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
});
 
// ─── Energy Curve Generation ──────────────────────────────────────────────────
function generateEnergyCurve(profile) {
  const wake = parseInt(profile.wake);
  const type = profile.type;
  const curve = [];
 
  for (let h = 6; h <= 23; h++) {
    let e = 0;
    const hoursAwake = h - wake;
 
    if (hoursAwake < 0) { curve.push({ hour: h, energy: 5, label: 'Asleep' }); continue; }
 
    if (type === 'morning') {
      if (hoursAwake <= 1) e = 55 + hoursAwake * 20;
      else if (hoursAwake <= 3) e = 90 - (hoursAwake - 1) * 5;
      else if (hoursAwake <= 5) e = 80;
      else if (hoursAwake <= 7) e = 80 - (hoursAwake - 5) * 15;
      else if (hoursAwake <= 9) e = 50 - (hoursAwake - 7) * 8;
      else if (hoursAwake <= 12) e = 34 + (hoursAwake - 9) * 5;
      else e = Math.max(10, 49 - (hoursAwake - 12) * 12);
    } else if (type === 'evening') {
      if (hoursAwake <= 2) e = 30 + hoursAwake * 10;
      else if (hoursAwake <= 4) e = 50;
      else if (hoursAwake <= 6) e = 50 - (hoursAwake - 4) * 10;
      else if (hoursAwake <= 8) e = 30;
      else if (hoursAwake <= 11) e = 30 + (hoursAwake - 8) * 20;
      else if (hoursAwake <= 13) e = 90;
      else e = Math.max(15, 90 - (hoursAwake - 13) * 20);
    } else {
      if (hoursAwake <= 2) e = 55 + hoursAwake * 15;
      else if (hoursAwake <= 5) e = 80 - (hoursAwake - 2) * 5;
      else if (hoursAwake <= 7) e = 65 - (hoursAwake - 5) * 15;
      else if (hoursAwake <= 9) e = 35 + (hoursAwake - 7) * 15;
      else if (hoursAwake <= 11) e = 65;
      else e = Math.max(10, 65 - (hoursAwake - 11) * 15);
    }
 
    e = Math.max(5, Math.min(100, e + (Math.random() * 8 - 4)));
    const label = e >= 70 ? 'Peak Focus' : e >= 45 ? 'Moderate' : 'Low Energy';
    curve.push({ hour: h, energy: Math.round(e), label });
  }
 
  return curve;
}
 
// ─── A* Scheduling Algorithm ──────────────────────────────────────────────────
class MinHeap {
  constructor(compareFn) {
    this.heap = [];
    this.compare = compareFn;
  }
  push(item) {
    this.heap.push(item);
    this._bubbleUp(this.heap.length - 1);
  }
  pop() {
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return top;
  }
  get size() { return this.heap.length; }
  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(this.heap[i], this.heap[parent]) < 0) {
        [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
        i = parent;
      } else break;
    }
  }
  _sinkDown(i) {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.compare(this.heap[l], this.heap[smallest]) < 0) smallest = l;
      if (r < n && this.compare(this.heap[r], this.heap[smallest]) < 0) smallest = r;
      if (smallest !== i) {
        [this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
        i = smallest;
      } else break;
    }
  }
}
 
function slotCost(task, slotEnergy, slotHour) {
  const difficultyWeight = { easy: 0.3, medium: 0.6, hard: 1.0 }[task.difficulty] || 0.6;
  const priorityWeight   = { normal: 1.0, high: 1.5, critical: 2.0 }[task.priority] || 1.0;
  const idealEnergy = task.difficulty === 'easy' ? 35 : task.difficulty === 'medium' ? 60 : 85;
  const mismatch = Math.abs(idealEnergy - slotEnergy) / 100;
  const urgencyPenalty = task.priority === 'critical' ? slotHour / 23 * 0.3 : 0;
  const wastePenalty = (task.difficulty === 'easy' && slotEnergy >= 70) ? 0.25 : 0;
  return (mismatch * difficultyWeight + urgencyPenalty + wastePenalty) * priorityWeight;
}
 
function heuristic(tasks, availableSlots) {
  let h = 0;
  for (const task of tasks) {
    if (!availableSlots.length) { h += 1; continue; }
    const best = Math.min(...availableSlots.map(s => slotCost(task, s.energy, s.hour)));
    h += best;
  }
  return h;
}
 
function aStarSchedule(tasks, curve) {
  if (!tasks.length) return [];
  const slots = curve.filter(c => c.energy > 5);
  const initialState = {
    assignments: [],
    takenSlotIndices: new Set(),
    taskIndex: 0,
    g: 0,
    f: 0
  };
  const openSet = new MinHeap((a, b) => a.f - b.f);
  const remainingTasks = tasks.slice();
  const h0 = heuristic(remainingTasks, slots);
  initialState.f = h0;
  openSet.push(initialState);
  let bestResult = null;
  let bestCost = Infinity;
  const maxIter = 2000;
  let iter = 0;
 
  while (openSet.size > 0 && iter++ < maxIter) {
    const current = openSet.pop();
    if (current.taskIndex === tasks.length) {
      if (current.g < bestCost) {
        bestCost = current.g;
        bestResult = current.assignments;
      }
      continue;
    }
    const task = tasks[current.taskIndex];
    for (let si = 0; si < slots.length; si++) {
      const usageCount = [...current.takenSlotIndices].filter(i => i === si).length;
      if (usageCount >= 2) continue;
      const slot = slots[si];
      const cost = slotCost(task, slot.energy, slot.hour);
      const newG = current.g + cost;
      if (newG >= bestCost) continue;
      const newTaken = new Set(current.takenSlotIndices);
      newTaken.add(si);
      const remainingForH = tasks.slice(current.taskIndex + 1);
      const remainingSlots = slots.filter((_, i) => {
        const cnt = [...newTaken].filter(x => x === i).length;
        return cnt < 2;
      });
      const h = heuristic(remainingForH, remainingSlots);
      const newState = {
        assignments: [...current.assignments, { task, slot }],
        takenSlotIndices: newTaken,
        taskIndex: current.taskIndex + 1,
        g: newG,
        f: newG + h
      };
      openSet.push(newState);
    }
  }
 
  if (!bestResult) {
    bestResult = greedyFallback(tasks, slots);
  }
  return bestResult;
}
 
function greedyFallback(tasks, slots) {
  const sorted = [...tasks].sort((a, b) => {
    const dw = { easy: 1, medium: 2, hard: 3 };
    return dw[b.difficulty] - dw[a.difficulty];
  });
  const taken = new Map();
  return sorted.map(task => {
    let best = null, bestC = Infinity;
    slots.forEach((slot, si) => {
      if ((taken.get(si) || 0) >= 2) return;
      const c = slotCost(task, slot.energy, slot.hour);
      if (c < bestC) { bestC = c; best = { task, slot, si }; }
    });
    if (best) taken.set(best.si, (taken.get(best.si) || 0) + 1);
    return best ? { task: best.task, slot: best.slot } : { task, slot: slots[0] };
  });
}
 
// ─── Render Energy Chart ──────────────────────────────────────────────────────
function renderEnergyChart(curve) {
  const chart = document.getElementById('energy-chart');
  const xlabels = document.getElementById('chart-xlabels');
  const maxE = Math.max(...curve.map(c => c.energy));
 
  chart.innerHTML = curve.map(c => {
    const pct = (c.energy / maxE) * 100;
    const color = c.energy >= 70 ? 'var(--green)' : c.energy >= 45 ? 'var(--amber)' : 'var(--red)';
    const opacity = c.energy >= 70 ? 1 : c.energy >= 45 ? 0.8 : 0.6;
    return `<div class="e-bar" style="height:0;background:${color};opacity:${opacity}" 
      data-h="${pct}" data-tip="${fmtTime(c.hour)}: ${c.energy}% — ${c.label}"></div>`;
  }).join('');
 
  xlabels.innerHTML = curve.map((c, i) =>
    `<div class="x-label">${i % 3 === 0 ? fmtTime(c.hour).replace(':00','') : ''}</div>`
  ).join('');
 
  setTimeout(() => {
    chart.querySelectorAll('.e-bar').forEach(bar => {
      bar.style.height = bar.dataset.h + '%';
    });
  }, 100);
}
 
// ─── Render Profile Stats ─────────────────────────────────────────────────────
function renderProfileStats(curve, profile) {
  const peakHours = curve.filter(c => c.energy >= 70).map(c => c.hour);
  const lowHours  = curve.filter(c => c.energy < 40).map(c => c.hour);
 
  const peakStr = peakHours.length
    ? `${fmtTime(Math.min(...peakHours))} – ${fmtTime(Math.max(...peakHours))}`
    : 'Limited peaks detected';
  const avoidStr = lowHours.length
    ? `${fmtTime(Math.min(...lowHours))} – ${fmtTime(Math.max(...lowHours))}`
    : 'None significant';
  const focusMins = parseInt(profile.focus);
  const sessionsPerDay = Math.round((parseFloat(profile.goal) * 60) / (focusMins + 15));
 
  document.getElementById('peak-window').textContent = peakStr;
  document.getElementById('avoid-window').textContent = avoidStr;
  document.getElementById('opt-block').textContent = `${focusMins} min + ${Math.round(focusMins * 0.3)} min break`;
  document.getElementById('rec-sessions').textContent = `${sessionsPerDay} sessions / day`;
}
 
// ─── Build Profile ────────────────────────────────────────────────────────────
function buildProfile() {
  const curve = generateEnergyCurve(state.profile);
  state.energyCurve = curve;
  state.profileBuilt = true;
  const user = auth.currentUser;

  if (user) {
      saveProfile(user.uid, state.profile)
          .then(() => console.log("Profile Saved"))
          .catch(err => console.error(err));
  }
 
  const profileSection = document.getElementById('profile');
  profileSection.style.display = 'block';
  renderEnergyChart(curve);
  renderProfileStats(curve, state.profile);
  renderHourlyChart(curve);
  updateAccuracyMeter(72);
 
  document.getElementById('ns-score').textContent =
    Math.round(curve.reduce((a, c) => a + c.energy, 0) / curve.length) + '%';
  document.getElementById('ns-streak').textContent = state.streak;
 
  profileSection.scrollIntoView({ behavior: 'smooth' });
 
  if (state.tasks.length) {
    rebuildScheduleWithAStar();
  }
}
 
function goToPlanner() {
  scrollTo('#planner');
}
 
// ─── Task / Schedule Logic ────────────────────────────────────────────────────
function getSelectedVal(ctrlId) {
  const btn = document.querySelector(`#${ctrlId} .seg-btn.active`);
  return btn ? btn.dataset.val : null;
}

// ======================= FIRESTORE TASK SYNC =======================

async function loadUserTasks() {

    const user = auth.currentUser;

    if (!user) return;

    try {

        const tasks = await loadTasks(user.uid);

        state.tasks = tasks || [];

        state.completedCount = state.tasks.filter(task => task.done).length;

        console.log("Tasks loaded:", state.tasks);

        if (state.tasks.length) {
            rebuildScheduleWithAStar();
            updateDonut();
            updateTaskCount();
        }

    } catch (error) {

        console.error("Failed to load tasks:", error);

    }
}
 
function addTask() {
  const nameEl = document.getElementById('task-name');
  const name = nameEl.value.trim();
  if (!name) { nameEl.focus(); return; }
 
  const difficulty = getSelectedVal('diff-ctrl') || 'medium';
  const priority   = getSelectedVal('pri-ctrl')  || 'normal';
 
  // FIX: Always read hours from the slider element directly
  const hoursSlider = document.getElementById('hours-slider');
  const hours = parseFloat(hoursSlider.value);
 
  // FIX: Read deadline; fall back to today if empty
  const deadlineEl = document.getElementById('task-deadline');
  const deadline = deadlineEl.value || getTodayLocalISO();
 
  const task = {
    id: Date.now(),
    name,
    difficulty,
    priority,
    hours,
    deadline,
    color: TASK_COLORS[state.tasks.length % TASK_COLORS.length],
    done: false
  };
 
  state.tasks.push(task);
  const user = auth.currentUser;

  if (user) {

      saveTasks(user.uid, state.tasks)
          .then(() => console.log("Tasks saved"))
          .catch(error => console.error("Task save failed:", error));

  } 
 
  // FIX: Reset form fields after adding
  nameEl.value = '';
  hoursSlider.value = 2;
  document.getElementById('hours-out').textContent = '2';
  deadlineEl.value = getTodayLocalISO();
 
  // Reset segmented controls to defaults
  ['diff-ctrl', 'pri-ctrl'].forEach(ctrlId => {
    const ctrl = document.getElementById(ctrlId);
    if (ctrl) {
      ctrl.querySelectorAll('.seg-btn').forEach((btn, i) => {
        btn.classList.toggle('active', i === 0);
      });
    }
  });
 
  rebuildScheduleWithAStar();
  updateDonut();
  updateTaskCount();
}
 
// ─── A* Schedule Rebuild ──────────────────────────────────────────────────────
function rebuildScheduleWithAStar() {
  const curve = state.energyCurve.length
    ? state.energyCurve
    : generateEnergyCurve(state.profile);
 
  const doneIds = new Set(state.schedule.filter(s => s.done).map(s => s.id));
  const assignments = aStarSchedule(state.tasks, curve);
 
  state.schedule = assignments.map(({ task, slot }) => {
    const energyLabel = slot.energy >= 70 ? 'peak' : slot.energy >= 45 ? 'medium' : 'low';
    return {
      id: task.id,
      name: task.name,
      hour: slot.hour,
      endHour: slot.hour + Math.ceil(task.hours),
      energy: slot.energy,
      energyLabel,
      difficulty: task.difficulty,
      priority: task.priority,
      hours: task.hours,
      color: task.color,
      done: doneIds.has(task.id)
    };
  }).sort((a, b) => a.hour - b.hour);
 
  renderSchedule();
}
 
function renderSchedule() {
  const list = document.getElementById('schedule-list');
  document.getElementById('sched-date').textContent = todayStr();
 
  if (!state.schedule.length) {
    list.innerHTML = `<div class="sched-empty">
      <div class="empty-icon-svg">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <rect x="6" y="8" width="28" height="26" rx="4" stroke="var(--text-dim)" stroke-width="1.5"/>
          <path d="M13 4v8M27 4v8M6 18h28" stroke="var(--text-dim)" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M14 26h12M14 22h8" stroke="var(--text-dim)" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="empty-text">Add subjects above to see your A*-generated schedule</div>
    </div>`;
    return;
  }
 
  list.innerHTML = state.schedule.map((s) => {
    const badgeClass = s.energyLabel === 'peak' ? 'badge-peak' : s.energyLabel === 'medium' ? 'badge-medium' : 'badge-low';
    const badgeLabel = s.energyLabel === 'peak' ? 'Peak' : s.energyLabel === 'medium' ? 'Moderate' : 'Low';
    const checkMark = s.done ? '&#10003;' : '';
    return `<div class="sched-block ${s.done ? 'done' : ''}" id="sb-${s.id}">
      <div class="sched-time">${fmtTime(s.hour)}<br><span style="font-size:9px;color:var(--text-dim)">${s.hours}h</span></div>
      <div class="sched-color-bar" style="background:${s.color}"></div>
      <div class="sched-body">
        <div class="sched-subject">${s.name}</div>
        <div class="sched-meta">${s.difficulty} &middot; ${s.priority} priority</div>
      </div>
      <div class="sched-badge ${badgeClass}">${badgeLabel}</div>
      <button class="sched-check" onclick="toggleDone(${s.id})" title="Mark done">${checkMark}</button>
      <button class="sched-del" onclick="removeTask(${s.id})" title="Remove">&times;</button>
    </div>`;
  }).join('');
}
 
function toggleDone(id) {

    const s = state.schedule.find(x => x.id === id);

    if (!s) return;

    s.done = !s.done;

    const task = state.tasks.find(x => x.id === id);

    if (task) {
        task.done = s.done;
    }

    state.completedCount = state.tasks.filter(t => t.done).length;

    const user = auth.currentUser;

    if (user) {

        saveTasks(user.uid, state.tasks)
            .then(() => console.log("Task status saved"))
            .catch(error => console.error("Task status save failed:", error));

    }

    renderSchedule();
    updateTaskCount();
    updateHeatmap();
}
 
function removeTask(id) {

    state.tasks = state.tasks.filter(x => x.id !== id);
    state.schedule = state.schedule.filter(x => x.id !== id);

    const user = auth.currentUser;

    if (user) {

        saveTasks(user.uid, state.tasks)
            .then(() => console.log("Task deleted from Firebase"))
            .catch(error => console.error("Task delete failed:", error));

    }

    if (state.tasks.length) {

        rebuildScheduleWithAStar();

    } else {

        renderSchedule();

    }

    updateDonut();
    updateTaskCount();
}
 
function updateTaskCount() {
  document.getElementById('ns-tasks').textContent = state.completedCount;
}
 
// ─── Donut Chart ──────────────────────────────────────────────────────────────
function updateDonut() {
  const svg = document.getElementById('donut-svg');
  const legend = document.getElementById('donut-legend');
 
  if (!state.tasks.length) {
    svg.innerHTML = `<circle cx="60" cy="60" r="40" fill="none" stroke="#1e1e2e" stroke-width="20"/>
      <text x="60" y="64" text-anchor="middle" class="donut-label" id="donut-center">No data</text>`;
    legend.innerHTML = '';
    return;
  }
 
  const total = state.tasks.reduce((a, t) => a + t.hours, 0);
  const r = 40, cx = 60, cy = 60, circ = 2 * Math.PI * r;
  let cumAngle = 0;
 
  let circlesSVG = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#1e1e2e" stroke-width="20"/>`;
 
  state.tasks.forEach(task => {
    const pct = task.hours / total;
    const dash = pct * circ;
    const rotation = -90 + (cumAngle / total) * 360;
    circlesSVG += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${task.color}" stroke-width="20"
      stroke-dasharray="${dash} ${circ - dash}"
      stroke-dashoffset="${circ - dash}"
      transform="rotate(${rotation} ${cx} ${cy})"
      style="transition:stroke-dashoffset 0.8s ease"/>`;
    cumAngle += task.hours;
  });
 
  circlesSVG += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" class="donut-label">${total}h</text>`;
  svg.innerHTML = circlesSVG;
 
  legend.innerHTML = state.tasks.map(t =>
    `<div class="dl-item">
      <div class="dl-dot" style="background:${t.color}"></div>
      <span>${t.name} (${t.hours}h)</span>
    </div>`
  ).join('');
}
 
// ─── Hourly Productivity Chart ────────────────────────────────────────────────
function renderHourlyChart(curve) {
  const chart = document.getElementById('hourly-chart');
  const maxE = Math.max(...curve.map(c => c.energy));
  chart.innerHTML = curve.map(c => {
    const pct = (c.energy / maxE) * 100;
    const color = c.energy >= 70 ? 'var(--green)' : c.energy >= 45 ? 'var(--amber)' : 'var(--red)';
    return `<div class="mb-bar" style="height:0;background:${color};opacity:0.75" data-h="${pct}%" data-tip="${fmtTime(c.hour)}: ${c.energy}%"></div>`;
  }).join('');
 
  setTimeout(() => {
    chart.querySelectorAll('.mb-bar').forEach(b => { b.style.height = b.dataset.h; });
  }, 150);
}
 
// ─── Heat Map ─────────────────────────────────────────────────────────────────
function buildHeatmap() {
  const hm = document.getElementById('heatmap');
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const hours = ['6AM','9AM','12PM','3PM','6PM','9PM'];
 
  const base = [
    [0.2,0.7,0.9,0.5,0.3,0.4],
    [0.3,0.85,0.9,0.4,0.2,0.6],
    [0.1,0.75,0.8,0.6,0.4,0.5],
    [0.4,0.8,0.7,0.3,0.5,0.7],
    [0.3,0.9,0.8,0.4,0.6,0.8],
    [0.5,0.6,0.5,0.7,0.8,0.9],
    [0.2,0.4,0.3,0.5,0.6,0.5],
  ];
 
  hm.style.gridTemplateColumns = `repeat(${days.length}, 1fr)`;
  hm.innerHTML = days.map((day, d) =>
    `<div>
      <div class="hm-day-label">${day}</div>
      ${base[d].map((v, h) => `<div class="hm-cell" style="opacity:${v};margin-bottom:4px" title="${day} ${hours[h]}: ${Math.round(v*100)}% focus"></div>`).join('')}
    </div>`
  ).join('');
}
 
function updateHeatmap() {
  buildHeatmap();
}
 
// ─── Accuracy Meter ───────────────────────────────────────────────────────────
function updateAccuracyMeter(val) {
  const ring = document.getElementById('acc-ring');
  const valEl = document.getElementById('acc-val');
  const detailEl = document.getElementById('acc-detail');
  const circ = 239;
  const offset = circ - (val / 100) * circ;
 
  ring.style.strokeDashoffset = offset;
  valEl.textContent = val + '%';
 
  const levels = val >= 80 ? ['var(--green)','High confidence — schedule reliable']
    : val >= 60 ? ['var(--amber)','Moderate — add more data to improve']
    : ['var(--red)','Building model — check back tomorrow'];
  ring.style.stroke = levels[0];
  document.querySelector('.meter-val').style.color = levels[0];
  detailEl.textContent = levels[1];
}

// ======================= AUTH CHECK =======================



// ======================= INIT =======================

(function init() {

    document.getElementById('sched-date').textContent = todayStr();

    const today = getTodayLocalISO();

    const deadlineEl = document.getElementById('task-deadline');

    deadlineEl.setAttribute('min', today);

    deadlineEl.value = today;

    const hoursSlider = document.getElementById('hours-slider');
    const hoursOut = document.getElementById('hours-out');

    if (hoursSlider && hoursOut) {

        hoursOut.textContent = hoursSlider.value;

        hoursSlider.addEventListener('input', function () {

            hoursOut.textContent = this.value;

        });

    }

    buildHeatmap();

    const navObserver = new IntersectionObserver(entries => {

        entries.forEach(e => {

            if (e.isIntersecting) {

                document.getElementById('ns-streak').textContent = state.streak;

            }

        });

    });

    const profileSec = document.getElementById('profile');

    if (profileSec)
        navObserver.observe(profileSec);

    document.getElementById('acc-ring').style.strokeDashoffset = 239;

})();

// Load user's tasks after Firebase restores the login session
onAuthStateChanged(auth, async (user) => {

    if (!user) return;

    await loadUserTasks();

});

// ======================= MAKE FUNCTIONS AVAILABLE TO HTML =======================

window.scrollToSection = scrollToSection;
window.pick = pick;
window.updateGoal = updateGoal;
window.goToPlanner = goToPlanner;
window.addTask = addTask;
window.toggleDone = toggleDone;
window.removeTask = removeTask;
window.buildProfile = buildProfile;

// ================= PROFILE CARD =================

function toggleProfile() {

    const card = document.getElementById("profile-card");

    if (!card) return;

    card.classList.toggle("show");

    if (card.classList.contains("show")) {
        updateProfileCard();
    }
}

function updateProfileCard() {

    const profile = state.profile || {};
    const user = auth.currentUser;

    document.getElementById("profile-name").textContent =
        profile.name || user?.displayName || "—";

    document.getElementById("profile-age").textContent =
        profile.age || "—";

    document.getElementById("profile-gender").textContent =
        profile.gender || "—";

    document.getElementById("profile-email").textContent =
        user?.email || profile.email || "—";

    document.getElementById("profile-email-detail").textContent =
        user?.email || profile.email || "—";

    document.getElementById("profile-streak").textContent =
        state.streak || 0;

    document.getElementById("profile-tasks").textContent =
        state.tasks.filter(task => task.done).length;

    document.getElementById("profile-goal").textContent =
        profile.goal ? `${profile.goal} hrs` : "—";

    document.getElementById("profile-focus").textContent =
        profile.focus ? `${profile.focus} min` : "—";
}

window.toggleProfile = toggleProfile;
window.updateProfileCard = updateProfileCard;

// ================= EDIT PROFILE =================

window.openEditProfile = function () {

    const card = document.getElementById("edit-profile-card");

    if (!card) {
        console.error("Edit profile card not found");
        return;
    }

    const profile = state.profile || {};
    const user = auth.currentUser;

    const nameInput = document.getElementById("edit-name");
    const ageInput = document.getElementById("edit-age");
    const genderInput = document.getElementById("edit-gender");
    const emailInput = document.getElementById("edit-email");

    if (nameInput) {
        nameInput.value = profile.name || user?.displayName || "";
    }

    if (ageInput) {
        ageInput.value = profile.age || "";
    }

    if (genderInput) {
        genderInput.value = profile.gender || "";
    }

    if (emailInput) {
        emailInput.value = user?.email || profile.email || "";
    }

    document.getElementById("profile-card")?.classList.remove("show");

    card.classList.add("show");
};


// CLOSE EDIT PROFILE

window.closeEditProfile = function () {

    const card = document.getElementById("edit-profile-card");

    if (card) {
        card.classList.remove("show");
    }

};


// SAVE PROFILE

window.saveEditedProfile = async function () {

    const user = auth.currentUser;

    if (!user) {
        alert("Please login again.");
        return;
    }

    const name =
        document.getElementById("edit-name").value.trim();

    const age =
        document.getElementById("edit-age").value;

    const gender =
        document.getElementById("edit-gender").value;

    if (!name) {
        alert("Please enter your name.");
        return;
    }

    if (!age) {
        alert("Please enter your age.");
        return;
    }

    if (!gender) {
        alert("Please select your gender.");
        return;
    }

    const updatedProfile = {

        ...(state.profile || {}),

        name: name,
        age: Number(age),
        gender: gender,
        email: user.email

    };

    try {

        await saveProfile(user.uid, updatedProfile);

        state.profile = updatedProfile;

        updateProfileCard();

        closeEditProfile();

        alert("Profile updated successfully!");

    } catch (error) {

        console.error("Profile update error:", error);

        alert("Failed to save profile.");

    }

};


// ==============================
// TEST GEMINI AI
// ==============================

async function testGemini() {

    try {

        const result = await model.generateContent(
            "Say hello to StudyMind in one short sentence."
        );

        const response = result.response.text();

        console.log("Gemini Response:", response);

    } catch (error) {

        console.error("Gemini Error:", error);

    }
}

window.testGemini = testGemini;



// ==============================
// STUDYMIND AI CHAT WITH MEMORY
// ==============================

const aiInput = document.getElementById("ai-input");
const aiSend = document.getElementById("ai-send");
const aiMessages = document.getElementById("ai-messages");
const aiNewChat = document.getElementById("ai-new-chat");

let aiChatSession = model.startChat();

async function sendAIMessage() {

    const message = aiInput.value.trim();

    if (!message) return;

    // Show user message
    const userMessage = document.createElement("div");

    userMessage.className = "user-message";
    userMessage.textContent = message;

    aiMessages.appendChild(userMessage);

    // Clear input
    aiInput.value = "";

    aiMessages.scrollTop = aiMessages.scrollHeight;

    // Disable send button
    aiSend.disabled = true;
    aiSend.textContent = "Thinking...";

    try {

        // Send message through the same Gemini chat session
        const result = await aiChatSession.sendMessage(message);

        const response = result.response.text();

        // Show AI response
        const aiMessage = document.createElement("div");

        aiMessage.className = "ai-message";
        aiMessage.textContent = response;

        aiMessages.appendChild(aiMessage);

        aiMessages.scrollTop = aiMessages.scrollHeight;

    } catch (error) {

        console.error("Gemini Chat Error:", error);

        const errorMessage = document.createElement("div");

        errorMessage.className = "ai-message";
        errorMessage.textContent =
            "Sorry, I couldn't process that request.";

        aiMessages.appendChild(errorMessage);

        aiMessages.scrollTop = aiMessages.scrollHeight;

    } finally {

        aiSend.disabled = false;
        aiSend.textContent = "Send";

        aiInput.focus();

    }
}




// ==============================
// NEW CHAT
// ==============================

if (aiNewChat) {

    aiNewChat.addEventListener("click", () => {

        // Start a completely new Gemini conversation
        aiChatSession = model.startChat();

        // Clear messages
        aiMessages.innerHTML = "";

        // Add welcome message
        const welcomeMessage = document.createElement("div");

        welcomeMessage.className = "ai-message";

        welcomeMessage.textContent =
            "Hi! I'm your StudyMind AI assistant. Ask me anything about your studies.";

        aiMessages.appendChild(welcomeMessage);

        // Focus input
        aiInput.focus();

    });

}






// Send button
if (aiSend) {

    aiSend.addEventListener("click", sendAIMessage);

}


// Press Enter to send
if (aiInput) {

    aiInput.addEventListener("keydown", (event) => {

        if (event.key === "Enter") {
            sendAIMessage();
        }

    });

}

// ==============================
// AI CHAT OPEN / CLOSE
// ==============================

const aiButton = document.getElementById("ai-assistant-btn");
const aiChat = document.getElementById("ai-chat");
const aiClose = document.getElementById("ai-close");

if (aiButton) {

    aiButton.addEventListener("click", () => {
        aiChat.classList.add("show");
    });

}

if (aiClose) {

    aiClose.addEventListener("click", () => {
        aiChat.classList.remove("show");
    });

}