// ==========================================
// STATE MANAGEMENT & VERSIONING
// ==========================================
const APP_VERSION = '1.2.1-IDB'; // Heartbeat update for push

let workouts = [];
let expenses = [];
let shoppingItems = [];
let travels = [];
let editingTravelId = null;
let currentViewingDate = new Date();

let workoutsChart = null;
let spendingChart = null;
let customWorkoutsChart = null;
let customSpendingChart = null;
let customShoppingChart = null;
let travelGlobe = null;

// IndexedDB State
const DB_NAME = 'PraveenFitnessDB';
const DB_VERSION = 1;
const STORE_NAME = 'travel_images';
let db = null;

// Initialize IndexedDB
async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error("Database error: " + event.target.errorCode);
            reject(event.target.errorCode);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log("Database initialized successfully");
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
}

// Image Utility Functions
async function saveImageToDB(id, blob) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(blob, id);
        request.onsuccess = () => resolve(id);
        request.onerror = () => reject(request.error);
    });
}

async function getImageFromDB(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function deleteImageFromDB(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

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
// UTILITY FUNCTIONS
// ==========================================
function toTitleCase(str) {
    if (!str) return '';
    return str.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

// Parses a YYYY-MM-DD date string as LOCAL time (avoids UTC off-by-one day bug)
// Also handles dd/mm/yyyy display format
function parseLocalDate(dateStr) {
    if (!dateStr) return new Date(NaN);
    // Handle dd/mm/yyyy format
    if (dateStr.includes('/')) {
        const [d, m, y] = dateStr.split('/').map(Number);
        return new Date(y, m - 1, d);
    }
    // Handle YYYY-MM-DD format
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
}

// Converts YYYY-MM-DD to dd/mm/yyyy (for display in text inputs)
function isoToDisplayDate(isoStr) {
    if (!isoStr) return '';
    if (isoStr.includes('/')) return isoStr; // already display format
    const [y, m, d] = isoStr.split('-');
    if (!y || !m || !d) return isoStr;
    return `${d}/${m}/${y}`;
}

// Converts dd/mm/yyyy to YYYY-MM-DD (for internal storage)
function displayDateToISO(displayStr) {
    if (!displayStr) return '';
    if (!displayStr.includes('/')) return displayStr; // assume already ISO
    const [d, m, y] = displayStr.split('/');
    if (!d || !m || !y) return displayStr;
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
}

// Initializes Flatpickr on a date text input (d/m/Y format)
function initFlatpickr(inputEl) {
    if (!inputEl || inputEl._flatpickr) return;
    return flatpickr(inputEl, {
        dateFormat: "d/m/Y",
        allowInput: true,
        disableMobile: "true"
    });
}

// ==========================================
// AUTO-DRAFT HELPERS
// ==========================================
const DRAFT_KEYS = {
    workout: 'wt_draft_workout',
    expense: 'wt_draft_expense',
    shopping: 'wt_draft_shopping',
    travel: 'wt_draft_travel'
};

function saveDraftWorkout() {
    try {
        const muscleEl = document.getElementById('muscle-group');
        const dayEl = DOM.w.elements.dayInput;
        const exercises = [];
        document.querySelectorAll('.exercise-block').forEach(block => {
            const title = block.querySelector('.exercise-title-input').value;
            const sets = Array.from(block.querySelectorAll('.set-row')).map(row => ({
                weight: row.querySelector('.set-weight').value,
                reps: row.querySelector('.set-reps').value
            }));
            exercises.push({ title, sets });
        });
        const draft = {
            date: dayEl ? dayEl.value : '',
            muscle: muscleEl ? muscleEl.value : '',
            exercises
        };
        localStorage.setItem(DRAFT_KEYS.workout, JSON.stringify(draft));
    } catch (e) { /* ignore */ }
}

function restoreDraftWorkout() {
    try {
        const raw = localStorage.getItem(DRAFT_KEYS.workout);
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (!draft) return;
        if (draft.date && DOM.w.elements.dayInput) DOM.w.elements.dayInput.value = isoToDisplayDate(draft.date);
        const muscleEl = document.getElementById('muscle-group');
        if (draft.muscle && muscleEl) muscleEl.value = draft.muscle;
        if (draft.exercises && draft.exercises.length) {
            DOM.w.elements.container.innerHTML = '';
            draft.exercises.forEach(ex => addExerciseBlock(ex));
        }
    } catch (e) { /* ignore */ }
}

function clearDraftWorkout() {
    localStorage.removeItem(DRAFT_KEYS.workout);
}

function saveDraftExpense() {
    try {
        const draft = {
            date: DOM.s.elements.dateInput ? DOM.s.elements.dateInput.value : '',
            type: document.getElementById('expense-type') ? document.getElementById('expense-type').value : '',
            customType: document.getElementById('custom-category-input') ? document.getElementById('custom-category-input').value : '',
            item: document.getElementById('expense-item') ? document.getElementById('expense-item').value : '',
            price: document.getElementById('expense-price') ? document.getElementById('expense-price').value : ''
        };
        localStorage.setItem(DRAFT_KEYS.expense, JSON.stringify(draft));
    } catch (e) { /* ignore */ }
}

function restoreDraftExpense() {
    try {
        const raw = localStorage.getItem(DRAFT_KEYS.expense);
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (!draft) return;
        if (draft.date && DOM.s.elements.dateInput) DOM.s.elements.dateInput.value = isoToDisplayDate(draft.date);
        const typeEl = document.getElementById('expense-type');
        if (draft.type && typeEl) {
            typeEl.value = draft.type;
            if (draft.type === 'Other') {
                DOM.s.elements.customTypeGroup.classList.remove('hidden');
                DOM.s.elements.customTypeInput.setAttribute('required', 'true');
                if (draft.customType) DOM.s.elements.customTypeInput.value = draft.customType;
            }
        }
        const itemEl = document.getElementById('expense-item');
        if (draft.item && itemEl) itemEl.value = draft.item;
        const priceEl = document.getElementById('expense-price');
        if (draft.price && priceEl) priceEl.value = draft.price;
    } catch (e) { /* ignore */ }
}

function clearDraftExpense() {
    localStorage.removeItem(DRAFT_KEYS.expense);
}

// ==========================================
// DOM ELEMENTS
// ==========================================
const DOM = {
    // Navigation
    navBtnWorkouts: document.getElementById('nav-btn-workouts'),
    navBtnSpending: document.getElementById('nav-btn-spending'),
    navBtnShopping: document.getElementById('nav-btn-shopping'),
    navBtnTravel: document.getElementById('nav-btn-travel'),
    rootWorkouts: document.getElementById('root-workouts'),
    rootSpending: document.getElementById('root-spending'),
    rootShopping: document.getElementById('root-shopping'),
    rootTravel: document.getElementById('root-travel'),

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
            muscleInput: document.getElementById('muscle-group'),
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

    // Shopping App
    sh: {
        views: {
            dashboard: document.getElementById('view-shopping-dashboard'),
            newForm: document.getElementById('view-new-shopping')
        },
        btns: {
            add: document.getElementById('add-shopping-btn'),
            back: document.getElementById('shopping-back-btn')
        },
        elements: {
            title: document.getElementById('shopping-header-title'),
            list: document.getElementById('shopping-list'),
            form: document.getElementById('shopping-form'),
            total: document.getElementById('shopping-total-stat'),
            nameInput: document.getElementById('shopping-item-name'),
            // Custom Analytics
            btnOverview: document.getElementById('btn-overview-shopping'),
            btnAnalytics: document.getElementById('btn-analytics-shopping'),
            secOverview: document.getElementById('shopping-overview-section'),
            secAnalytics: document.getElementById('shopping-analytics-section'),
            customStartDate: document.getElementById('shopping-start-date'),
            customEndDate: document.getElementById('shopping-end-date'),
            customFilter: document.getElementById('shopping-filter-select')
        }
    },

    // Travel App
    t: {
        views: {
            dashboard: document.getElementById('travel-timeline'),
            newForm: document.getElementById('view-new-travel')
        },
        btns: {
            add: document.getElementById('add-travel-btn'),
            back: document.getElementById('travel-back-btn')
        },
        elements: {
            title: document.getElementById('travel-header-title'),
            form: document.getElementById('travel-form'),
            timeline: document.getElementById('travel-timeline'),
            nameInput: document.getElementById('travel-location-name'),
            fromDateInput: document.getElementById('travel-from-date'),
            toDateInput: document.getElementById('travel-to-date'),
            latInput: document.getElementById('travel-lat'),
            lngInput: document.getElementById('travel-lng'),
            photoInput: document.getElementById('travel-photos'),
            photoPreview: document.getElementById('photo-preview-strip'),
            experienceInput: document.getElementById('travel-experience'),
            suggestions: document.getElementById('location-suggestions')
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
async function init() {
    await initDB();
    loadData();
    setupEventListeners();
    renderWorkoutsDashboard();
    renderSpendingDashboard();
    renderShoppingDashboard();
    updateWorkoutDatalists();
}

function loadData() {
    try {
        const savedWorkouts = localStorage.getItem('wt_workouts');
        if (savedWorkouts) workouts = JSON.parse(savedWorkouts);

        const savedExpenses = localStorage.getItem('wt_expenses');
        if (savedExpenses) expenses = JSON.parse(savedExpenses);

        const savedShopping = localStorage.getItem('wt_shopping');
        if (savedShopping) shoppingItems = JSON.parse(savedShopping);

        const savedTravels = localStorage.getItem('wt_travels');
        if (savedTravels) travels = JSON.parse(savedTravels);
    } catch (err) {
        console.error('Data Loading Error:', err);
    }
}

function saveData(type) {
    if (type === 'workouts') localStorage.setItem('wt_workouts', JSON.stringify(workouts));
    if (type === 'expenses') localStorage.setItem('wt_expenses', JSON.stringify(expenses));
    if (type === 'shopping') localStorage.setItem('wt_shopping', JSON.stringify(shoppingItems));
    if (type === 'travels') localStorage.setItem('wt_travels', JSON.stringify(travels));
    
    // Auto-sync to GitHub if configured
    const ghRepo = localStorage.getItem('gh_repo');
    const ghToken = localStorage.getItem('gh_token');
    if (ghRepo && ghToken && typeof pushToGitHub === 'function') {
        // Run silently in the background
        pushToGitHub(true);
    }
}

// ==========================================
// APP NAVIGATION (ROOT LEVEL)
// ==========================================
function switchApp(appType) {
    DOM.settings.root.classList.add('hidden');
    DOM.settings.root.classList.remove('active');

    // Remove active from all nav buttons
    DOM.navBtnWorkouts.classList.remove('active');
    DOM.navBtnSpending.classList.remove('active');
    DOM.navBtnShopping.classList.remove('active');
    DOM.navBtnTravel.classList.remove('active');

    // Hide all roots
    DOM.rootWorkouts.classList.remove('active');
    DOM.rootWorkouts.classList.add('hidden');
    DOM.rootSpending.classList.remove('active');
    DOM.rootSpending.classList.add('hidden');
    DOM.rootShopping.classList.remove('active');
    DOM.rootShopping.classList.add('hidden');
    DOM.rootTravel.classList.remove('active');
    DOM.rootTravel.classList.add('hidden');

    if (DOM.loadingOverlay) DOM.loadingOverlay.classList.add('hidden');

    if (appType === 'workouts') {
        DOM.navBtnWorkouts.classList.add('active');
        DOM.rootWorkouts.classList.add('active');
        DOM.rootWorkouts.classList.remove('hidden');
    } else if (appType === 'spending') {
        DOM.navBtnSpending.classList.add('active');
        DOM.rootSpending.classList.add('active');
        DOM.rootSpending.classList.remove('hidden');
    } else if (appType === 'shopping') {
        DOM.navBtnShopping.classList.add('active');
        DOM.rootShopping.classList.add('active');
        DOM.rootShopping.classList.remove('hidden');
    } else if (appType === 'travel') {
        DOM.navBtnTravel.classList.add('active');
        DOM.rootTravel.classList.add('active');
        DOM.rootTravel.classList.remove('hidden');
        if (!travelGlobe) {
            initTravelGlobe();
        } else {
            renderTravelDashboard();
            // Trigger a resize to ensure canvas fits
            window.dispatchEvent(new Event('resize'));
        }
    }
}

// ==========================================
// INNER VIEW NAVIGATION
// ==========================================
function switchView(app, viewName) {
    const d = DOM[app];

    // Travel specific overlay logic is now integrated below

    // Hide all views for this app
    if (d.views) {
        Object.values(d.views).forEach(v => {
            if (v) {
                v.classList.remove('active');
                if (!v.classList.contains('hidden')) v.classList.add('hidden');
            }
        });
    }

    // Show target view
    if (d.views && d.views[viewName]) {
        d.views[viewName].classList.remove('hidden');
        d.views[viewName].classList.add('active');
    }

    // Handle settings button visibility
    const rootSelector = `#root-${app === 'w' ? 'workouts' : app === 's' ? 'spending' : app === 'sh' ? 'shopping' : 'travel'}`;
    const gearBtn = document.querySelector(`${rootSelector} .settings-btn`);

    if (viewName === 'newForm') {
        d.elements.title.textContent = app === 'w' ? 'New Workout' : app === 's' ? 'New Expense' : app === 'sh' ? 'New Item' : 'New Footprint';
        d.btns.add.classList.add('hidden');
        if (gearBtn) gearBtn.classList.add('hidden');
        d.btns.back.classList.remove('hidden');

        // Setup defaults
        const today = isoToDisplayDate(new Date().toISOString().split('T')[0]);
        initFlatpickr(d.elements.dayInput);
        initFlatpickr(d.elements.dateInput);
        if (app === 'w') {
            if (!editingWorkoutId) {
                // Try to restore draft first, otherwise set defaults
                const hasDraft = !!localStorage.getItem(DRAFT_KEYS.workout);
                if (d.elements.container.innerHTML.trim() === '') {
                    if (hasDraft) {
                        restoreDraftWorkout();
                    } else {
                        addExerciseBlock();
                        d.elements.dayInput.value = today;
                    }
                }
                // Attach auto-draft listeners (using debounce)
                setupWorkoutDraftListeners();
            } else {
                d.elements.dayInput.value = d.elements.dayInput.value || today;
            }
        } else if (app === 's') {
            // Only reset to defaults if NOT editing
            if (!editingExpenseId) {
                const hasDraft = !!localStorage.getItem(DRAFT_KEYS.expense);
                if (hasDraft) {
                    restoreDraftExpense();
                } else {
                    d.elements.dateInput.value = today;
                    DOM.s.elements.typeSelect.value = 'Groceries';
                    DOM.s.elements.customTypeGroup.classList.add('hidden');
                    DOM.s.elements.customTypeInput.value = '';
                    DOM.s.elements.customTypeInput.removeAttribute('required');
                }
                setupExpenseDraftListeners();
            } else {
                // If editing, update the title
                d.elements.title.textContent = 'Edit Expense';
            }
        } else if (app === 'sh') {
            if (!editingShoppingId) {
                const hasDraft = !!localStorage.getItem(DRAFT_KEYS.shopping);
                if (hasDraft) {
                    restoreDraftShopping();
                } else {
                    d.elements.nameInput.value = '';
                }
                setupShoppingDraftListeners();
            } else {
                d.elements.title.textContent = 'Edit Item';
            }
        } else if (app === 't') {
            if (!editingTravelId) {
                const hasDraft = !!localStorage.getItem(DRAFT_KEYS.travel);
                if (hasDraft) {
                    restoreDraftTravel();
                } else {
                    d.elements.nameInput.value = '';
                    d.elements.fromDateInput.value = today;
                    d.elements.toDateInput.value = '';
                    d.elements.latInput.value = '';
                    d.elements.lngInput.value = '';
                    d.elements.experienceInput.value = '';
                    d.elements.photoInput.value = '';
                    d.elements.photoPreview.innerHTML = '';
                }
                setupTravelDraftListeners();
            } else {
                d.elements.title.textContent = 'Edit Footprint';
            }
        }
    } else {
        d.elements.title.textContent = app === 'w' ? "Praveen's Workouts"
            : app === 's' ? "Praveen's Spending"
                : app === 'sh' ? "Shopping List"
                    : "Praveen's Travels";
        d.btns.add.classList.remove('hidden');
        if (gearBtn) gearBtn.classList.remove('hidden');
        d.btns.back.classList.add('hidden');

        if (app === 'w') { editingWorkoutId = null; renderWorkoutsDashboard(); }
        if (app === 's') { editingExpenseId = null; renderSpendingDashboard(); }
        if (app === 'sh') { editingShoppingId = null; renderShoppingDashboard(); }
        if (app === 't') { editingTravelId = null; renderTravelDashboard(); }
    }
}

// ==========================================
// EVENT LISTENERS
// ==========================================
function setupEventListeners() {
    try {
        // Root App Nav
        if (DOM.navBtnWorkouts) DOM.navBtnWorkouts.addEventListener('click', () => switchApp('workouts'));
        if (DOM.navBtnSpending) DOM.navBtnSpending.addEventListener('click', () => switchApp('spending'));
        if (DOM.navBtnShopping) DOM.navBtnShopping.addEventListener('click', () => switchApp('shopping'));
        if (DOM.navBtnTravel) DOM.navBtnTravel.addEventListener('click', () => switchApp('travel'));

        // Workouts Navigation
        if (DOM.w.btns.add) DOM.w.btns.add.addEventListener('click', () => switchView('w', 'newForm'));
        if (DOM.w.btns.back) DOM.w.btns.back.addEventListener('click', () => switchView('w', 'dashboard'));

        // Spending Navigation
        if (DOM.s.btns.add) DOM.s.btns.add.addEventListener('click', () => switchView('s', 'newForm'));
        if (DOM.s.btns.back) DOM.s.btns.back.addEventListener('click', () => switchView('s', 'dashboard'));

        // Shopping Navigation
        if (DOM.sh.btns.add) DOM.sh.btns.add.addEventListener('click', () => switchView('sh', 'newForm'));
        if (DOM.sh.btns.back) DOM.sh.btns.back.addEventListener('click', () => switchView('sh', 'dashboard'));
        if (DOM.sh.elements.form) DOM.sh.elements.form.addEventListener('submit', handleSaveShopping);

        // Travel Navigation
        if (DOM.t && DOM.t.btns.add) DOM.t.btns.add.addEventListener('click', () => switchView('t', 'newForm'));
        if (DOM.t && DOM.t.btns.back) DOM.t.btns.back.addEventListener('click', () => switchView('t', 'dashboard'));
        if (DOM.t && DOM.t.elements.form) DOM.t.elements.form.addEventListener('submit', handleSaveTravelLocation);

        // Travel Live Search
        if (DOM.t && DOM.t.elements.nameInput) {
            let timeout = null;
            DOM.t.elements.nameInput.addEventListener('input', (e) => {
                clearTimeout(timeout);
                const query = e.target.value.trim();
                if (query.length < 3) {
                    DOM.t.elements.suggestions.classList.add('hidden');
                    return;
                }
                timeout = setTimeout(() => searchLocations(query), 500);
            });

            // Close suggestions on blur (with delay to allow clicking)
            DOM.t.elements.nameInput.addEventListener('blur', () => {
                setTimeout(() => DOM.t.elements.suggestions.classList.add('hidden'), 200);
            });
        }

        // Workouts Form Actions
        if (DOM.w.btns.addEx) DOM.w.btns.addEx.addEventListener('click', addExerciseBlock);
        if (DOM.w.elements.muscleInput) {
            DOM.w.elements.muscleInput.addEventListener('input', (e) => {
                const val = e.target.value.trim();
                updateWorkoutDatalists(val || null);
            });
        }
        if (DOM.w.elements.form) DOM.w.elements.form.addEventListener('submit', handleSaveWorkout);

        // Spending Form Actions
        if (DOM.s.elements.form) DOM.s.elements.form.addEventListener('submit', handleSaveExpense);

        // Month Navigation
        if (DOM.s.elements.prevMonthBtn) {
            DOM.s.elements.prevMonthBtn.addEventListener('click', () => {
                currentViewingDate.setMonth(currentViewingDate.getMonth() - 1);
                renderSpendingDashboard();
            });
        }
        if (DOM.s.elements.nextMonthBtn) {
            DOM.s.elements.nextMonthBtn.addEventListener('click', () => {
                currentViewingDate.setMonth(currentViewingDate.getMonth() + 1);
                renderSpendingDashboard();
            });
        }

        // Custom Analytics Toggles & Inputs
        if (DOM.w.elements.btnOverview) {
            DOM.w.elements.btnOverview.addEventListener('click', () => {
                DOM.w.elements.secOverview.classList.remove('hidden');
                DOM.w.elements.secAnalytics.classList.add('hidden');
                DOM.w.elements.btnOverview.classList.add('active');
                DOM.w.elements.btnAnalytics.classList.remove('active');
            });
        }
        if (DOM.w.elements.btnAnalytics) {
            DOM.w.elements.btnAnalytics.addEventListener('click', () => {
                DOM.w.elements.secOverview.classList.add('hidden');
                DOM.w.elements.secAnalytics.classList.remove('hidden');
                DOM.w.elements.btnOverview.classList.remove('active');
                DOM.w.elements.btnAnalytics.classList.add('active');
                initCustomWorkoutsAnalytics();
            });
        }

        if (DOM.s.elements.btnOverview) {
            DOM.s.elements.btnOverview.addEventListener('click', () => {
                DOM.s.elements.secOverview.classList.remove('hidden');
                DOM.s.elements.secAnalytics.classList.add('hidden');
                DOM.s.elements.btnOverview.classList.add('active');
                DOM.s.elements.btnAnalytics.classList.remove('active');
            });
        }
        if (DOM.s.elements.btnAnalytics) {
            DOM.s.elements.btnAnalytics.addEventListener('click', () => {
                DOM.s.elements.secOverview.classList.add('hidden');
                DOM.s.elements.secAnalytics.classList.remove('hidden');
                DOM.s.elements.btnOverview.classList.remove('active');
                DOM.s.elements.btnAnalytics.classList.add('active');
                initCustomSpendingAnalytics();
            });
        }

        // Event listeners to redraw charts on input change
        if (DOM.w.elements.customStartWeek) {
            initFlatpickr(DOM.w.elements.customStartWeek);
            DOM.w.elements.customStartWeek.addEventListener('input', () => renderCustomWorkoutsChart());
        }
        if (DOM.w.elements.customEndWeek) {
            initFlatpickr(DOM.w.elements.customEndWeek);
            DOM.w.elements.customEndWeek.addEventListener('input', () => renderCustomWorkoutsChart());
        }
        if (DOM.w.elements.customFilter) DOM.w.elements.customFilter.addEventListener('change', updateExerciseDropdown);
        if (DOM.w.elements.customExercise) DOM.w.elements.customExercise.addEventListener('change', renderCustomWorkoutsChart);

        if (DOM.s.elements.customStartMonth) DOM.s.elements.customStartMonth.addEventListener('change', renderCustomSpendingChart);
        if (DOM.s.elements.customEndMonth) DOM.s.elements.customEndMonth.addEventListener('change', renderCustomSpendingChart);
        if (DOM.s.elements.customFilter) DOM.s.elements.customFilter.addEventListener('change', renderCustomSpendingChart);

        if (DOM.sh.elements.btnOverview) {
            DOM.sh.elements.btnOverview.addEventListener('click', () => {
                DOM.sh.elements.secOverview.classList.remove('hidden');
                DOM.sh.elements.secAnalytics.classList.add('hidden');
                DOM.sh.elements.btnOverview.classList.add('active');
                DOM.sh.elements.btnAnalytics.classList.remove('active');
            });
        }
        if (DOM.sh.elements.btnAnalytics) {
            DOM.sh.elements.btnAnalytics.addEventListener('click', () => {
                DOM.sh.elements.secOverview.classList.add('hidden');
                DOM.sh.elements.secAnalytics.classList.remove('hidden');
                DOM.sh.elements.btnOverview.classList.remove('active');
                DOM.sh.elements.btnAnalytics.classList.add('active');
                initCustomShoppingAnalytics();
            });
        }

        if (DOM.sh.elements.customStartDate) {
            initFlatpickr(DOM.sh.elements.customStartDate);
            DOM.sh.elements.customStartDate.addEventListener('input', renderCustomShoppingChart);
        }
        if (DOM.sh.elements.customEndDate) {
            initFlatpickr(DOM.sh.elements.customEndDate);
            DOM.sh.elements.customEndDate.addEventListener('input', renderCustomShoppingChart);
        }
        if (DOM.sh.elements.customFilter) DOM.sh.elements.customFilter.addEventListener('change', renderCustomShoppingChart);

        // Settings Navigation
        if (DOM.settings.btns) {
            DOM.settings.btns.forEach(btn => {
                btn.addEventListener('click', () => {
                    if (DOM.rootWorkouts) DOM.rootWorkouts.classList.add('hidden');
                    if (DOM.rootSpending) DOM.rootSpending.classList.add('hidden');
                    if (DOM.rootShopping) DOM.rootShopping.classList.add('hidden');
                    if (DOM.rootTravel) DOM.rootTravel.classList.add('hidden');
                    if (DOM.settings.root) {
                        DOM.settings.root.classList.remove('hidden');
                        DOM.settings.root.classList.add('active');
                    }
                    loadGitHubSettings();
                });
            });
        }

        if (DOM.settings.backBtn) {
            DOM.settings.backBtn.addEventListener('click', () => {
                if (DOM.settings.root) {
                    DOM.settings.root.classList.add('hidden');
                    DOM.settings.root.classList.remove('active');
                }
                if (DOM.navBtnWorkouts && DOM.navBtnWorkouts.classList.contains('active')) {
                    if (DOM.rootWorkouts) DOM.rootWorkouts.classList.remove('hidden');
                } else if (DOM.navBtnSpending && DOM.navBtnSpending.classList.contains('active')) {
                    if (DOM.rootSpending) DOM.rootSpending.classList.remove('hidden');
                } else if (DOM.navBtnShopping && DOM.navBtnShopping.classList.contains('active')) {
                    if (DOM.rootShopping) DOM.rootShopping.classList.remove('hidden');
                } else if (DOM.navBtnTravel && DOM.navBtnTravel.classList.contains('active')) {
                    if (DOM.rootTravel) DOM.rootTravel.classList.remove('hidden');
                }
            });
        }

        // Data Management Actions
        if (DOM.settings.exportBtn) DOM.settings.exportBtn.addEventListener('click', exportData);
        if (DOM.settings.importBtn) DOM.settings.importBtn.addEventListener('click', () => DOM.settings.fileInput.click());
        if (DOM.settings.fileInput) DOM.settings.fileInput.addEventListener('change', importData);
        if (DOM.settings.clearBtn) DOM.settings.clearBtn.addEventListener('click', clearAllData);

        // GitHub Backup Actions
        if (DOM.settings.ghSaveBtn) DOM.settings.ghSaveBtn.addEventListener('click', saveGitHubSettings);
        if (DOM.settings.ghPushBtn) DOM.settings.ghPushBtn.addEventListener('click', pushToGitHub);
        if (DOM.settings.ghPullBtn) DOM.settings.ghPullBtn.addEventListener('click', pullFromGitHub);

        // Travel Photo Preview Logic (moved and hardened)
        if (DOM.t && DOM.t.elements.photoInput) {
            DOM.t.elements.photoInput.addEventListener('change', (e) => {
                if (DOM.t.elements.photoPreview) DOM.t.elements.photoPreview.innerHTML = '';
                const files = Array.from(e.target.files);
                files.forEach(file => {
                    const reader = new FileReader();
                    reader.onload = (re) => {
                        const img = document.createElement('img');
                        img.src = re.target.result;
                        img.className = 'preview-thumb';
                        if (DOM.t.elements.photoPreview) DOM.t.elements.photoPreview.appendChild(img);
                    };
                    reader.readAsDataURL(file);
                });
            });
        }

        // Spending "Other" category toggle logic
        if (DOM.s && DOM.s.elements.typeSelect) {
            DOM.s.elements.typeSelect.addEventListener('change', (e) => {
                if (e.target.value === 'Other') {
                    if (DOM.s.elements.customTypeGroup) DOM.s.elements.customTypeGroup.classList.remove('hidden');
                    if (DOM.s.elements.customTypeInput) DOM.s.elements.customTypeInput.setAttribute('required', 'true');
                } else {
                    if (DOM.s.elements.customTypeGroup) DOM.s.elements.customTypeGroup.classList.add('hidden');
                    if (DOM.s.elements.customTypeInput) DOM.s.elements.customTypeInput.removeAttribute('required');
                }
            });
        }
    } catch (err) {
        console.error('CRITICAL: Event Listener Setup Failed:', err);
    }
}

// Draft listener setup (idempotent — uses a flag to avoid duplicates)
let _workoutDraftListenersAttached = false;
function setupWorkoutDraftListeners() {
    if (_workoutDraftListenersAttached) return;
    _workoutDraftListenersAttached = true;
    const form = DOM.w.elements.form;
    if (form) form.addEventListener('input', saveDraftWorkout);
    // Also listen for dynamic exercise blocks added later
    const container = DOM.w.elements.container;
    if (container) {
        new MutationObserver(() => {
            // Re-attach input listeners to any new set rows
            container.querySelectorAll('.set-input, .exercise-title-input').forEach(el => {
                el.removeEventListener('input', saveDraftWorkout);
                el.addEventListener('input', saveDraftWorkout);
            });
        }).observe(container, { childList: true, subtree: true });
    }
}

let _expenseDraftListenersAttached = false;
function setupExpenseDraftListeners() {
    if (_expenseDraftListenersAttached) return;
    _expenseDraftListenersAttached = true;
    const form = DOM.s.elements.form;
    if (form) form.addEventListener('input', saveDraftExpense);
}

// Shopping Draft Logic
function saveDraftShopping() {
    try {
        const draft = {
            name: DOM.sh.elements.nameInput ? DOM.sh.elements.nameInput.value : ''
        };
        localStorage.setItem(DRAFT_KEYS.shopping, JSON.stringify(draft));
    } catch (e) { /* ignore */ }
}

function restoreDraftShopping() {
    try {
        const raw = localStorage.getItem(DRAFT_KEYS.shopping);
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (draft.name && DOM.sh.elements.nameInput) DOM.sh.elements.nameInput.value = draft.name;
    } catch (e) { /* ignore */ }
}

function clearDraftShopping() {
    localStorage.removeItem(DRAFT_KEYS.shopping);
}

let _shoppingDraftListenersAttached = false;
function setupShoppingDraftListeners() {
    if (_shoppingDraftListenersAttached) return;
    _shoppingDraftListenersAttached = true;
    const form = DOM.sh.elements.form;
    if (form) form.addEventListener('input', saveDraftShopping);
}

// Travel Draft Logic
function saveDraftTravel() {
    try {
        const draft = {
            name: DOM.t.elements.nameInput ? DOM.t.elements.nameInput.value : '',
            from: DOM.t.elements.fromDateInput ? DOM.t.elements.fromDateInput.value : '',
            to: DOM.t.elements.toDateInput ? DOM.t.elements.toDateInput.value : '',
            lat: DOM.t.elements.latInput ? DOM.t.elements.latInput.value : '',
            lng: DOM.t.elements.lngInput ? DOM.t.elements.lngInput.value : '',
            experience: DOM.t.elements.experienceInput ? DOM.t.elements.experienceInput.value : ''
        };
        localStorage.setItem(DRAFT_KEYS.travel, JSON.stringify(draft));
    } catch (e) { /* ignore */ }
}

function restoreDraftTravel() {
    try {
        const raw = localStorage.getItem(DRAFT_KEYS.travel);
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (draft.name && DOM.t.elements.nameInput) DOM.t.elements.nameInput.value = draft.name;
        if (draft.from && DOM.t.elements.fromDateInput) DOM.t.elements.fromDateInput.value = draft.from;
        if (draft.to && DOM.t.elements.toDateInput) DOM.t.elements.toDateInput.value = draft.to;
        if (draft.lat && DOM.t.elements.latInput) DOM.t.elements.latInput.value = draft.lat;
        if (draft.lng && DOM.t.elements.lngInput) DOM.t.elements.lngInput.value = draft.lng;
        if (draft.experience && DOM.t.elements.experienceInput) DOM.t.elements.experienceInput.value = draft.experience;
    } catch (e) { /* ignore */ }
}

function clearDraftTravel() {
    localStorage.removeItem(DRAFT_KEYS.travel);
}

function updateWorkoutDatalists(filterMuscle = null) {
    const muscleGroups = new Set();
    const exerciseNames = new Set();

    workouts.forEach(w => {
        if (w.muscle) {
            const m = toTitleCase(w.muscle.trim());
            muscleGroups.add(m);
            
            // Only add exercises if no filter is provided OR if they match the filtered muscle
            if (w.exercises && (!filterMuscle || m.toLowerCase() === filterMuscle.toLowerCase())) {
                w.exercises.forEach(ex => {
                    if (ex.title) exerciseNames.add(toTitleCase(ex.title.trim()));
                });
            }
        }
    });

    const muscleDatalist = document.getElementById('muscle-group-datalist');
    const exerciseDatalist = document.getElementById('exercise-name-datalist');

    if (muscleDatalist) {
        muscleDatalist.innerHTML = Array.from(muscleGroups).sort().map(g => `<option value="${g}">`).join('');
    }
    if (exerciseDatalist) {
        exerciseDatalist.innerHTML = Array.from(exerciseNames).sort().map(e => `<option value="${e}">`).join('');
    }
}

let _travelDraftListenersAttached = false;
function setupTravelDraftListeners() {
    if (_travelDraftListenersAttached) return;
    _travelDraftListenersAttached = true;
    const form = DOM.t.elements.form;
    if (form) form.addEventListener('input', saveDraftTravel);
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
            <input type="text" class="exercise-title-input" placeholder="Exercise Name" required value="${exerciseData ? (exerciseData.title || '') : ''}" list="exercise-name-datalist">
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
            <input type="number" class="set-input set-weight" placeholder="100" required step="0.1" inputmode="decimal" value="${setData ? setData.weight : ''}">
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
        const titleRaw = block.querySelector('.exercise-title-input').value.trim();
        const title = toTitleCase(titleRaw);

        const sets = Array.from(block.querySelectorAll('.set-row')).map(row => ({
            weight: parseFloat(row.querySelector('.set-weight').value),
            reps: parseInt(row.querySelector('.set-reps').value, 10)
        })).filter(s => !isNaN(s.weight) && !isNaN(s.reps));
        if (title && sets.length) exercises.push({ title, sets });
    });

    DOM.loadingOverlay.classList.remove('hidden');
    setTimeout(() => {
        const muscleGroup = toTitleCase(document.getElementById('muscle-group').value.trim());

        if (editingWorkoutId) {
            // Edit existing workout
            const idx = workouts.findIndex(w => w.id === editingWorkoutId);
            if (idx !== -1) {
                workouts[idx].date = displayDateToISO(DOM.w.elements.dayInput.value);
                workouts[idx].muscle = muscleGroup;
                workouts[idx].exercises = exercises;
            }
            editingWorkoutId = null;
        } else {
            // Create new workout
            const newWorkout = {
                id: Date.now().toString(),
                date: displayDateToISO(DOM.w.elements.dayInput.value),
                muscle: muscleGroup,
                exercises
            };
            workouts.unshift(newWorkout);
        }
        workouts.sort((a, b) => parseLocalDate(b.date) - parseLocalDate(a.date));
        saveData('workouts');
        updateWorkoutDatalists();
        clearDraftWorkout();
        _workoutDraftListenersAttached = false;
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
    DOM.w.elements.dayInput.value = isoToDisplayDate(w.date);
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
    DOM.w.elements.week.textContent = workouts.filter(w => parseLocalDate(w.date) >= oneWeekAgo).length;

    updateWorkoutsChart();

    if (workouts.length === 0) {
        DOM.w.elements.list.innerHTML = `<div class="empty-state"><i class="ph ph-barbell"></i><p>No workouts yet.<br>Tap + to start tracking!</p></div>`;
        return;
    }

    DOM.w.elements.list.innerHTML = workouts.map(w => {
        const dObj = parseLocalDate(w.date);
        const dStr = isNaN(dObj) ? w.date : dObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const totalSets = w.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
        
        let detailsHtml = w.exercises.map(ex => {
            let setsHtml = ex.sets.map((s, idx) => `<div style="display:flex; justify-content:space-between; font-size:12px; opacity:0.8; margin-bottom:2px;"><span>Set ${idx + 1}</span><span>${s.weight}kg × ${s.reps}</span></div>`).join('');
            return `<div style="margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.05);"><strong style="font-size:13px; display:block; margin-bottom:4px;">${ex.title}</strong>${setsHtml}</div>`;
        }).join('');

        return `
            <div class="workout-item card" onclick="this.querySelector('.workout-details-list').classList.toggle('hidden');">
                <div class="workout-header">
                    <span class="workout-muscle" style="font-size:1.1rem; font-weight:600;">${w.muscle}</span>
                    <span class="workout-day" style="font-size:0.85rem; opacity:0.8;">${dStr}</span>
                </div>
                <div class="workout-summary">
                    <span><i class="ph ph-list-numbers"></i> ${w.exercises.length} Exercises</span>
                    <span><i class="ph ph-stack"></i> ${totalSets} Sets</span>
                </div>
                <div class="workout-details-list hidden" style="margin-top:12px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.1);">
                    ${detailsHtml}
                </div>
                <div class="workout-actions" onclick="event.stopPropagation();">
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
        labels.push(d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }));

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
    try {
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

        DOM.w.elements.customEndWeek.value = isoToDisplayDate(today.toISOString().split('T')[0]);
        DOM.w.elements.customStartWeek.value = isoToDisplayDate(startObj.toISOString().split('T')[0]);

        updateExerciseDropdown();
    } catch (err) {
        console.error('Workouts Analytics Init Error:', err);
    }
}

function updateExerciseDropdown() {
    const selectedMuscle = DOM.w.elements.customFilter.value;
    const exercises = new Set();

    workouts.forEach(w => {
        const wMuscleGroup = w.muscle ? w.muscle.toLowerCase() : '';
        const matchGroup = selectedMuscle === 'All' || wMuscleGroup === selectedMuscle.toLowerCase();

        if (matchGroup) {
            w.exercises.forEach(ex => {
                if (ex.title) exercises.add(toTitleCase(ex.title));
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

    const startStr = displayDateToISO(DOM.w.elements.customStartWeek.value);
    const endStr = displayDateToISO(DOM.w.elements.customEndWeek.value);
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
        const wDate = parseLocalDate(w.date);
        const inDateRange = wDate >= startDate && wDate <= endDate;

        const wMuscleGroup = w.muscle ? w.muscle.toLowerCase() : '';
        const groupFilterLC = filterGroup.toLowerCase();
        const matchesGroup = filterGroup === 'All' || wMuscleGroup === groupFilterLC;

        if (inDateRange && matchesGroup) {
            const key = getISOWeekString(wDate);
            if (!buckets[key]) return;

            w.exercises.forEach(ex => {
                buckets[key].volume += 1;

                const exTitleLC = ex.title ? ex.title.toLowerCase() : '';
                const filterExLC = filterEx.toLowerCase();

                if (filterEx !== 'All' && exTitleLC === filterExLC) {
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
    const labels = rawKeys.map(k => 'WK ' + k.split('-W')[1]);
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
        if (customType) selectedType = toTitleCase(customType);
    }

    DOM.loadingOverlay.classList.remove('hidden');

    setTimeout(() => {
        const itemDesc = toTitleCase(document.getElementById('expense-item').value.trim());

        if (editingExpenseId) {
            const idx = expenses.findIndex(exp => exp.id === editingExpenseId);
            if (idx !== -1) {
                expenses[idx].date = displayDateToISO(DOM.s.elements.dateInput.value);
                expenses[idx].type = selectedType;
                expenses[idx].item = itemDesc;
                expenses[idx].price = parseFloat(document.getElementById('expense-price').value);
            }
            editingExpenseId = null;
        } else {
            const newExpense = {
                id: Date.now().toString(),
                date: displayDateToISO(DOM.s.elements.dateInput.value),
                type: selectedType,
                item: itemDesc,
                price: parseFloat(document.getElementById('expense-price').value)
            };
            expenses.unshift(newExpense);
        }

        saveData('expenses');
        clearDraftExpense();
        _expenseDraftListenersAttached = false;
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

    DOM.s.elements.dateInput.value = isoToDisplayDate(exp.date);
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
    DOM.s.elements.monthDisplay.textContent = currentViewingDate.toLocaleDateString('en-GB', options);

    const viewMonth = currentViewingDate.getMonth();
    const viewYear = currentViewingDate.getFullYear();

    const monthExpenses = expenses.filter(exp => {
        const d = parseLocalDate(exp.date);
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
        const dObj = parseLocalDate(exp.date);
        const dStr = isNaN(dObj) ? exp.date : dObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

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
        const eDate = parseLocalDate(e.date);
        const inDateRange = eDate >= startDate && eDate <= endDate;

        const eTypeLC = e.type ? e.type.toLowerCase() : '';
        const filterCatLC = filterCat.toLowerCase();

        const matchesCategory = filterCat === 'All' || eTypeLC === filterCatLC;
        return inDateRange && matchesCategory;
    });

    // Bucket by Month-Year (e.g. "Feb 2026")
    const buckets = {};

    let curr = new Date(startDate);
    while (curr <= endDate) {
        const key = curr.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
        buckets[key] = 0;
        curr.setMonth(curr.getMonth() + 1);
    }

    filteredExpenses.forEach(e => {
        const eDate = parseLocalDate(e.date);
        const key = eDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
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
// SHOPPING LOGIC
// ==========================================
let editingShoppingId = null;

function handleSaveShopping(e) {
    e.preventDefault();

    // Show a much faster loader for shopping lists since adding should feel rapid
    DOM.loadingOverlay.classList.remove('hidden');

    setTimeout(() => {
        const isEditing = !!editingShoppingId;
        const itemNameRaw = document.getElementById('shopping-item-name').value.trim();
        const itemName = toTitleCase(itemNameRaw);

        if (editingShoppingId) {
            const idx = shoppingItems.findIndex(item => item.id === editingShoppingId);
            if (idx !== -1) {
                shoppingItems[idx].name = itemName;
            }
            editingShoppingId = null;
        } else {
            const newItem = {
                id: Date.now().toString(),
                name: itemName,
                checked: false
            };
            shoppingItems.unshift(newItem);
        }

        saveData('shopping');
        clearDraftShopping();
        _shoppingDraftListenersAttached = false;
        DOM.sh.elements.form.reset();
        DOM.loadingOverlay.classList.add('hidden');

        if (isEditing) {
            document.getElementById('save-shopping-btn').textContent = 'Add Item';
            switchView('sh', 'dashboard');
        } else {
            // Focus back on the input for continuous adding
            document.getElementById('shopping-item-name').focus();

            // Brief visual feedback showing it was successful
            const btn = document.getElementById('save-shopping-btn');
            btn.textContent = 'Added ✔';
            setTimeout(() => { if (!editingShoppingId) btn.textContent = 'Add Item'; }, 1000);
        }
    }, 200);
}

function toggleShoppingItem(id) {
    const idx = shoppingItems.findIndex(item => item.id === id);
    if (idx !== -1) {
        shoppingItems[idx].checked = !shoppingItems[idx].checked;
        if (shoppingItems[idx].checked) {
            // Track when the item was checked off for analytics
            shoppingItems[idx].checkedDate = new Date().toISOString().split('T')[0];
        } else {
            // Clear the tracked date if unchecked
            delete shoppingItems[idx].checkedDate;
        }
        saveData('shopping');
        renderShoppingDashboard();
    }
}


// ==========================================
// SHOPPING ANALYTICS
// ==========================================
function initCustomShoppingAnalytics() {
    try {
        // Populate filter dropdown with unique checked items
        const itemNames = new Set();
        shoppingItems.forEach(item => {
            if (item.checkedDate) itemNames.add(item.name);
        });

        DOM.sh.elements.customFilter.innerHTML = '<option value="All">All Items</option>';
        Array.from(itemNames).sort().forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            DOM.sh.elements.customFilter.appendChild(opt);
        });

        // Default to last 30 days
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);

        DOM.sh.elements.customStartDate.value = isoToDisplayDate(start.toISOString().split('T')[0]);
        DOM.sh.elements.customEndDate.value = isoToDisplayDate(end.toISOString().split('T')[0]);

        renderCustomShoppingChart();
    } catch (err) {
        console.error('Shopping Analytics Init Error:', err);
    }
}

function renderCustomShoppingChart() {
    if (!DOM.sh.elements.customStartDate.value || !DOM.sh.elements.customEndDate.value) return;

    const startDate = parseLocalDate(displayDateToISO(DOM.sh.elements.customStartDate.value));
    const endDate = parseLocalDate(displayDateToISO(DOM.sh.elements.customEndDate.value));
    const filterItem = DOM.sh.elements.customFilter.value;
    const ctx = document.getElementById('shopping-custom-chart').getContext('2d');

    // Aggregate by date
    const buckets = {};
    const d = new Date(startDate);
    while (d <= endDate) {
        const dStr = d.toISOString().split('T')[0];
        buckets[dStr] = 0;
        d.setDate(d.getDate() + 1);
    }

    const filteredItems = shoppingItems.filter(item => {
        if (!item.checkedDate) return false;

        const cDate = new Date(item.checkedDate);
        const inDateRange = cDate >= startDate && cDate <= endDate;

        const itemLC = item.name ? item.name.toLowerCase() : '';
        const filterItemLC = filterItem.toLowerCase();

        const matchesItem = filterItem === 'All' || itemLC === filterItemLC;
        return inDateRange && matchesItem;
    });

    filteredItems.forEach(item => {
        if (buckets[item.checkedDate] !== undefined) {
            buckets[item.checkedDate] += 1;
        }
    });

    const labels = Object.keys(buckets).map(d => {
        const date = new Date(d);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
    });
    const dataPoints = Object.values(buckets);

    if (customShoppingChart) {
        customShoppingChart.data.labels = labels;
        customShoppingChart.data.datasets[0].data = dataPoints;
        customShoppingChart.data.datasets[0].label = filterItem === 'All' ? 'Total Items Bought' : `Bought ${filterItem}`;
        customShoppingChart.update();
    } else {
        customShoppingChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: filterItem === 'All' ? 'Total Items Bought' : `Bought ${filterItem}`,
                    data: dataPoints,
                    backgroundColor: 'rgba(255, 152, 0, 0.7)',
                    borderColor: '#ff9800',
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
                        ticks: { stepSize: 1 } // Items are integers
                    },
                    x: {
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { display: true, labels: { color: 'rgba(255, 255, 255, 0.7)' } }
                }
            }
        });
    }
}

function deleteShoppingItem(id) {
    if (!confirm('Are you sure you want to delete this item?')) return;
    shoppingItems = shoppingItems.filter(item => item.id !== id);
    saveData('shopping');
    renderShoppingDashboard();
}

function loadShoppingForEdit(id) {
    const item = shoppingItems.find(x => x.id === id);
    if (!item) return;
    editingShoppingId = id;

    document.getElementById('shopping-item-name').value = item.name;

    document.getElementById('save-shopping-btn').textContent = 'Update Item';
    switchView('sh', 'newForm');
}

function renderShoppingDashboard() {
    DOM.sh.elements.total.textContent = shoppingItems.filter(item => !item.checked).length;

    if (shoppingItems.length === 0) {
        DOM.sh.elements.list.innerHTML = `<div class="empty-state"><i class="ph ph-shopping-cart"></i><p>Your list is empty.<br>Tap + to add items!</p></div>`;
        return;
    }

    DOM.sh.elements.list.innerHTML = shoppingItems.map(item => {
        return `
            <div class="shopping-item ${item.checked ? 'strikethrough' : ''}">
                <div class="shopping-item-details" style="flex: 1; display: flex; align-items: center; gap: 12px;" onclick="toggleShoppingItem('${item.id}')">
                    <i class="ph ${item.checked ? 'ph-check-circle' : 'ph-circle'}" style="font-size: 24px; color: ${item.checked ? 'var(--text-secondary)' : '#ff9800'};"></i>
                    <span class="shopping-item-name">${item.name}</span>
                </div>
                <div class="workout-actions" style="display: flex; gap: 8px;">
                    <button class="icon-btn" onclick="loadShoppingForEdit('${item.id}'); event.stopPropagation();"><i class="ph ph-pencil"></i></button>
                    <button class="icon-btn btn-icon-danger" style="color:var(--danger)" onclick="deleteShoppingItem('${item.id}'); event.stopPropagation();"><i class="ph ph-trash"></i></button>
                </div>
            </div>`;
    }).join('');
}


// ==========================================
// DATA MANAGEMENT (SETTINGS)
// ==========================================

// Builds a SheetJS workbook with three sheets
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

    // --- Shopping Sheet ---
    const shoppingRows = [['Item', 'Checked']];
    shoppingItems.forEach(item => {
        shoppingRows.push([item.name, item.checked ? 'Yes' : 'No']);
    });
    const wsShopping = XLSX.utils.aoa_to_sheet(shoppingRows);
    wsShopping['!cols'] = [{ wch: 30 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsShopping, 'Shopping');

    // --- Travels Sheet ---
    const travelRows = [['Location', 'Date', 'Latitude', 'Longitude']];
    travels.forEach(t => {
        travelRows.push([t.name, t.date, t.lat, t.lng]);
    });
    const wsTravels = XLSX.utils.aoa_to_sheet(travelRows);
    wsTravels['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsTravels, 'Travels');

    return wb;
}

async function exportData() {
    const data = {
        workouts,
        expenses,
        shoppingItems,
        travels,
        images: {}
    };

    // Collect all IndexedDB images
    for (const t of travels) {
        if (t.images) {
            for (const imgId of t.images) {
                if (!imgId.startsWith('data:')) {
                    const blob = await getImageFromDB(imgId);
                    if (blob) {
                        data.images[imgId] = await new Promise(resolve => {
                            const reader = new FileReader();
                            reader.onload = e => resolve(e.target.result);
                            reader.readAsDataURL(blob);
                        });
                    }
                }
            }
        }
    }

    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PraveenFitness_FullBackup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const importedData = JSON.parse(e.target.result);

            if (importedData.workouts || importedData.expenses || importedData.shoppingItems || importedData.travels) {
                if (confirm('Merge imported data with current data?')) {
                    if (importedData.workouts) workouts = [...importedData.workouts, ...workouts];
                    if (importedData.expenses) expenses = [...importedData.expenses, ...expenses];
                    if (importedData.shoppingItems) shoppingItems = [...importedData.shoppingItems, ...shoppingItems];
                    if (importedData.travels) travels = [...importedData.travels, ...travels];

                    // Import images into IndexedDB
                    if (importedData.images) {
                        for (const [id, dataUrl] of Object.entries(importedData.images)) {
                            const res = await fetch(dataUrl);
                            const blob = await res.blob();
                            await saveImageToDB(id, blob);
                        }
                    }

                    saveData('workouts');
                    saveData('expenses');
                    saveData('shopping');
                    saveData('travels');

                    alert('Backup restored successfully!');
                    location.reload();
                }
            } else {
                alert('Invalid backup file structure.');
            }
        } catch (error) {
            console.error("Import error:", error);
            alert('Error reading the backup file.');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function clearAllData() {
    if (confirm('⚠️ WARNING: This will permanently delete all your data. Are you absolutely sure?')) {
        if (prompt('Type "DELETE" to confirm:') === 'DELETE') {
            localStorage.removeItem('wt_workouts');
            localStorage.removeItem('wt_expenses');
            localStorage.removeItem('wt_shopping');
            localStorage.removeItem('wt_travels');
            workouts = [];
            expenses = [];
            shoppingItems = [];
            travels = [];
            alert('All data has been wiped.');
            location.reload();
        }
    }
}

// --- Versioning & Snapshots ---

async function checkForUpdates() {
    showGitHubStatus('⏳ Clearing local cache...', false);

    try {
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
                await registration.unregister();
            }
        }

        // Clear Cache Storage (where SW saves assets)
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            for (let cacheName of cacheNames) {
                await caches.delete(cacheName);
            }
        }

        showGitHubStatus('✅ Cache cleared! Reloading app...', false);
        
        // Force a hard reload from the server
        setTimeout(() => {
            window.location.reload(true);
        }, 800);

    } catch (err) {
        showGitHubStatus(`❌ Update check failed: ${err.message}`, true);
    }
}

async function downloadSystemSnapshot() {
    showGitHubStatus('⏳ Generating Snapshot...', false);

    const snapshot = {
        version: APP_VERSION,
        timestamp: new Date().toISOString(),
        data: {
            workouts,
            expenses,
            shoppingItems,
            travels
        },
        images: {}
    };

    // Collect all IndexedDB images
    try {
        for (const t of travels) {
            if (t.images) {
                for (const imgId of t.images) {
                    if (!imgId.startsWith('data:')) {
                        const blob = await getImageFromDB(imgId);
                        if (blob) {
                            snapshot.images[imgId] = await new Promise(resolve => {
                                const reader = new FileReader();
                                reader.onload = e => resolve(e.target.result);
                                reader.readAsDataURL(blob);
                            });
                        }
                    }
                }
            }
        }

        const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PraveenFitness_SNAPSHOT_${APP_VERSION}_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showGitHubStatus('✅ Snapshot downloaded!', false);
    } catch (err) {
        showGitHubStatus(`❌ Snapshot failed: ${err.message}`, true);
    }
}

async function restoreSystemSnapshot(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const snapshot = JSON.parse(e.target.result);

            // Validation
            if (!snapshot.version || !snapshot.data) {
                throw new Error('Invalid snapshot file format.');
            }

            const confirmMsg = `⚠️ RESTORE SNAPSHOT?\n\nThis will REPLACE ALL your current data with the state from ${new Date(snapshot.timestamp).toLocaleString()}.\n\n(Snapshot Version: ${snapshot.version})\n\nContinue?`;

            if (!confirm(confirmMsg)) return;

            showGitHubStatus('⏳ Restoring system state...', false);

            // 1. Restore LocalStorage Data
            if (snapshot.data.workouts) workouts = snapshot.data.workouts;
            if (snapshot.data.expenses) expenses = snapshot.data.expenses;
            if (snapshot.data.shoppingItems) shoppingItems = snapshot.data.shoppingItems;
            if (snapshot.data.travels) travels = snapshot.data.travels;

            saveData('workouts');
            saveData('expenses');
            saveData('shopping');
            saveData('travels');

            // 2. Restore IndexedDB Images
            if (snapshot.images) {
                // Clear existing images first? 
                // For a true "Restore", we might want to clear the store, but merge is safer unless user explicitly wipes.
                // However, snapshot is meant to be a full state, so we'll overwrite/put everything.
                for (const [id, dataUrl] of Object.entries(snapshot.images)) {
                    try {
                        const res = await fetch(dataUrl);
                        const blob = await res.blob();
                        await saveImageToDB(id, blob);
                    } catch (imgErr) {
                        console.error("Error restoring image during snapshot restore:", imgErr);
                    }
                }
            }

            alert('✅ System restored successfully! Reloading...');
            location.reload();
        } catch (error) {
            console.error("Restore error:", error);
            alert(`❌ Restore failed: ${error.message}`);
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
}
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
    let repo = DOM.settings.ghRepoInput.value.trim();
    const token = DOM.settings.ghTokenInput.value.trim();
    if (!repo || !token) {
        showGitHubStatus('⚠️ Please enter both a repository and a token.', true);
        return;
    }
    
    // Clean repo if user pasted a full URL
    if (repo.includes('github.com/')) {
        repo = repo.split('github.com/')[1];
    }
    // Remove trailing slash if any
    if (repo.endsWith('/')) {
        repo = repo.slice(0, -1);
    }

    localStorage.setItem('gh_repo', repo);
    localStorage.setItem('gh_token', token);
    
    // Update the input field to reflect the cleaned version
    DOM.settings.ghRepoInput.value = repo;

    showGitHubStatus('⏳ Verifying connection...', false);
    
    // Diagnostic Test Fetch
    fetch(`https://api.github.com/repos/${repo}`, {
        headers: { Authorization: `Bearer ${token}` }
    })
    .then(async (testResp) => {
        if (testResp.ok) {
            showGitHubStatus('✅ Settings saved and connection verified!', false);
        } else {
            const err = await testResp.json().catch(() => ({}));
            showGitHubStatus(`⚠️ Settings Saved, but verification failed: HTTP ${testResp.status} ${err.message || ''}`, true);
        }
    })
    .catch((e) => {
        showGitHubStatus(`❌ Settings saved, but CONNECTION BLOCKED by browser ("Failed to fetch"). Disable AdBlock/VPN!`, true);
    });
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
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' } }
    );
    if (checkResp.ok) {
        sha = (await checkResp.json()).sha;
    } else if (checkResp.status !== 404) {
        let errStr = `HTTP ${checkResp.status}`;
        try {
            const err = await checkResp.json();
            errStr = err.message || errStr;
        } catch(e) { /* ignore JSON parse error */ }
        throw new Error(errStr);
    }

    const putResp = await fetch(
        `https://api.github.com/repos/${repo}/contents/${path}`,
        {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: commitMsg, content: base64Content, ...(sha ? { sha } : {}) })
        }
    );
    if (!putResp.ok) {
        let errStr = `HTTP ${putResp.status}`;
        try {
            const err = await putResp.json();
            errStr = err.message || errStr;
        } catch(e) { /* ignore JSON parse error */ }
        throw new Error(errStr);
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

        // 1. Collect all data including images
        const data = {
            workouts,
            expenses,
            shoppingItems,
            travels,
            images: {}
        };

        // Collect all IndexedDB images for the push
        for (const t of travels) {
            if (t.images) {
                for (const imgId of t.images) {
                    if (!imgId.startsWith('data:')) {
                        const blob = await getImageFromDB(imgId);
                        if (blob) {
                            data.images[imgId] = await new Promise(resolve => {
                                const reader = new FileReader();
                                reader.onload = e => resolve(e.target.result);
                                reader.readAsDataURL(blob);
                            });
                        }
                    }
                }
            }
        }

        // 2. Push JSON (Full backup with images)
        const jsonString = JSON.stringify(data);
        const jsonContent = btoa(unescape(encodeURIComponent(jsonString)));
        await pushFileToGitHub(repo, token, GH_BACKUP_PATH, jsonContent, commitMsg);

        // 3. Push XLSX (for easy viewing)
        const wb = buildWorkbook();
        const xlsxBase64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
        await pushFileToGitHub(repo, token, 'data/backup.xlsx', xlsxBase64, commitMsg);

        const now = new Date().toLocaleString();
        localStorage.setItem('gh_last_sync', now);
        showGitHubStatus(`✅ Pushed at ${now}`, false);
    } catch (err) {
        console.error('GitHub Push Error:', err);
        showGitHubStatus(`❌ Push failed: ${err.message}`, true);
        
        let extraHelp = '';
        if (err.message.includes('Failed to fetch')) {
            extraHelp = '\n\nThis usually means your browser blocked the request (AdBlock/VPN) OR your backup has too many high-quality Travel images, making it too large to upload!';
        }
        
        alert(`GitHub Sync Error:\n${err.message}\nMake sure your token has "repo" permissions!${extraHelp}`);
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
            { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' } }
        );

        if (!resp.ok) {
            if (resp.status === 404) throw new Error('No backup file found in repo yet. Push first.');
            const err = await resp.json();
            throw new Error(err.message || `HTTP ${resp.status}`);
        }

        const file = await resp.json();
        const decoded = decodeURIComponent(escape(atob(file.content.replace(/\n/g, ''))));
        const importedData = JSON.parse(decoded);

        if (!importedData.workouts && !importedData.expenses && !importedData.shoppingItems && !importedData.travels) {
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
        if (importedData.shoppingItems) {
            shoppingItems = importedData.shoppingItems;
            saveData('shopping');
        }
        if (importedData.travels) {
            travels = importedData.travels;
            saveData('travels');
        }

        // Import images into IndexedDB during Pull
        if (importedData.images) {
            for (const [id, dataUrl] of Object.entries(importedData.images)) {
                try {
                    const res = await fetch(dataUrl);
                    const blob = await res.blob();
                    await saveImageToDB(id, blob);
                } catch (imgErr) {
                    console.error("Error importing image during pull:", imgErr);
                }
            }
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


// Google Maps Link Parser logic below

function loadTravelForEdit(id) {
    const t = travels.find(item => item.id === id);
    if (!t) return;

    editingTravelId = id;
    DOM.t.elements.title.innerText = 'Edit Footprint';
    DOM.t.elements.nameInput.value = t.name;
    DOM.t.elements.fromDateInput.value = t.fromDate;
    DOM.t.elements.toDateInput.value = t.toDate || '';
    DOM.t.elements.latInput.value = t.lat;
    DOM.t.elements.lngInput.value = t.lng;
    DOM.t.elements.experienceInput.value = t.experience || '';

    // Preview existing photos from IndexedDB
    DOM.t.elements.photoPreview.innerHTML = '';
    if (t.images && t.images.length) {
        t.images.forEach(async (imgId) => {
            try {
                // Check if it's an IndexedDB ID or an old Base64 string
                let src = imgId;
                if (!imgId.startsWith('data:')) {
                    const blob = await getImageFromDB(imgId);
                    if (blob) src = URL.createObjectURL(blob);
                }
                const thumb = document.createElement('img');
                thumb.src = src;
                thumb.className = 'preview-thumb';
                DOM.t.elements.photoPreview.appendChild(thumb);
            } catch (err) {
                console.error("Error loading photo preview:", err);
            }
        });
    }

    switchView('t', 'newForm');
}

async function handleSaveTravelLocation(e) {
    e.preventDefault();

    const name = DOM.t.elements.nameInput.value.trim();
    const fromDate = DOM.t.elements.fromDateInput.value;
    const toDate = DOM.t.elements.toDateInput.value;
    const lat = parseFloat(DOM.t.elements.latInput.value);
    const lng = parseFloat(DOM.t.elements.lngInput.value);
    const experience = DOM.t.elements.experienceInput.value.trim();

    if (!name || !fromDate || isNaN(lat) || isNaN(lng)) {
        alert('Please fill all required fields.');
        return;
    }

    // Handle Photos with IndexedDB
    let images = [];
    const photoFiles = Array.from(DOM.t.elements.photoInput.files);

    if (photoFiles.length > 0) {
        // Save new photos to IndexedDB
        images = await Promise.all(photoFiles.map(async (file) => {
            const id = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            await saveImageToDB(id, file);
            return id;
        }));
    }

    if (editingTravelId) {
        const idx = travels.findIndex(t => t.id === editingTravelId);
        if (idx !== -1) {
            // Keep existing images if no new ones selected, or merge? 
            // For now, if new files selected, they replace. If not, keep old.
            const finalImages = photoFiles.length > 0 ? images : travels[idx].images;

            travels[idx] = {
                ...travels[idx],
                name: toTitleCase(name),
                fromDate,
                toDate: toDate || null,
                lat,
                lng,
                images: finalImages,
                experience
            };
        }
        editingTravelId = null;
        if (DOM.t.elements.title) DOM.t.elements.title.innerText = 'Travel Journal';
    } else {
        const newTravel = {
            id: Date.now().toString(),
            name: toTitleCase(name),
            fromDate,
            toDate: toDate || null,
            lat,
            lng,
            images,
            experience
        };
        travels.push(newTravel);
    }

    saveData('travels');
    clearDraftTravel();
    _travelDraftListenersAttached = false;
    renderTravelDashboard();

    // UI Reset
    DOM.t.elements.form.reset();
    DOM.t.elements.photoPreview.innerHTML = '';
    switchView('t', 'dashboard');

    if (travelGlobe) travelGlobe.pointOfView({ lat, lng, altitude: 2 }, 1000);
}

function parseMapsUrl(value) {
    if (!value || !value.includes('google.com/maps')) return false;

    const placeMatch = value.match(/\/place\/([^\/]+)/);
    if (placeMatch && placeMatch[1]) {
        let name = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
        if (name.includes(',')) name = name.split(',')[0];
        DOM.t.elements.nameInput.value = toTitleCase(name.split('/')[0]);
    }

    const coordMatch = value.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (coordMatch) {
        DOM.t.elements.latInput.value = parseFloat(coordMatch[1]).toFixed(4);
        DOM.t.elements.lngInput.value = parseFloat(coordMatch[2]).toFixed(4);
        return true;
    }
    return false;
}

function openGoogleMaps() {
    const name = document.getElementById('travel-location-name').value.trim();
    let url = 'https://www.google.com/maps';

    if (name.startsWith('http')) {
        url = name;
    } else if (name) {
        url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
    }

    window.open(url, '_blank');
}

async function searchLocations(query) {
    const container = DOM.t.elements.suggestions;
    if (!container) return;

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
        const data = await response.json();

        if (data.length === 0) {
            container.classList.add('hidden');
            return;
        }

        container.innerHTML = '';
        data.forEach(item => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            const name = item.display_name.split(',')[0];
            const sub = item.display_name.split(',').slice(1).join(',').trim();
            
            div.innerHTML = `
                <strong>${name}</strong>
                <span class="sub">${sub}</span>
            `;
            
            div.onclick = () => {
                DOM.t.elements.nameInput.value = name;
                DOM.t.elements.latInput.value = parseFloat(item.lat).toFixed(6);
                DOM.t.elements.lngInput.value = parseFloat(item.lon).toFixed(6);
                container.classList.add('hidden');
            };
            container.appendChild(div);
        });
        container.classList.remove('hidden');
    } catch (err) {
        console.error('Search error:', err);
    }
}

function getGPSLocation() {
    const btn = document.getElementById('travel-gps-btn');
    if (!btn) return;

    const icon = btn.querySelector('i');
    const oldClass = icon.className;

    icon.className = 'ph ph-circle-notch ph-spin';

    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        icon.className = oldClass;
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            DOM.t.elements.latInput.value = lat.toFixed(6);
            DOM.t.elements.lngInput.value = lng.toFixed(6);

            if (!DOM.t.elements.nameInput.value) {
                DOM.t.elements.nameInput.value = 'Current Location';
            }

            icon.className = 'ph ph-check-circle';
            btn.style.color = '#00e676';
            setTimeout(() => {
                icon.className = oldClass;
                btn.style.color = '';
            }, 2000);
        },
        (error) => {
            console.error('GPS error:', error);
            alert('Unable to retrieve your location. Check GPS permissions.');
            icon.className = oldClass;
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

function checkClipboardForLocation() {
    const btn = document.getElementById('travel-paste-btn');

    // --- Helper: try to parse and give visual feedback ---
    function applyLink(text) {
        if (text && text.includes('google.com/maps')) {
            if (parseMapsUrl(text)) {
                const i = btn.querySelector('i');
                const oldClass = i.className;
                i.className = 'ph ph-check-circle';
                btn.style.borderColor = '#00e676';
                setTimeout(() => { i.className = oldClass; btn.style.borderColor = ''; }, 2000);
                hidePasteModal();
                return true;
            } else {
                showPasteModal('No valid coordinates found in that link. Try again:');
                return false;
            }
        } else {
            showPasteModal('Paste your Google Maps link here:');
            return false;
        }
    }

    // --- Helper: show an inline manual-paste text field ---
    function showPasteModal(message) {
        // Remove any existing modal
        hidePasteModal();

        const modal = document.createElement('div');
        modal.id = 'paste-modal';
        modal.style.cssText = `
            position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
            background: #1e1e1e; border: 1px solid rgba(0,180,219,0.4);
            border-radius: 14px; padding: 16px; width: 320px; z-index: 200;
            box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        `;
        modal.innerHTML = `
            <p style="font-size:13px; color:#a0a0a0; margin-bottom:10px;">${message}</p>
            <div style="display:flex; gap:8px;">
                <input type="url" id="paste-modal-input" placeholder="https://maps.google.com/..."
                    style="flex:1; background:#2c2c2c; border:1px solid rgba(255,255,255,0.15);
                    color:#fff; padding:10px 12px; border-radius:10px; font-size:14px; font-family:inherit;">
                <button id="paste-modal-apply" style="background:#00B4DB; border:none; color:#fff;
                    padding:10px 16px; border-radius:10px; font-weight:600; cursor:pointer; font-size:14px;">
                    Apply
                </button>
            </div>
            <button id="paste-modal-close" style="position:absolute; top:10px; right:12px;
                background:none; border:none; color:#a0a0a0; cursor:pointer; font-size:18px;">✕</button>
        `;
        document.body.appendChild(modal);

        const input = modal.querySelector('#paste-modal-input');
        input.focus();

        modal.querySelector('#paste-modal-apply').addEventListener('click', () => applyLink(input.value.trim()));
        modal.querySelector('#paste-modal-close').addEventListener('click', hidePasteModal);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyLink(input.value.trim()); });
    }

    function hidePasteModal() {
        const m = document.getElementById('paste-modal');
        if (m) m.remove();
    }

    // --- Try the Clipboard API first (Chrome, HTTPS Firefox) ---
    if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        navigator.clipboard.readText().then(text => {
            applyLink(text || '');
        }).catch(() => {
            // Permission denied or API unavailable — show manual fallback
            showPasteModal('Paste your Google Maps link here:');
        });
    } else {
        // No Clipboard API at all (Safari, non-HTTPS) — go straight to manual input
        showPasteModal('Paste your Google Maps link here:');
    }
}

function initTravelGlobe() {
    const container = document.getElementById('globe-container');
    if (!container) {
        console.error('Globe container not found');
        return;
    }

    // Ensure container has dimensions
    if (container.offsetWidth === 0) {
        container.style.width = '100vw';
        container.style.height = '100vh';
    }

    try {
        const GlobeConstructor = typeof Globe === 'function' ? Globe : window.Globe;
        if (!GlobeConstructor) throw new Error('Globe.gl library not loaded');

        travelGlobe = GlobeConstructor()
            (container)
            .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
            .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
            .backgroundImageUrl('https://unpkg.com/three-globe/example/img/night-sky.png')
            .showAtmosphere(true)
            .atmosphereColor('#8ec6ff')
            .atmosphereAltitude(0.2)
            .pointColor(() => '#00B4DB')
            .pointRadius(0.8)
            .pointAltitude(0.06)
            .labelLat(d => d.lat)
            .labelLng(d => d.lng)
            .labelText(d => d.name)
            .labelSize(1.6)
            .labelDotRadius(0.6)
            .labelColor(() => 'rgba(255, 255, 255, 0.95)')
            .labelResolution(3)
            .onGlobeClick(({ lat, lng }) => {
                DOM.t.elements.latInput.value = lat.toFixed(4);
                DOM.t.elements.lngInput.value = lng.toFixed(4);
                switchView('t', 'newForm');
                DOM.t.elements.nameInput.focus();
            });

        // Slow cinematic rotation
        travelGlobe.controls().autoRotate = true;
        travelGlobe.controls().autoRotateSpeed = 0.6;
        travelGlobe.controls().enableDamping = true;
        travelGlobe.controls().dampingFactor = 0.05;

        // Force a resize after a short delay to ensure correct dimensions
        setTimeout(() => {
            if (travelGlobe) travelGlobe.width(window.innerWidth).height(window.innerHeight);
        }, 100);

    } catch (err) {
        console.error('Failed to initialize Globe:', err);
    }

    window.addEventListener('resize', () => {
        if (travelGlobe) travelGlobe.width(window.innerWidth).height(window.innerHeight);
    });

    renderTravelDashboard();
}

function renderTravelDashboard() {
    if (!travelGlobe) return;

    // Show points and labels permanently
    travelGlobe.pointsData(travels);
    travelGlobe.labelsData(travels);

    const arcs = [];
    for (let i = 0; i < travels.length - 1; i++) {
        arcs.push({
            startLat: travels[i].lat,
            startLng: travels[i].lng,
            endLat: travels[i + 1].lat,
            endLng: travels[i + 1].lng,
            color: ['#00B4DB', '#0083B0']
        });
    }

    travelGlobe.arcsData(arcs)
        .arcColor('color')
        .arcDashLength(0.4)
        .arcDashGap(2)
        .arcDashAnimateTime(1500)
        .arcAltitude(0.2)
        .arcStroke(0.6);

    // Glowing rings for points
    const rings = travels.map(t => ({ lat: t.lat, lng: t.lng }));
    travelGlobe.ringsData(rings)
        .ringColor(() => 'rgba(0, 180, 219, 0.6)')
        .ringMaxRadius(2.5)
        .ringPropagationSpeed(1.5)
        .ringRepeat(3);

    // Render Timeline with Vertical Wrapper
    DOM.t.elements.timeline.innerHTML = travels.length ? `
        <div class="timeline-wrapper">
             ${travels.sort((a, b) => new Date(b.fromDate) - new Date(a.fromDate)).map((t, idx) => {
        const imgSection = t.images && t.images.length ? `
                    <div class="timeline-photos" id="photos-${t.id}">
                        <!-- Images will be injected here asynchronously -->
                    </div>
                ` : '';

        return `
                    <div class="timeline-item ${t.images && t.images.length ? 'has-photos' : ''}" id="t-step-${t.id}" onclick="focusGlobePoint('${t.id}', ${t.lat}, ${t.lng})">
                        <div class="timeline-dot"></div>
                        <div class="timeline-content">
                            <div class="timeline-date">
                                <i class="ph ph-calendar-blank"></i>
                                ${new Date(t.fromDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} 
                                ${t.toDate ? ` - ${new Date(t.toDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}` : ''}
                            </div>
                            <div class="timeline-name">${t.name}</div>
                            
                            ${t.experience ? `<div class="timeline-story">${t.experience}</div>` : ''}
                            ${imgSection}
                        </div>
                        <div class="timeline-controls" style="display: flex; gap: 8px; margin-left: auto; z-index: 5;">
                            <button class="icon-btn btn-icon-secondary" onclick="loadTravelForEdit('${t.id}'); event.stopPropagation();">
                                <i class="ph ph-pencil-simple"></i>
                            </button>
                            <button class="icon-btn btn-icon-danger" onclick="deleteTravelLocation('${t.id}'); event.stopPropagation();">
                                <i class="ph ph-trash"></i>
                            </button>
                        </div>
                    </div>`;
    }).join('')}
        </div>
    ` : '<div class="empty-state"><p>No travels logged yet.<br>Click the Globe to start!</p></div>';

    // Asynchronously load images
    travels.forEach(t => {
        if (t.images && t.images.length) {
            const container = document.getElementById(`photos-${t.id}`);
            if (container) {
                t.images.forEach(async (imgId) => {
                    let src = imgId;
                    if (!imgId.startsWith('data:')) {
                        const blob = await getImageFromDB(imgId);
                        if (blob) src = URL.createObjectURL(blob);
                    }
                    const img = document.createElement('img');
                    img.src = src;
                    img.className = 'timeline-photo';
                    img.loading = 'lazy';
                    container.appendChild(img);
                });
            }
        }
    });
}

function focusGlobePoint(id, lat, lng) {
    if (!travelGlobe) return;

    // UI Sync: Highlight active card
    document.querySelectorAll('.timeline-item').forEach(el => el.classList.remove('active'));
    const activeItem = document.getElementById(`t-step-${id}`);
    if (activeItem) activeItem.classList.add('active');

    // Cinematic Move
    travelGlobe.pointOfView({ lat, lng, altitude: 1.5 }, 1500);

    // Pause rotation temporarily on focus
    travelGlobe.controls().autoRotate = false;
    setTimeout(() => {
        travelGlobe.controls().autoRotate = true;
    }, 10000); // Resume after 10s
}

function deleteTravelLocation(id) {
    if (!confirm('Delete this footprint from your journey?')) return;

    // Cleanup IndexedDB images
    const t = travels.find(item => item.id === id);
    if (t && t.images) {
        t.images.forEach(imgId => {
            if (!imgId.startsWith('data:')) {
                deleteImageFromDB(imgId).catch(err => console.error("Error deleting image from DB:", err));
            }
        });
    }

    travels = travels.filter(t => t.id !== id);
    saveData('travels');
    renderTravelDashboard();
}

// Boot
init();