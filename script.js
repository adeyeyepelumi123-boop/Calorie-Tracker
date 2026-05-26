/* ============================================
   CalorieFlow — Application Logic
   ============================================ */

(function () {
    'use strict';

    // ─── Constants ───
    const STORAGE_KEYS = {
        MEALS: 'calorieflow_meals',
        SETTINGS: 'calorieflow_settings',
    };

    const DEFAULT_SETTINGS = {
        calorieGoal: 2000,
        userName: '',
    };

    const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // ─── State ───
    let currentDate = new Date();
    let settings = loadSettings();

    // ─── DOM References ───
    const $ = (id) => document.getElementById(id);

    const DOM = {
        // Date nav
        dateLabel: $('date-label'),
        dateFull: $('date-full'),
        btnPrevDay: $('btn-prev-day'),
        btnNextDay: $('btn-next-day'),

        // Ring
        ringProgress: $('ring-progress'),
        ringCalories: $('ring-calories'),
        statRemaining: $('stat-remaining'),
        statGoal: $('stat-goal'),

        // Macro
        breakfastCal: $('breakfast-cal'),
        lunchCal: $('lunch-cal'),
        dinnerCal: $('dinner-cal'),
        snacksCal: $('snacks-cal'),
        breakfastBar: $('breakfast-bar'),
        lunchBar: $('lunch-bar'),
        dinnerBar: $('dinner-bar'),
        snacksBar: $('snacks-bar'),

        // Meal list
        mealList: $('meal-list'),
        emptyState: $('empty-state'),

        // Add meal modal
        modalOverlay: $('modal-overlay'),
        mealForm: $('meal-form'),
        mealName: $('meal-name'),
        mealCalories: $('meal-calories'),
        btnAddMeal: $('btn-add-meal'),
        btnCloseModal: $('btn-close-modal'),

        // Settings modal
        settingsOverlay: $('settings-overlay'),
        settingsForm: $('settings-form'),
        calorieGoal: $('calorie-goal'),
        userName: $('user-name'),
        btnSettings: $('btn-settings'),
        btnCloseSettings: $('btn-close-settings'),
        btnClearData: $('btn-clear-data'),

        // Chart
        chartContainer: $('chart-container'),

        // Toast
        toastContainer: $('toast-container'),
    };

    // ─── LocalStorage Helpers ───
    function loadMeals() {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.MEALS);
            return data ? JSON.parse(data) : {};
        } catch {
            return {};
        }
    }

    function saveMeals(meals) {
        localStorage.setItem(STORAGE_KEYS.MEALS, JSON.stringify(meals));
    }

    function loadSettings() {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
            return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : { ...DEFAULT_SETTINGS };
        } catch {
            return { ...DEFAULT_SETTINGS };
        }
    }

    function saveSettings(s) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(s));
    }

    // ─── Date Helpers ───
    function toDateKey(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function isToday(date) {
        const today = new Date();
        return toDateKey(date) === toDateKey(today);
    }

    function isYesterday(date) {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        return toDateKey(date) === toDateKey(y);
    }

    function isTomorrow(date) {
        const t = new Date();
        t.setDate(t.getDate() + 1);
        return toDateKey(date) === toDateKey(t);
    }

    function formatDate(date) {
        return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    }

    function getDateLabel(date) {
        if (isToday(date)) return 'Today';
        if (isYesterday(date)) return 'Yesterday';
        if (isTomorrow(date)) return 'Tomorrow';
        return DAYS_SHORT[date.getDay()];
    }

    // ─── Meal Data Helpers ───
    function getMealsForDate(dateKey) {
        const allMeals = loadMeals();
        return allMeals[dateKey] || [];
    }

    function addMeal(dateKey, meal) {
        const allMeals = loadMeals();
        if (!allMeals[dateKey]) allMeals[dateKey] = [];
        allMeals[dateKey].push(meal);
        saveMeals(allMeals);
    }

    function removeMeal(dateKey, mealId) {
        const allMeals = loadMeals();
        if (allMeals[dateKey]) {
            allMeals[dateKey] = allMeals[dateKey].filter((m) => m.id !== mealId);
            if (allMeals[dateKey].length === 0) delete allMeals[dateKey];
            saveMeals(allMeals);
        }
    }

    function calcTotalCalories(meals) {
        return meals.reduce((sum, m) => sum + m.calories, 0);
    }

    function calcMealTypeCalories(meals, type) {
        return meals.filter((m) => m.type === type).reduce((sum, m) => sum + m.calories, 0);
    }

    // ─── Unique ID Generator ───
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    }

    // ─── Render Functions ───
    function renderDateNav() {
        DOM.dateLabel.textContent = getDateLabel(currentDate);
        DOM.dateFull.textContent = formatDate(currentDate);
    }

    function renderRing(totalCal) {
        const goal = settings.calorieGoal;
        const circumference = 2 * Math.PI * 78; // ~490
        const progress = Math.min(totalCal / goal, 1);
        const offset = circumference - progress * circumference;

        DOM.ringProgress.style.strokeDasharray = circumference;
        DOM.ringProgress.style.strokeDashoffset = offset;

        const isOver = totalCal > goal;
        DOM.ringProgress.classList.toggle('over-budget', isOver);
        DOM.ringCalories.classList.toggle('over-budget', isOver);

        // Animate number
        animateNumber(DOM.ringCalories, totalCal);

        const remaining = Math.max(goal - totalCal, 0);
        DOM.statRemaining.textContent = remaining.toLocaleString();
        DOM.statGoal.textContent = goal.toLocaleString();

        if (isOver) {
            DOM.statRemaining.textContent = '+' + (totalCal - goal).toLocaleString();
        }
    }

    function renderMacroCards(meals) {
        const goal = settings.calorieGoal;
        const types = ['breakfast', 'lunch', 'dinner', 'snacks'];
        const calElements = {
            breakfast: DOM.breakfastCal,
            lunch: DOM.lunchCal,
            dinner: DOM.dinnerCal,
            snacks: DOM.snacksCal,
        };
        const barElements = {
            breakfast: DOM.breakfastBar,
            lunch: DOM.lunchBar,
            dinner: DOM.dinnerBar,
            snacks: DOM.snacksBar,
        };

        types.forEach((type) => {
            const cal = calcMealTypeCalories(meals, type);
            calElements[type].textContent = `${cal.toLocaleString()} cal`;

            // Each meal type gets ~25% of goal for bar visualization
            const barPercent = Math.min((cal / (goal * 0.35)) * 100, 100);
            barElements[type].style.width = `${barPercent}%`;
        });
    }

    function renderMealList(meals) {
        DOM.mealList.innerHTML = '';

        if (meals.length === 0) {
            DOM.emptyState.classList.remove('hidden');
            return;
        }

        DOM.emptyState.classList.add('hidden');

        // Sort meals: most recent first
        const sorted = [...meals].reverse();

        sorted.forEach((meal) => {
            const item = document.createElement('div');
            item.className = 'meal-item';
            item.dataset.id = meal.id;

            const timeStr = new Date(meal.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
            });

            item.innerHTML = `
                <div class="meal-type-dot ${meal.type}"></div>
                <div class="meal-details">
                    <div class="meal-item-name">${escapeHtml(meal.name)}</div>
                    <div class="meal-item-meta">${meal.type} · ${timeStr}</div>
                </div>
                <div class="meal-item-calories">${meal.calories.toLocaleString()} <span>cal</span></div>
                <button class="btn-delete-meal" aria-label="Delete meal" data-meal-id="${meal.id}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    </svg>
                </button>
            `;

            DOM.mealList.appendChild(item);
        });
    }

    function renderWeeklyChart() {
        DOM.chartContainer.innerHTML = '';
        const today = new Date();
        const allMeals = loadMeals();
        const goal = settings.calorieGoal;

        // Collect 7 days data
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const key = toDateKey(d);
            const meals = allMeals[key] || [];
            const total = calcTotalCalories(meals);
            days.push({
                date: d,
                key,
                total,
                dayLabel: DAYS_SHORT[d.getDay()],
                isToday: i === 0,
            });
        }

        const maxCal = Math.max(goal, ...days.map((d) => d.total));

        days.forEach((day) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'chart-bar-wrapper';

            const calLabel = document.createElement('span');
            calLabel.className = 'chart-cal';
            calLabel.textContent = day.total > 0 ? day.total : '';

            const track = document.createElement('div');
            track.className = 'chart-bar-track';

            const bar = document.createElement('div');
            bar.className = 'chart-bar';
            if (day.isToday) bar.classList.add('today');
            if (day.total > goal) bar.classList.add('over');

            const heightPercent = maxCal > 0 ? (day.total / maxCal) * 100 : 0;
            bar.style.height = '0%';

            const dayLabel = document.createElement('span');
            dayLabel.className = 'chart-day';
            if (day.isToday) dayLabel.classList.add('today');
            dayLabel.textContent = day.dayLabel;

            track.appendChild(bar);
            wrapper.appendChild(calLabel);
            wrapper.appendChild(track);
            wrapper.appendChild(dayLabel);
            DOM.chartContainer.appendChild(wrapper);

            // Animate bar height after a frame
            requestAnimationFrame(() => {
                setTimeout(() => {
                    bar.style.height = `${heightPercent}%`;
                }, 100);
            });
        });
    }

    function renderAll() {
        const dateKey = toDateKey(currentDate);
        const meals = getMealsForDate(dateKey);
        const totalCal = calcTotalCalories(meals);

        renderDateNav();
        renderRing(totalCal);
        renderMacroCards(meals);
        renderMealList(meals);
        renderWeeklyChart();

        // Update section title
        const sectionTitle = document.querySelector('.meal-log .section-title');
        if (sectionTitle) {
            if (isToday(currentDate)) {
                sectionTitle.textContent = "Today's Meals";
            } else {
                sectionTitle.textContent = `Meals — ${formatDate(currentDate)}`;
            }
        }
    }

    // ─── Utility Functions ───
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function animateNumber(element, target) {
        const current = parseInt(element.textContent.replace(/,/g, '')) || 0;
        if (current === target) return;

        const duration = 500;
        const startTime = performance.now();

        function update(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            const value = Math.round(current + (target - current) * eased);
            element.textContent = value.toLocaleString();

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }

        requestAnimationFrame(update);
    }

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        let iconSvg = '';
        if (type === 'success') {
            iconSvg = '<svg class="toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
        } else if (type === 'error') {
            iconSvg = '<svg class="toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
        } else {
            iconSvg = '<svg class="toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
        }

        toast.innerHTML = `${iconSvg}<span>${message}</span>`;
        DOM.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('removing');
            toast.addEventListener('animationend', () => toast.remove());
        }, 2800);
    }

    // ─── Modal Handling ───
    function openModal(overlay) {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal(overlay) {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    // ─── Event Listeners ───
    function initEventListeners() {
        // Date navigation
        DOM.btnPrevDay.addEventListener('click', () => {
            currentDate.setDate(currentDate.getDate() - 1);
            renderAll();
        });

        DOM.btnNextDay.addEventListener('click', () => {
            currentDate.setDate(currentDate.getDate() + 1);
            renderAll();
        });

        // Add meal modal
        DOM.btnAddMeal.addEventListener('click', () => {
            openModal(DOM.modalOverlay);
            DOM.mealName.focus();
        });

        DOM.btnCloseModal.addEventListener('click', () => {
            closeModal(DOM.modalOverlay);
            DOM.mealForm.reset();
        });

        DOM.modalOverlay.addEventListener('click', (e) => {
            if (e.target === DOM.modalOverlay) {
                closeModal(DOM.modalOverlay);
                DOM.mealForm.reset();
            }
        });

        // Submit meal form
        DOM.mealForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const name = DOM.mealName.value.trim();
            const calories = parseInt(DOM.mealCalories.value);
            const type = document.querySelector('input[name="meal-type"]:checked').value;

            if (!name || isNaN(calories) || calories < 1) {
                showToast('Please fill in all fields correctly', 'error');
                return;
            }

            const meal = {
                id: generateId(),
                name,
                calories,
                type,
                timestamp: new Date().toISOString(),
            };

            const dateKey = toDateKey(currentDate);
            addMeal(dateKey, meal);

            closeModal(DOM.modalOverlay);
            DOM.mealForm.reset();

            renderAll();
            showToast(`${name} added — ${calories} cal`, 'success');
        });

        // Delete meal
        DOM.mealList.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-delete-meal');
            if (!btn) return;

            const mealId = btn.dataset.mealId;
            const item = btn.closest('.meal-item');

            item.classList.add('removing');
            item.addEventListener('animationend', () => {
                const dateKey = toDateKey(currentDate);
                removeMeal(dateKey, mealId);
                renderAll();
                showToast('Meal removed', 'info');
            });
        });

        // Settings modal
        DOM.btnSettings.addEventListener('click', () => {
            DOM.calorieGoal.value = settings.calorieGoal;
            DOM.userName.value = settings.userName;
            openModal(DOM.settingsOverlay);
        });

        DOM.btnCloseSettings.addEventListener('click', () => {
            closeModal(DOM.settingsOverlay);
        });

        DOM.settingsOverlay.addEventListener('click', (e) => {
            if (e.target === DOM.settingsOverlay) {
                closeModal(DOM.settingsOverlay);
            }
        });

        DOM.settingsForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const newGoal = parseInt(DOM.calorieGoal.value);
            if (isNaN(newGoal) || newGoal < 500) {
                showToast('Goal must be at least 500 cal', 'error');
                return;
            }

            settings.calorieGoal = newGoal;
            settings.userName = DOM.userName.value.trim();
            saveSettings(settings);

            closeModal(DOM.settingsOverlay);
            renderAll();
            showToast('Settings saved', 'success');
        });

        // Clear all data
        DOM.btnClearData.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
                localStorage.removeItem(STORAGE_KEYS.MEALS);
                settings = { ...DEFAULT_SETTINGS };
                saveSettings(settings);
                renderAll();
                closeModal(DOM.settingsOverlay);
                showToast('All data cleared', 'info');
            }
        });

        // Keyboard: Escape to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (DOM.modalOverlay.classList.contains('active')) {
                    closeModal(DOM.modalOverlay);
                    DOM.mealForm.reset();
                }
                if (DOM.settingsOverlay.classList.contains('active')) {
                    closeModal(DOM.settingsOverlay);
                }
            }
        });

        // Keyboard: arrow keys for date navigation
        document.addEventListener('keydown', (e) => {
            // Don't navigate if a modal is open or an input is focused
            if (
                DOM.modalOverlay.classList.contains('active') ||
                DOM.settingsOverlay.classList.contains('active')
            ) return;

            const active = document.activeElement;
            if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;

            if (e.key === 'ArrowLeft') {
                currentDate.setDate(currentDate.getDate() - 1);
                renderAll();
            } else if (e.key === 'ArrowRight') {
                currentDate.setDate(currentDate.getDate() + 1);
                renderAll();
            }
        });
    }

    // ─── Initialize ───
    function init() {
        initEventListeners();
        renderAll();
    }

    // Start the app
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
