// ==========================================
// STATE MANAGEMENT
// ==========================================
let workouts = [];
let expenses = [];
let currentViewingDate = new Date();

let workoutsChart = null;
let spendingChart = null;
let customWorkoutsChart = null;
let customSpendingChart = null;

// Initialize global Chart.js defaults if Chart is loaded
if (typeof Chart !== 'undefined') {
    Chart.defaults.color = 'rgba(255, 255, 255, 0.6)';
    Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(30, 30, 30, 0.9)';
    Chart.defaults.plugins.tooltip.titleColor = '#ffffff';
    Chart.defaults.plugins.tooltip.bodyColor = '#ffffff';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(255, 255, 255, 0.1)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
}

// ==========================================
// DOM ELEMENTS
// ==========================================
const DOM = {
    // Navigation
    navBtnWorkouts: document.getElementById('nav-btn-workouts'),
    navBtnSpending: document.getElementById('nav-btn-spending'),
    rootWorkouts: document.getElementById('root-workouts'),
    rootSpending: document.getElementById('root-spending'),

    // Shared
    loadingOverlay: document.getElementById('loading-overlay'),

    // Workouts App
    w: {
        views: {
            dashboard: document.getElementById('view-dashboard'),
            newForm: document.getElementById('view-new-workout')
        },
        btns: {
            add: document.getElementById('add-workout-btn'),
            back: document.getElementById('back-btn'),
            addEx: document.getElementById('add-exercise-btn')
        },
        elements: {
            title: document.getElementById('header-title'),
            list: document.getElementById('workout-list'),
            container: document.getElementById('exercises-container'),
            form: document.getElementById('workout-form'),
            total: document.getElementById('total-workouts-stat'),
            week: document.getElementById('this-week-stat'),
            dayInput: document.getElementById('workout-day'),
            // Custom Analytics
            btnOverview: document.getElementById('btn-overview-workouts'),
            btnAnalytics: document.getElementById('btn-analytics-workouts'),
            secOverview: document.getElementById('workouts-overview-section'),
            secAnalytics: document.getElementById('workouts-analytics-section'),
            customStartWeek: document.getElementById('workouts-start-week'),
            customEndWeek: document.getElementById('workouts-end-week'),
            customFilter: document.getElementById('workouts-filter-select'),
            customExerciseGroup: document.getElementById('workouts-exercise-group'),
            customExercise: document.getElementById('workouts-exercise-select')
        }
    },

    // Spending App
    s: {
        views: {
            dashboard: document.getElementById('view-spending-dashboard'),
            newForm: document.getElementById('view-new-spending')
        },
        btns: {
            add: document.getElementById('add-spending-btn'),
            back: document.getElementById('spending-back-btn')
        },
        elements: {
            title: document.getElementById('spending-header-title'),
            list: document.getElementById('spending-list'),
            categoryList: document.getElementById('category-breakdown-list'),
            form: document.getElementById('spending-form'),
            month: document.getElementById('this-month-spend-stat'),
            dateInput: document.getElementById('expense-date'),
            typeSelect: document.getElementById('expense-type'),
            customTypeGroup: document.getElementById('custom-category-group'),
            customTypeInput: document.getElementById('custom-category-input'),
            prevMonthBtn: document.getElementById('prev-month-btn'),
            nextMonthBtn: document.getElementById('next-month-btn'),
            monthDisplay: document.getElementById('current-month-display'),
            // Custom Analytics
            btnOverview: document.getElementById('btn-overview-spending'),
            btnAnalytics: document.getElementById('btn-analytics-spending'),
            secOverview: document.getElementById('spending-overview-section'),
            secAnalytics: document.getElementById('spending-analytics-section'),
            customStartMonth: document.getElementById('spending-start-month'),
            customEndMonth: document.getElementById('spending-end-month'),
            customFilter: document.getElementById('spending-filter-select')
        }
    },

    // Settings App
    settings: {
        root: document.getElementById('root-settings'),
        btns: document.querySelectorAll('.settings-btn'),
        backBtn: document.getElementById('settings-back-btn'),
        exportBtn: document.getElementById('export-data-btn'),
        importBtn: document.getElementById('import-data-btn'),
        fileInput: document.getElementById('import-file-input'),
        clearBtn: document.getElementById('clear-data-btn'),
        // GitHub Backup
        ghRepoInput: document.getElementById('gh-repo-input'),
        ghTokenInput: document.getElementById('gh-token-input'),
        ghSaveBtn: document.getElementById('gh-save-settings-btn'),
        ghPushBtn: document.getElementById('gh-push-btn'),
        ghPullBtn: document.getElementById('gh-pull-btn'),
        ghStatus: document.getElementById('gh-status-label')
    }
};

// ==========================================
// INITIALIZATION
// ==========================================
function init() {
    loadData();
    setupEventListeners();
    renderWorkoutsDashboard();
    renderSpendingDashboard();

    // Toggle Custom Category Input and adjust required logic
    DOM.s.elements.typeSelect.addEventListener('change', (e) => {
        if (e.target.value === 'Other') {
            DOM.s.elements.customTypeGroup.classList.remove('hidden');
            DOM.s.elements.customTypeInput.setAttribute('required', 'true');
        } else {
            DOM.s.elements.customTypeGroup.classList.add('hidden');
            DOM.s.elements.customTypeInput.removeAttribute('required');
        }
    });
}

function loadData() {
    const savedWorkouts = localStorage.getItem('wt_workouts');
    if (savedWorkouts) workouts = JSON.parse(savedWorkouts);

    const savedExpenses = localStorage.getItem('wt_expenses');
    if (savedExpenses) expenses = JSON.parse(savedExpenses);
}

function saveData(type) {
    if (type === 'workouts') localStorage.setItem('wt_workouts', JSON.stringify(workouts));
    if (type === 'expenses') localStorage.setItem('wt_expenses', JSON.stringify(expenses));
}

// ==========================================
// APP NAVIGATION (ROOT LEVEL)
// ==========================================
function switchApp(appType) {
    DOM.settings.root.classList.add('hidden');
    DOM.settings.root.classList.remove('active');

    if (appType === 'workouts') {
        DOM.navBtnWorkouts.classList.add('active');
        DOM.navBtnSpending.classList.remove('active');
        DOM.rootWorkouts.classList.add('active');
        DOM.rootWorkouts.classList.remove('hidden');
        DOM.rootSpending.classList.remove('active');
        DOM.rootSpending.classList.add('hidden');
    } else {
        DOM.navBtnWorkouts.classList.remove('active');
        DOM.navBtnSpending.classList.add('active');
        DOM.rootWorkouts.classList.remove('active');
        DOM.rootWorkouts.classList.add('hidden');
        DOM.rootSpending.classList.add('active');
        DOM.rootSpending.classList.remove('hidden');
    }
}

// ==========================================
// INNER VIEW NAVIGATION
// ==========================================
function switchView(app, viewName) {
    const d = DOM[app];

    // Hide all views for this app
    Object.values(d.views).forEach(v => {
        v.classList.remove('active');
        if (!v.classList.contains('hidden')) v.classList.add('hidden');
    });

    // Show target view
    d.views[viewName].classList.remove('hidden');
    d.views[viewName].classList.add('active');

    // Handle settings button visibility
    const gearBtn = document.querySelector(`#root-${app === 'w' ? 'workouts' : 'spending'} .settings-btn`);

    if (viewName === 'newForm') {
        d.elements.title.textContent = app === 'w' ? 'New Workout' : 'New Expense';
        d.btns.add.classList.add('hidden');
        if (gearBtn) gearBtn.classList.add('hidden');
        d.btns.back.classList.remove('hidden');

        // Setup defaults
        const today = new Date().toISOString().split('T')[0];
        if (app === 'w') {
            // Updated check: only add block if container is empty
            if (d.elements.container.innerHTML.trim() === '') addExerciseBlock();
            d.elements.dayInput.value = today;
        } else {
            // Only reset to defaults if NOT editing
            if (!editingExpenseId) {
                d.elements.dateInput.value = today;
                DOM.s.elements.typeSelect.value = 'Groceries';
                DOM.s.elements.customTypeGroup.classList.add('hidden');
                DOM.s.elements.customTypeInput.value = '';
                DOM.s.elements.customTypeInput.removeAttribute('required');
            } else {
                // If editing, update the title
                d.elements.title.textContent = 'Edit Expense';
            }
        }
    } else {
        d.elements.title.textContent = app === 'w' ? "Praveen's Workouts" : "Praveen's Spending";
        d.btns.add.classList.remove('hidden');
        if (gearBtn) gearBtn.classList.remove('hidden');
        d.btns.back.classList.add('hidden');
        if (app === 'w') { editingWorkoutId = null; renderWorkoutsDashboard(); }
        if (app === 's') { editingExpenseId = null; renderSpendingDashboard(); }
    }
}

// ==========================================
// EVENT LISTENERS
// ==========================================
function setupEventListeners() {
    // Root App Nav
    DOM.navBtnWorkouts.addEventListener('click', () => switchApp('workouts'));
    DOM.navBtnSpending.addEventListener('click', () => switchApp('spending'));

    // Workouts Navigation
    DOM.w.btns.add.addEventListener('click', () => switchView('w', 'newForm'));
    DOM.w.btns.back.addEventListener('click', () => switchView('w', 'dashboard'));

    // Spending Navigation
    DOM.s.btns.add.addEventListener('click', () => switchView('s', 'newForm'));
    DOM.s.btns.back.addEventListener('click', () => switchView('s', 'dashboard'));

    // Workouts Form Actions
    DOM.w.btns.addEx.addEventListener('click', addExerciseBlock);
    DOM.w.elements.form.addEventListener('submit', handleSaveWorkout);

    // Spending Form Actions
    DOM.s.elements.form.addEventListener('submit', handleSaveExpense);

    // Month Navigation
    DOM.s.elements.prevMonthBtn.addEventListener('click', () => {
        currentViewingDate.setMonth(currentViewingDate.getMonth() - 1);
        renderSpendingDashboard();
    });
    DOM.s.elements.nextMonthBtn.addEventListener('click', () => {
        currentViewingDate.setMonth(currentViewingDate.getMonth() + 1);
        renderSpendingDashboard();
    });

    // Custom Analytics Toggles & Inputs
    DOM.w.elements.btnOverview.addEventListener('click', () => {
        DOM.w.elements.secOverview.classList.remove('hidden');
        DOM.w.elements.secAnalytics.classList.add('hidden');
        DOM.w.elements.btnOverview.classList.add('active');
        DOM.w.elements.btnAnalytics.classList.remove('active');
    });
    DOM.w.elements.btnAnalytics.addEventListener('click', () => {
        DOM.w.elements.secOverview.classList.add('hidden');
        DOM.w.elements.secAnalytics.classList.remove('hidden');
        DOM.w.elements.btnOverview.classList.remove('active');
        DOM.w.elements.btnAnalytics.classList.add('active');
        initCustomWorkoutsAnalytics();
    });

    DOM.s.elements.btnOverview.addEventListener('click', () => {
        DOM.s.elements.secOverview.classList.remove('hidden');
        DOM.s.elements.secAnalytics.classList.add('hidden');
        DOM.s.elements.btnOverview.classList.add('active');
        DOM.s.elements.btnAnalytics.classList.remove('active');
    });
    DOM.s.elements.btnAnalytics.addEventListener('click', () => {
        DOM.s.elements.secOverview.classList.add('hidden');
        DOM.s.elements.secAnalytics.classList.remove('hidden');
        DOM.s.elements.btnOverview.classList.remove('active');
        DOM.s.elements.btnAnalytics.classList.add('active');
        initCustomSpendingAnalytics();
    });

    // Event listeners to redraw charts on input change
    DOM.w.elements.customStartWeek.addEventListener('change', renderCustomWorkoutsChart);
    DOM.w.elements.customEndWeek.addEventListener('change', renderCustomWorkoutsChart);
    DOM.w.elements.customFilter.addEventListener('change', updateExerciseDropdown);
    DOM.w.elements.customExercise.addEventListener('change', renderCustomWorkoutsChart);

    DOM.s.elements.customStartMonth.addEventListener('change', renderCustomSpendingChart);
    DOM.s.elements.customEndMonth.addEventListener('change', renderCustomSpendingChart);
    DOM.s.elements.customFilter.addEventListener('change', renderCustomSpendingChart);

    // Settings Navigation
    DOM.settings.btns.forEach(btn => {
        btn.addEventListener('click', () => {
            DOM.rootWorkouts.classList.add('hidden');
            DOM.rootSpending.classList.add('hidden');
            DOM.settings.root.classList.remove('hidden');
            DOM.settings.root.classList.add('active');
            loadGitHubSettings();
        });
    });

    DOM.settings.backBtn.addEventListener('click', () => {
        DOM.settings.root.classList.add('hidden');
        DOM.settings.root.classList.remove('active');
        if (DOM.navBtnWorkouts.classList.contains('active')) {
            DOM.rootWorkouts.classList.remove('hidden');
        } else {
            DOM.rootSpending.classList.remove('hidden');
        }
    });

    // Data Management Actions
    DOM.settings.exportBtn.addEventListener('click', exportData);
    DOM.settings.importBtn.addEventListener('click', () => DOM.settings.fileInput.click());
    DOM.settings.fileInput.addEventListener('change', importData);
    DOM.settings.clearBtn.addEventListener('click', clearAllData);

    // GitHub Backup Actions
    DOM.settings.ghSaveBtn.addEventListener('click', saveGitHubSettings);
    DOM.settings.ghPushBtn.addEventListener('click', pushToGitHub);
    DOM.settings.ghPullBtn.addEventListener('click', pullFromGitHub);
}

// ==========================================
// WORKOUTS LOGIC
// ==========================================
let exerciseCount = 0;
let editingWorkoutId = null;

function addExerciseBlock(exerciseData = null) {
    exerciseCount++;
    const exId = `ex-${Date.now()}`;
    const block = document.createElement('div');
    block.className = 'exercise-block card';
    block.id = exId;

    block.innerHTML = `
        <div class="exercise-header">
            <input type="text" class="exercise-title-input" placeholder="Exercise Name" required value="${exerciseData ? exerciseData.title : ''}">
            <button type="button" class="btn-icon-danger remove-ex-btn"><i class="ph ph-trash"></i></button>
        </div>
        <div class="sets-container">
            <div class="set-headers"><span>Set</span><span>kg</span><span>Reps</span><span></span></div>
            <div class="sets-list"></div>
            <button type="button" class="add-set-btn"><i class="ph ph-plus"></i> Add Set</button>
        </div>
    `;

    block.querySelector('.remove-ex-btn').addEventListener('click', () => {
        block.style.animation = 'fadeOut 0.2s ease-out forwards';
        setTimeout(() => block.remove(), 200);
    });

    const setsList = block.querySelector('.sets-list');
    let setCount = 0;

    function addSetRow(setData = null) {
        setCount++;
        const row = document.createElement('div');
        row.className = 'set-row';
        row.innerHTML = `
            <div class="set-number">${setCount}</div>
            <input type="number" class="set-input set-weight" placeholder="100" required step="0.5" inputmode="decimal" value="${setData ? setData.weight : ''}">
            <input type="number" class="set-input set-reps" placeholder="10" required min="1" inputmode="numeric" value="${setData ? setData.reps : ''}">
            <button type="button" class="btn-icon-danger remove-set-btn"><i class="ph ph-x"></i></button>
        `;
        row.querySelector('.remove-set-btn').addEventListener('click', () => {
            row.remove();
            Array.from(setsList.children).forEach((r, i) => r.querySelector('.set-number').textContent = i + 1);
        });
        setsList.appendChild(row);
    }

    block.querySelector('.add-set-btn').addEventListener('click', () => addSetRow(null));

    if (exerciseData && exerciseData.sets && exerciseData.sets.length) {
        exerciseData.sets.forEach(s => addSetRow(s));
    } else {
        addSetRow();
    }

    DOM.w.elements.container.appendChild(block);
    block.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function handleSaveWorkout(e) {
    e.preventDefault();
    if (DOM.w.elements.container.children.length === 0) return alert('Add at least one exercise!');

    const exercises = [];
    document.querySelectorAll('.exercise-block').forEach(block => {
        const title = block.querySelector('.exercise-title-input').value.trim();
        const sets = Array.from(block.querySelectorAll('.set-row')).map(row => ({
            weight: parseFloat(row.querySelector('.set-weight').value),
            reps: parseInt(row.querySelector('.set-reps').value, 10)
        })).filter(s => !isNaN(s.weight) && !isNaN(s.reps));
        if (title && sets.length) exercises.push({ title, sets });
    });

    DOM.loadingOverlay.classList.remove('hidden');
    setTimeout(() => {
        if (editingWorkoutId) {
            // Edit existing workout
            const idx = workouts.findIndex(w => w.id === editingWorkoutId);
            if (idx !== -1) {
                workouts[idx].date = DOM.w.elements.dayInput.value;
                workouts[idx].muscle = document.getElementById('muscle-group').value.trim();
                workouts[idx].exercises = exercises;
            }
            editingWorkoutId = null;
        } else {
            // Create new workout
            const newWorkout = {
                id: Date.now().toString(),
                date: DOM.w.elements.dayInput.value,
                muscle: document.getElementById('muscle-group').value.trim(),
                exercises
            };
            workouts.unshift(newWorkout);
        }
        workouts.sort((a, b) => new Date(b.date) - new Date(a.date));
        saveData('workouts');
        DOM.w.elements.form.reset();
        DOM.w.elements.container.innerHTML = '';
        document.getElementById('save-workout-btn').textContent = 'Save Workout';
        DOM.loadingOverlay.classList.add('hidden');
        switchView('w', 'dashboard');
    }, 400);
}

function loadWorkoutForEdit(id) {
    const w = workouts.find(x => x.id === id);
    if (!w) return;
    editingWorkoutId = id;

    // Populate header fields
    DOM.w.elements.dayInput.value = w.date;
    document.getElementById('muscle-group').value = w.muscle;

    // Clear and repopulate exercises container
    DOM.w.elements.container.innerHTML = '';
    w.exercises.forEach(ex => {
        addExerciseBlock(ex);
    });

    document.getElementById('save-workout-btn').textContent = 'Update Workout';
    switchView('w', 'newForm');
}

function deleteWorkout(id) {
    if (!confirm('Are you sure you want to delete this workout?')) return;
    workouts = workouts.filter(w => w.id !== id);
    saveData('workouts');
    renderWorkoutsDashboard();
}

function renderWorkoutsDashboard() {
    DOM.w.elements.total.textContent = workouts.length;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    DOM.w.elements.week.textContent = workouts.filter(w => new Date(w.date) >= oneWeekAgo).length;

    updateWorkoutsChart();

    if (workouts.length === 0) {
        DOM.w.elements.list.innerHTML = `<div class="empty-state"><i class="ph ph-barbell"></i><p>No workouts yet.<br>Tap + to start tracking!</p></div>`;
        return;
    }

    DOM.w.elements.list.innerHTML = workouts.map(w => {
        const dObj = new Date(w.date);
        const dStr = isNaN(dObj) ? w.date : dObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        const totalSets = w.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
        const exNames = w.exercises.map(ex => ex.title).join(', ');
        return `
            <div class="workout-item card">
                <div class="workout-header">
                    <span class="workout-day">${dStr}</span>
                    <span class="workout-muscle">${w.muscle}</span>
                </div>
                <div class="workout-summary">
                    <span><i class="ph ph-list-numbers"></i> ${w.exercises.length} Exercises</span>
                    <span><i class="ph ph-stack"></i> ${totalSets} Sets</span>
                </div>
                ${exNames ? `<p class="workout-exercise-names">${exNames}</p>` : ''}
                <div class="workout-actions">
                    <button class="btn btn-secondary btn-small" onclick="loadWorkoutForEdit('${w.id}')"><i class="ph ph-pencil"></i> Edit</button>
                    <button class="btn btn-danger-outline btn-small" onclick="deleteWorkout('${w.id}')"><i class="ph ph-trash"></i> Delete</button>
                </div>
            </div>`;
    }).join('');
}

function updateWorkoutsChart() {
    const cardEl = document.getElementById('workouts-chart-card');
    if (!cardEl) return;

    if (workouts.length === 0) {
        cardEl.classList.add('hidden');
        return;
    } else {
        cardEl.classList.remove('hidden');
    }

    const ctx = document.getElementById('workouts-chart').getContext('2d');
    const labels = [];
    const dataPoints = [];

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString(undefined, { weekday: 'short' }));

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;

        const dayWorkouts = workouts.filter(w => w.date === dateString);
        let totalExercises = 0;
        dayWorkouts.forEach(w => totalExercises += w.exercises.length);

        dataPoints.push(totalExercises);
    }

    if (workoutsChart) {
        workoutsChart.data.labels = labels;
        workoutsChart.data.datasets[0].data = dataPoints;
        workoutsChart.update();
    } else {
        workoutsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Exercises',
                    data: dataPoints,
                    backgroundColor: 'rgba(33, 150, 243, 0.7)',
                    borderColor: '#2196f3',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { stepSize: 1, precision: 0 }
                    },
                    x: {
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
}

// ==========================================
// WORKOUTS CUSTOM ANALYTICS
// ==========================================
function getISOWeekString(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function initCustomWorkoutsAnalytics() {
    // Populate Muscle Groups
    const groups = new Set();
    workouts.forEach(w => {
        if (w.muscle) groups.add(w.muscle);
    });

    let optionsHtml = '<option value="All">All Muscle Groups</option>';
    Array.from(groups).sort().forEach(g => {
        optionsHtml += `<option value="${g}">${g}</option>`;
    });
    DOM.w.elements.customFilter.innerHTML = optionsHtml;

    // Set default dates (last 12 weeks)
    const today = new Date();
    const startObj = new Date(today.getTime() - 11 * 7 * 24 * 60 * 60 * 1000);

    DOM.w.elements.customEndWeek.value = today.toISOString().split('T')[0];
    DOM.w.elements.customStartWeek.value = startObj.toISOString().split('T')[0];

    updateExerciseDropdown();
}

function updateExerciseDropdown() {
    const selectedMuscle = DOM.w.elements.customFilter.value;
    const exercises = new Set();

    workouts.forEach(w => {
        if (selectedMuscle === 'All' || w.muscle === selectedMuscle) {
            w.exercises.forEach(ex => {
                if (ex.title) exercises.add(ex.title);
            });
        }
    });

    let optionsHtml = '<option value="All">Overall Volume</option>';
    Array.from(exercises).sort().forEach(ex => {
        optionsHtml += `<option value="${ex}">${ex}</option>`;
    });

    const currentVal = DOM.w.elements.customExercise.value;
    DOM.w.elements.customExercise.innerHTML = optionsHtml;

    if (exercises.has(currentVal)) {
        DOM.w.elements.customExercise.value = currentVal;
    }

    renderCustomWorkoutsChart();
}

function renderCustomWorkoutsChart() {
    const ctx = document.getElementById('workouts-custom-chart').getContext('2d');

    const startStr = DOM.w.elements.customStartWeek.value;
    const endStr = DOM.w.elements.customEndWeek.value;
    const filterGroup = DOM.w.elements.customFilter.value;
    const filterEx = DOM.w.elements.customExercise.value;

    if (!startStr || !endStr) return;

    const startDate = new Date(startStr);
    startDate.setHours(0, 0, 0, 0);
    // Snap to the start of the week (Monday)
    const startDay = startDate.getDay() || 7; // Convert Sunday(0) to 7
    startDate.setDate(startDate.getDate() - (startDay - 1));

    const endDate = new Date(endStr);
    endDate.setHours(23, 59, 59, 999);
    // Snap to the end of the week (Sunday)
    const endDay = endDate.getDay() || 7;
    endDate.setDate(endDate.getDate() + (7 - endDay));

    if (customWorkoutsChart) {
        customWorkoutsChart.destroy();
        customWorkoutsChart = null;
    }

    const buckets = {};
    let curr = new Date(startDate.getTime());
    while (curr <= endDate) {
        const key = getISOWeekString(curr);
        if (!buckets[key]) buckets[key] = { volume: 0, maxWeight: 0, found: false };
        curr.setDate(curr.getDate() + 1);
    }

    workouts.forEach(w => {
        const wDate = new Date(w.date);
        const inDateRange = wDate >= startDate && wDate <= endDate;
        const matchesGroup = filterGroup === 'All' || w.muscle === filterGroup;

        if (inDateRange && matchesGroup) {
            const key = getISOWeekString(wDate);
            if (!buckets[key]) return;

            w.exercises.forEach(ex => {
                buckets[key].volume += 1;

                if (filterEx !== 'All' && ex.title === filterEx) {
                    let maxSetWeight = 0;
                    ex.sets.forEach(s => {
                        if (s.weight > maxSetWeight) maxSetWeight = s.weight;
                    });
                    if (maxSetWeight > buckets[key].maxWeight) {
                        buckets[key].maxWeight = maxSetWeight;
                        buckets[key].found = true;
                    }
                }
            });
        }
    });

    const rawKeys = Object.keys(buckets);
    const labels = rawKeys.map(k => k.replace('-W', ' Wk '));
    let dataPoints = [];
    let chartOpts = {};

    if (filterEx === 'All') {
        dataPoints = Object.values(buckets).map(b => b.volume);
        chartOpts = {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: filterGroup === 'All' ? 'Total Exercises' : `${filterGroup} Exercises`,
                    data: dataPoints,
                    backgroundColor: 'rgba(33, 150, 243, 0.7)',
                    borderColor: '#2196f3',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { stepSize: 1, precision: 0 } },
                    x: { grid: { display: false } }
                },
                plugins: { legend: { display: true, labels: { color: 'rgba(255, 255, 255, 0.7)' } } }
            }
        };
    } else {
        dataPoints = rawKeys.map(k => buckets[k].found ? buckets[k].maxWeight : null);
        chartOpts = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: `Max Weight: ${filterEx}`,
                    data: dataPoints,
                    borderColor: '#2196f3',
                    backgroundColor: 'rgba(33, 150, 243, 0.15)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4,
                    pointBackgroundColor: '#2196f3',
                    spanGaps: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: false, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { callback: function (val) { return val + ' kg'; } } },
                    x: { grid: { display: false } }
                },
                plugins: {
                    legend: { display: true, labels: { color: 'rgba(255, 255, 255, 0.7)' } },
                    tooltip: { callbacks: { label: function (ctx) { return ctx.raw ? ctx.raw + ' kg' : 'No data'; } } }
                }
            }
        };
    }

    customWorkoutsChart = new Chart(ctx, chartOpts);
}

// ==========================================
// SPENDING LOGIC
// ==========================================
let editingExpenseId = null;

function handleSaveExpense(e) {
    e.preventDefault();

    let selectedType = document.getElementById('expense-type').value;
    if (selectedType === 'Other') {
        const customType = document.getElementById('custom-category-input').value.trim();
        if (customType) selectedType = customType;
    }

    DOM.loadingOverlay.classList.remove('hidden');

    setTimeout(() => {
        if (editingExpenseId) {
            const idx = expenses.findIndex(exp => exp.id === editingExpenseId);
            if (idx !== -1) {
                expenses[idx].date = DOM.s.elements.dateInput.value;
                expenses[idx].type = selectedType;
                expenses[idx].item = document.getElementById('expense-item').value.trim();
                expenses[idx].price = parseFloat(document.getElementById('expense-price').value);
            }
            editingExpenseId = null;
        } else {
            const newExpense = {
                id: Date.now().toString(),
                date: DOM.s.elements.dateInput.value,
                type: selectedType,
                item: document.getElementById('expense-item').value.trim(),
                price: parseFloat(document.getElementById('expense-price').value)
            };
            expenses.unshift(newExpense);
        }

        saveData('expenses');
        DOM.s.elements.form.reset();
        // Reset custom category
        DOM.s.elements.customTypeGroup.classList.add('hidden');
        DOM.s.elements.customTypeInput.value = '';
        DOM.s.elements.customTypeInput.removeAttribute('required');
        document.getElementById('save-spending-btn').textContent = 'Save Expense';
        DOM.loadingOverlay.classList.add('hidden');
        switchView('s', 'dashboard');
    }, 400);
}

function loadExpenseForEdit(id) {
    const exp = expenses.find(x => x.id === id);
    if (!exp) return;
    editingExpenseId = id;

    DOM.s.elements.dateInput.value = exp.date;
    document.getElementById('expense-item').value = exp.item;
    document.getElementById('expense-price').value = exp.price;

    // Handle category — check if it's a standard option or custom
    const standardOptions = ['Groceries', 'Provisions', 'Meats', 'Fruits', 'Eating Out', 'Travel', 'Other'];
    if (standardOptions.includes(exp.type)) {
        DOM.s.elements.typeSelect.value = exp.type;
        DOM.s.elements.customTypeGroup.classList.add('hidden');
        DOM.s.elements.customTypeInput.removeAttribute('required');
    } else {
        DOM.s.elements.typeSelect.value = 'Other';
        DOM.s.elements.customTypeGroup.classList.remove('hidden');
        DOM.s.elements.customTypeInput.value = exp.type;
        DOM.s.elements.customTypeInput.setAttribute('required', 'true');
    }

    document.getElementById('save-spending-btn').textContent = 'Update Expense';
    switchView('s', 'newForm');
}

function deleteExpense(id) {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    expenses = expenses.filter(exp => exp.id !== id);
    saveData('expenses');
    renderSpendingDashboard();
}

function renderSpendingDashboard() {
    const options = { month: 'long', year: 'numeric' };
    DOM.s.elements.monthDisplay.textContent = currentViewingDate.toLocaleDateString(undefined, options);

    const viewMonth = currentViewingDate.getMonth();
    const viewYear = currentViewingDate.getFullYear();

    const monthExpenses = expenses.filter(exp => {
        const d = new Date(exp.date);
        return d.getMonth() === viewMonth && d.getFullYear() === viewYear;
    });

    const monthTotal = monthExpenses.reduce((sum, exp) => sum + exp.price, 0);
    DOM.s.elements.month.textContent = '£' + monthTotal.toFixed(2);

    const thisMonthCategoryTotals = {};
    monthExpenses.forEach(exp => {
        if (!thisMonthCategoryTotals[exp.type]) thisMonthCategoryTotals[exp.type] = 0;
        thisMonthCategoryTotals[exp.type] += exp.price;
    });

    if (Object.keys(thisMonthCategoryTotals).length === 0) {
        DOM.s.elements.categoryList.innerHTML = `<p style="color:var(--text-secondary); font-size:13px; text-align: center;">No spending this month yet to break down.</p>`;
    } else {
        const sortedCategories = Object.entries(thisMonthCategoryTotals).sort((a, b) => b[1] - a[1]);
        let html = sortedCategories.map(([category, amount]) => `
            <div class="category-breakdown-item">
                <span class="category-name">${category}</span>
                <span class="category-amount">£${amount.toFixed(2)}</span>
            </div>
        `).join('');

        html += `
            <div class="category-breakdown-item category-total-row">
                <span class="category-name">Total</span>
                <span class="category-amount">£${monthTotal.toFixed(2)}</span>
            </div>
        `;
        DOM.s.elements.categoryList.innerHTML = html;
    }

    updateSpendingChart(monthExpenses, viewMonth, viewYear);

    if (monthExpenses.length === 0) {
        DOM.s.elements.list.innerHTML = `<div class="empty-state"><i class="ph ph-receipt"></i><p>No expenses logged for this month.<br>Tap + to add one!</p></div>`;
        return;
    }

    DOM.s.elements.list.innerHTML = monthExpenses.map(exp => {
        const dObj = new Date(exp.date);
        const dStr = isNaN(dObj) ? exp.date : dObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

        return `
            <div class="spending-item card">
                <div class="spending-details">
                    <span class="spending-item-name">${exp.item}</span>
                    <span class="spending-meta">
                        <span>${dStr}</span>
                        <span class="spending-type-badge">${exp.type}</span>
                    </span>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="spending-amount">£${exp.price.toFixed(2)}</div>
                </div>
                <div class="workout-actions">
                    <button class="btn btn-secondary btn-small" onclick="loadExpenseForEdit('${exp.id}')"><i class="ph ph-pencil"></i> Edit</button>
                    <button class="btn btn-danger-outline btn-small" onclick="deleteExpense('${exp.id}')"><i class="ph ph-trash"></i> Delete</button>
                </div>
            </div>`;
    }).join('');
}

function updateSpendingChart(monthExpenses, monthMonth, monthYear) {
    const cardEl = document.getElementById('spending-chart-card');
    if (!cardEl) return;

    if (monthExpenses.length === 0) {
        cardEl.classList.add('hidden');
        return;
    } else {
        cardEl.classList.remove('hidden');
    }

    const ctx = document.getElementById('spending-chart').getContext('2d');

    // Determine number of days in the month
    const daysInMonth = new Date(monthYear, monthMonth + 1, 0).getDate();
    const labels = [];
    const dataPoints = [];

    let cumulative = 0;
    const dailyTotals = new Array(daysInMonth).fill(0);

    monthExpenses.forEach(exp => {
        const d = new Date(exp.date);
        // Safely extract day
        const parts = exp.date.split('-');
        if (parts.length === 3) {
            const dayIndex = parseInt(parts[2], 10) - 1;
            dailyTotals[dayIndex] += exp.price;
        } else {
            const dayIndex = d.getDate() - 1;
            dailyTotals[dayIndex] += exp.price;
        }
    });

    const today = new Date();
    let limit = daysInMonth;
    if (today.getMonth() === monthMonth && today.getFullYear() === monthYear) {
        limit = today.getDate(); // Limit graph up to today for current month
    }

    for (let i = 0; i < limit; i++) {
        labels.push(i + 1);
        cumulative += dailyTotals[i];
        dataPoints.push(cumulative);
    }

    if (spendingChart) {
        spendingChart.data.labels = labels;
        spendingChart.data.datasets[0].data = dataPoints;
        spendingChart.update();
    } else {
        spendingChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Cumulative Spend',
                    data: dataPoints,
                    borderColor: '#00e676',
                    backgroundColor: 'rgba(0, 230, 118, 0.15)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 2,
                    pointBackgroundColor: '#00e676'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            callback: function (value) { return '£' + value; }
                        }
                    },
                    x: {
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return '£' + context.raw.toFixed(2);
                            }
                        }
                    }
                }
            }
        });
    }
}

// ==========================================
// SPENDING CUSTOM ANALYTICS
// ==========================================
function initCustomSpendingAnalytics() {
    // Populate Categories dynamically from data
    const categories = new Set();
    expenses.forEach(e => {
        if (e.type) categories.add(e.type);
    });

    // Add default options just in case they haven't been logged yet
    ['Groceries', 'Eating Out', 'Travel', 'Other'].forEach(c => categories.add(c));

    let optionsHtml = '<option value="All">All Categories</option>';
    Array.from(categories).sort().forEach(c => {
        optionsHtml += `<option value="${c}">${c}</option>`;
    });
    DOM.s.elements.customFilter.innerHTML = optionsHtml;

    // Set default dates (last + current month)
    const today = new Date();
    const startObj = new Date(today.getFullYear(), today.getMonth() - 2, 1);

    DOM.s.elements.customEndMonth.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    DOM.s.elements.customStartMonth.value = `${startObj.getFullYear()}-${String(startObj.getMonth() + 1).padStart(2, '0')}`;

    renderCustomSpendingChart();
}

function renderCustomSpendingChart() {
    const ctx = document.getElementById('spending-custom-chart').getContext('2d');

    const startStr = DOM.s.elements.customStartMonth.value;
    const endStr = DOM.s.elements.customEndMonth.value;
    const filterCat = DOM.s.elements.customFilter.value;

    if (!startStr || !endStr) return;

    const [startYear, startMonth] = startStr.split('-');
    const [endYear, endMonth] = endStr.split('-');

    const startDate = new Date(startYear, parseInt(startMonth) - 1, 1);
    const endDate = new Date(endYear, parseInt(endMonth), 0);

    const filteredExpenses = expenses.filter(e => {
        const eDate = new Date(e.date);
        const inDateRange = eDate >= startDate && eDate <= endDate;
        const matchesCategory = filterCat === 'All' || e.type === filterCat;
        return inDateRange && matchesCategory;
    });

    // Bucket by Month-Year (e.g. "Feb 2026")
    const buckets = {};

    let curr = new Date(startDate);
    while (curr <= endDate) {
        const key = curr.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
        buckets[key] = 0;
        curr.setMonth(curr.getMonth() + 1);
    }

    filteredExpenses.forEach(e => {
        const eDate = new Date(e.date);
        const key = eDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
        if (buckets[key] !== undefined) {
            buckets[key] += e.price;
        }
    });

    const labels = Object.keys(buckets);
    const dataPoints = Object.values(buckets);

    if (customSpendingChart) {
        customSpendingChart.data.labels = labels;
        customSpendingChart.data.datasets[0].data = dataPoints;
        customSpendingChart.data.datasets[0].label = filterCat === 'All' ? 'Total Spent' : `${filterCat} Spend`;
        customSpendingChart.update();
    } else {
        customSpendingChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: filterCat === 'All' ? 'Total Spent' : `${filterCat} Spend`,
                    data: dataPoints,
                    backgroundColor: 'rgba(0, 230, 118, 0.7)',
                    borderColor: '#00e676',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            callback: function (value) { return '£' + value; }
                        }
                    },
                    x: {
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { display: true, labels: { color: 'rgba(255, 255, 255, 0.7)' } },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return '£' + context.raw.toFixed(2);
                            }
                        }
                    }
                }
            }
        });
    }
}


// ==========================================
// DATA MANAGEMENT (SETTINGS)
// ==========================================

// Builds a SheetJS workbook with two sheets: Workouts and Expenses
function buildWorkbook() {
    const wb = XLSX.utils.book_new();

    // --- Workouts Sheet (one row per set) ---
    const workoutRows = [['Date', 'Muscle Group', 'Exercise', 'Set', 'Weight (kg)', 'Reps']];
    workouts.forEach(w => {
        w.exercises.forEach(ex => {
            ex.sets.forEach((s, idx) => {
                workoutRows.push([w.date, w.muscle, ex.title, idx + 1, s.weight, s.reps]);
            });
        });
    });
    const wsWorkouts = XLSX.utils.aoa_to_sheet(workoutRows);
    wsWorkouts['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 24 }, { wch: 6 }, { wch: 16 }, { wch: 6 }];
    XLSX.utils.book_append_sheet(wb, wsWorkouts, 'Workouts');

    // --- Expenses Sheet (one row per expense) ---
    const expenseRows = [['Date', 'Category', 'Item', 'Price (£)']];
    expenses.forEach(exp => {
        expenseRows.push([exp.date, exp.type, exp.item, exp.price]);
    });
    const wsExpenses = XLSX.utils.aoa_to_sheet(expenseRows);
    wsExpenses['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 30 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsExpenses, 'Expenses');

    return wb;
}

function exportData() {
    const wb = buildWorkbook();
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `PraveenApp_Backup_${dateStr}.xlsx`);
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const importedData = JSON.parse(e.target.result);

            if (importedData.workouts || importedData.expenses) {
                if (confirm('This will merge the imported data with your current data. Continue?')) {
                    if (importedData.workouts) workouts = [...importedData.workouts, ...workouts];
                    if (importedData.expenses) expenses = [...importedData.expenses, ...expenses];

                    saveData('workouts');
                    saveData('expenses');

                    alert('Backup restored successfully!');
                    location.reload();
                }
            } else {
                alert('Invalid backup file structure.');
            }
        } catch (error) {
            alert('Error reading the backup file. Make sure it is a valid JSON file.');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function clearAllData() {
    if (confirm('⚠️ WARNING: This will permanently delete all your workouts and expenses. Are you absolutely sure?')) {
        if (prompt('Type "DELETE" to confirm:') === 'DELETE') {
            localStorage.removeItem('wt_workouts');
            localStorage.removeItem('wt_expenses');
            workouts = [];
            expenses = [];
            alert('All data has been wiped.');
            location.reload();
        }
    }
}

// ==========================================
// GITHUB BACKUP
// ==========================================
const GH_BACKUP_PATH = 'data/backup.json';

function loadGitHubSettings() {
    const repo = localStorage.getItem('gh_repo') || '';
    const token = localStorage.getItem('gh_token') || '';
    DOM.settings.ghRepoInput.value = repo;
    DOM.settings.ghTokenInput.value = token;
    // Show last sync time if available
    const lastSync = localStorage.getItem('gh_last_sync');
    if (lastSync) {
        showGitHubStatus(`Last synced: ${lastSync}`, false);
    } else {
        showGitHubStatus('', false);
    }
}

function saveGitHubSettings() {
    const repo = DOM.settings.ghRepoInput.value.trim();
    const token = DOM.settings.ghTokenInput.value.trim();
    if (!repo || !token) {
        showGitHubStatus('⚠️ Please enter both a repository and a token.', true);
        return;
    }
    localStorage.setItem('gh_repo', repo);
    localStorage.setItem('gh_token', token);
    showGitHubStatus('✅ GitHub settings saved!', false);
}

function showGitHubStatus(msg, isError) {
    DOM.settings.ghStatus.textContent = msg;
    DOM.settings.ghStatus.style.color = isError
        ? 'var(--danger, #ff1744)'
        : 'var(--text-secondary, rgba(255,255,255,0.6))';
}

function setGitHubButtonsDisabled(disabled) {
    DOM.settings.ghPushBtn.disabled = disabled;
    DOM.settings.ghPullBtn.disabled = disabled;
    DOM.settings.ghSaveBtn.disabled = disabled;
}

async function pushFileToGitHub(repo, token, path, base64Content, commitMsg) {
    // Get existing SHA if file exists (needed for updates)
    let sha = null;
    const checkResp = await fetch(
        `https://api.github.com/repos/${repo}/contents/${path}`,
        { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
    );
    if (checkResp.ok) {
        sha = (await checkResp.json()).sha;
    } else if (checkResp.status !== 404) {
        const err = await checkResp.json();
        throw new Error(err.message || `HTTP ${checkResp.status}`);
    }

    const putResp = await fetch(
        `https://api.github.com/repos/${repo}/contents/${path}`,
        {
            method: 'PUT',
            headers: {
                Authorization: `token ${token}`,
                Accept: 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: commitMsg, content: base64Content, ...(sha ? { sha } : {}) })
        }
    );
    if (!putResp.ok) {
        const err = await putResp.json();
        throw new Error(err.message || `HTTP ${putResp.status}`);
    }
}

async function pushToGitHub() {
    const repo = localStorage.getItem('gh_repo');
    const token = localStorage.getItem('gh_token');

    if (!repo || !token) {
        showGitHubStatus('⚠️ Save your GitHub settings first.', true);
        return;
    }

    setGitHubButtonsDisabled(true);
    showGitHubStatus('⏳ Pushing to GitHub...', false);

    try {
        const commitMsg = `Backup: ${new Date().toISOString()}`;

        // 1. Push JSON (used for Pull/restore)
        const jsonContent = btoa(unescape(encodeURIComponent(JSON.stringify({ workouts, expenses }, null, 2))));
        await pushFileToGitHub(repo, token, GH_BACKUP_PATH, jsonContent, commitMsg);

        // 2. Push XLSX (for easy viewing in Excel / Google Sheets)
        const wb = buildWorkbook();
        const xlsxBase64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
        await pushFileToGitHub(repo, token, 'data/backup.xlsx', xlsxBase64, commitMsg);

        const now = new Date().toLocaleString();
        localStorage.setItem('gh_last_sync', now);
        showGitHubStatus(`✅ Pushed at ${now}`, false);
    } catch (err) {
        showGitHubStatus(`❌ Push failed: ${err.message}`, true);
    } finally {
        setGitHubButtonsDisabled(false);
    }
}

async function pullFromGitHub() {
    const repo = localStorage.getItem('gh_repo');
    const token = localStorage.getItem('gh_token');

    if (!repo || !token) {
        showGitHubStatus('⚠️ Save your GitHub settings first.', true);
        return;
    }

    setGitHubButtonsDisabled(true);
    showGitHubStatus('⏳ Pulling from GitHub...', false);

    try {
        const resp = await fetch(
            `https://api.github.com/repos/${repo}/contents/${GH_BACKUP_PATH}`,
            { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
        );

        if (!resp.ok) {
            if (resp.status === 404) throw new Error('No backup file found in repo yet. Push first.');
            const err = await resp.json();
            throw new Error(err.message || `HTTP ${resp.status}`);
        }

        const file = await resp.json();
        const decoded = decodeURIComponent(escape(atob(file.content.replace(/\n/g, ''))));
        const importedData = JSON.parse(decoded);

        if (!importedData.workouts && !importedData.expenses) {
            throw new Error('Invalid backup structure in the file.');
        }

        if (!confirm('⬇️ This will REPLACE your local data with the GitHub backup. Continue?')) {
            showGitHubStatus('Pull cancelled.', false);
            setGitHubButtonsDisabled(false);
            return;
        }

        if (importedData.workouts) {
            workouts = importedData.workouts;
            saveData('workouts');
        }
        if (importedData.expenses) {
            expenses = importedData.expenses;
            saveData('expenses');
        }

        const now = new Date().toLocaleString();
        localStorage.setItem('gh_last_sync', now);
        showGitHubStatus(`✅ Pulled at ${now} — reloading...`, false);
        setTimeout(() => location.reload(), 1200);
    } catch (err) {
        showGitHubStatus(`❌ Pull failed: ${err.message}`, true);
        setGitHubButtonsDisabled(false);
    }
}

// Boot
init();