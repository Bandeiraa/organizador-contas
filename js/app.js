(function () {
  "use strict";

  var STORAGE_KEY = "organizador-contas-v2";

  var CATEGORY_LABELS = {
    moradia: "Moradia",
    servicos: "Serviços & assinaturas",
    transporte: "Transporte",
    alimentacao: "Alimentação",
    saude: "Saúde",
    educacao: "Educação",
    impostos: "Impostos & taxas",
    dividas: "Dívidas",
    outros: "Outros",
  };

  var CATEGORY_COLORS = {
    moradia: "rgba(139, 92, 246, 0.82)",
    servicos: "rgba(61, 156, 245, 0.82)",
    transporte: "rgba(52, 211, 153, 0.82)",
    alimentacao: "rgba(251, 191, 36, 0.85)",
    saude: "rgba(244, 114, 182, 0.82)",
    educacao: "rgba(56, 189, 248, 0.82)",
    impostos: "rgba(148, 163, 184, 0.85)",
    dividas: "rgba(248, 113, 113, 0.78)",
    outros: "rgba(168, 162, 158, 0.75)",
  };

  var CATEGORY_BORDERS = {
    moradia: "rgba(167, 139, 250, 1)",
    servicos: "rgba(96, 165, 250, 1)",
    transporte: "rgba(52, 211, 153, 1)",
    alimentacao: "rgba(252, 211, 77, 1)",
    saude: "rgba(249, 168, 212, 1)",
    educacao: "rgba(125, 211, 252, 1)",
    impostos: "rgba(203, 213, 225, 1)",
    dividas: "rgba(252, 165, 165, 1)",
    outros: "rgba(214, 211, 209, 1)",
  };

  var chartInstance = null;
  var investSimChartInstance = null;

  function uid() {
    return (
      "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9)
    );
  }

  function parseMoneyEl(el) {
    if (!el) return 0;
    var v = parseFloat(String(el.value).replace(",", "."), 10);
    return isFinite(v) && v >= 0 ? v : 0;
  }

  function parseMoneyStr(s) {
    var v = parseFloat(String(s).replace(",", "."), 10);
    return isFinite(v) && v >= 0 ? v : 0;
  }

  function formatBRL(value) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  }

  function todayISODate() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function calendarMonthKey(d) {
    return (
      d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")
    );
  }

  function currentMonthKey() {
    return calendarMonthKey(new Date());
  }

  function addMonths(monthKey, delta) {
    var p = monthKey.split("-");
    var y = parseInt(p[0], 10);
    var m = parseInt(p[1], 10) - 1;
    var nd = new Date(y, m + delta, 1);
    return calendarMonthKey(nd);
  }

  function formatMonthLong(monthKey) {
    var p = monthKey.split("-");
    var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, 1);
    return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }

  function formatMonthShort(monthKey) {
    var p = monthKey.split("-");
    var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, 1);
    return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return tryMigrateV1();
      var data = JSON.parse(raw);
      var prevTab =
        data.ui && typeof data.ui === "object" ? data.ui.activeTab : null;
      var s = migrateState(data);
      if (prevTab === "suggestions") saveState(s);
      return s;
    } catch (e) {
      return defaultState();
    }
  }

  function tryMigrateV1() {
    try {
      var raw = localStorage.getItem("organizador-contas-v1");
      if (!raw) return defaultState();
      var data = JSON.parse(raw);
      return migrateFromV1(data);
    } catch (e) {
      return defaultState();
    }
  }

  function defaultState() {
    return {
      viewMonth: currentMonthKey(),
      incomeSources: [{ id: uid(), name: "Principal", amount: 0 }],
      byMonth: {},
      savingsGoal: 0,
      accounts: [],
      paidByAccount: {},
      ui: {
        activeTab: "main",
        dueHorizonDays: 7,
        reserveSimPct: 20,
        investSimPct: 15,
        rateNubank: 13,
        rateRF: 12.5,
        ratePoup: 6,
        simNubank: true,
        simRF: true,
        simPoup: false,
        simChartHorizon: 12,
        simChartView: "invest",
        simChartScenarioKey: "nubank",
      },
    };
  }

  function migrateFromV1(old) {
    var s = defaultState();
    if (!old || typeof old !== "object") return s;
    s.accounts = Array.isArray(old.accounts) ? old.accounts : [];
    s.paidByAccount = old.paidByAccount && typeof old.paidByAccount === "object" ? old.paidByAccount : {};
    s.savingsGoal = typeof old.savingsGoal === "number" ? old.savingsGoal : 0;
    var inc = typeof old.monthlyIncome === "number" ? old.monthlyIncome : 0;
    s.incomeSources = [{ id: uid(), name: "Principal", amount: inc }];
    s.accounts.forEach(function (a) {
      if (a.parcelasRestantes === undefined) a.parcelasRestantes = null;
    });
    s.ui = {
      activeTab: "main",
      dueHorizonDays: 7,
      reserveSimPct: 20,
      investSimPct: 15,
      rateNubank: 13,
      rateRF: 12.5,
      ratePoup: 6,
      simNubank: true,
      simRF: true,
      simPoup: false,
      simChartHorizon: 12,
      simChartView: "invest",
      simChartScenarioKey: "nubank",
    };
    return s;
  }

  function migrateState(data) {
    if (!data || typeof data !== "object") return defaultState();
    if (!Array.isArray(data.accounts)) data.accounts = [];
    if (!data.paidByAccount || typeof data.paidByAccount !== "object") {
      data.paidByAccount = {};
    }
    if (typeof data.savingsGoal !== "number") data.savingsGoal = 0;
    if (!data.byMonth || typeof data.byMonth !== "object") data.byMonth = {};
    if (!data.viewMonth || !/^\d{4}-\d{2}$/.test(data.viewMonth)) {
      data.viewMonth = currentMonthKey();
    }
    if (!Array.isArray(data.incomeSources) || data.incomeSources.length === 0) {
      if (typeof data.monthlyIncome === "number" && data.monthlyIncome > 0) {
        data.incomeSources = [
          { id: uid(), name: "Principal", amount: data.monthlyIncome },
        ];
      } else {
        data.incomeSources = [{ id: uid(), name: "Principal", amount: 0 }];
      }
    }
    data.accounts.forEach(function (a) {
      if (a.parcelasRestantes === undefined) a.parcelasRestantes = null;
    });
    if (!data.ui || typeof data.ui !== "object") data.ui = {};
    if ("investPct" in data.ui) delete data.ui.investPct;
    if (!data.ui.activeTab) data.ui.activeTab = "main";
    if (data.ui.activeTab === "suggestions") data.ui.activeTab = "main";
    if (typeof data.ui.dueHorizonDays !== "number") data.ui.dueHorizonDays = 7;
    if (typeof data.ui.reserveSimPct !== "number") data.ui.reserveSimPct = 20;
    if (typeof data.ui.investSimPct !== "number") data.ui.investSimPct = 15;
    if (typeof data.ui.rateNubank !== "number") data.ui.rateNubank = 13;
    if (typeof data.ui.rateRF !== "number") data.ui.rateRF = 12.5;
    if (typeof data.ui.ratePoup !== "number") data.ui.ratePoup = 6;
    if (typeof data.ui.simNubank !== "boolean") data.ui.simNubank = true;
    if (typeof data.ui.simRF !== "boolean") data.ui.simRF = true;
    if (typeof data.ui.simPoup !== "boolean") data.ui.simPoup = false;
    if (
      typeof data.ui.simChartHorizon !== "number" ||
      [6, 12, 24].indexOf(data.ui.simChartHorizon) === -1
    ) {
      data.ui.simChartHorizon = 12;
    }
    if (data.ui.simChartView !== "invest" && data.ui.simChartView !== "reserve") {
      data.ui.simChartView = "invest";
    }
    if (typeof data.ui.simChartScenarioKey !== "string") {
      data.ui.simChartScenarioKey = "nubank";
    }
    return data;
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  var state = loadState();
  var editingId = null;

  function sumSources(arr) {
    if (!arr || !arr.length) return 0;
    return arr.reduce(function (s, x) {
      return s + (typeof x.amount === "number" ? x.amount : 0);
    }, 0);
  }

  function getIncomeForMonth(monthKey) {
    var patch = state.byMonth[monthKey];
    if (patch && patch.sources && patch.sources.length) {
      return sumSources(patch.sources);
    }
    return sumSources(state.incomeSources);
  }

  function getSavingsForMonth(monthKey) {
    var patch = state.byMonth[monthKey];
    if (patch && typeof patch.savingsGoal === "number") {
      return patch.savingsGoal;
    }
    return state.savingsGoal || 0;
  }

  function hasIncomeOverride(monthKey) {
    var p = state.byMonth[monthKey];
    return !!(p && p.sources && p.sources.length);
  }

  function cloneSources(sources) {
    return sources.map(function (x) {
      return { id: x.id || uid(), name: x.name || "", amount: x.amount || 0 };
    });
  }

  function startOfToday() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function lastDayOfMonth(y, monthIndex0) {
    return new Date(y, monthIndex0 + 1, 0).getDate();
  }

  function parseISODateLocal(iso) {
    if (!iso || typeof iso !== "string") return null;
    var p = iso.split("-");
    if (p.length !== 3) return null;
    var y = parseInt(p[0], 10);
    var m = parseInt(p[1], 10) - 1;
    var day = parseInt(p[2], 10);
    if (!isFinite(y) || !isFinite(m) || !isFinite(day)) return null;
    return new Date(y, m, day);
  }

  function usesAutoParcelasFromEndDate(acc) {
    return (
      acc &&
      acc.type === "temporaria" &&
      acc.endDate &&
      String(acc.endDate).length >= 10
    );
  }

  function dueDateInMonth(monthKey, endDateISO) {
    var end = parseISODateLocal(endDateISO);
    if (!end) return null;
    var y = parseInt(monthKey.slice(0, 4), 10);
    var m0 = parseInt(monthKey.slice(5, 7), 10) - 1;
    var dueDay = end.getDate();
    var dim = lastDayOfMonth(y, m0);
    var dom = Math.min(dueDay, dim);
    return new Date(y, m0, dom);
  }

  function countParcelasFromEndDate(acc) {
    if (!usesAutoParcelasFromEndDate(acc)) return null;
    var end = parseISODateLocal(acc.endDate);
    if (!end) return null;
    end.setHours(0, 0, 0, 0);
    var today = startOfToday();
    var dueDay = end.getDate();
    var cur = new Date(today.getFullYear(), today.getMonth(), 1);
    var endMonthStart = new Date(end.getFullYear(), end.getMonth(), 1);
    var n = 0;
    while (cur <= endMonthStart) {
      var y = cur.getFullYear();
      var m = cur.getMonth();
      var dim = lastDayOfMonth(y, m);
      var dom = Math.min(dueDay, dim);
      var due = new Date(y, m, dom);
      due.setHours(0, 0, 0, 0);
      if (due >= today && due <= end) n++;
      cur.setMonth(cur.getMonth() + 1);
    }
    return n;
  }

  function effectiveParcelasRestantes(acc) {
    var auto = countParcelasFromEndDate(acc);
    if (auto !== null) return auto;
    if (acc.parcelasRestantes != null) return acc.parcelasRestantes;
    return null;
  }

  function temporaryExpenseForMonth(acc, monthKey) {
    if (!acc || acc.type !== "temporaria") return 0;
    if (usesAutoParcelasFromEndDate(acc)) {
      var end = parseISODateLocal(acc.endDate);
      var d = dueDateInMonth(monthKey, acc.endDate);
      if (!d || !end) return 0;
      d.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      var today = startOfToday();
      if (d < today || d > end) return 0;
      return acc.amount || 0;
    }
    if (acc.parcelasRestantes != null) {
      if (acc.parcelasRestantes <= 0) return 0;
      if (!isAccountActiveInMonth(acc, monthKey)) return 0;
      return acc.amount || 0;
    }
    if (!isAccountActiveInMonth(acc, monthKey)) return 0;
    return acc.amount || 0;
  }

  /** Despesa temporária para saldo do mês: inclui valor se estiver paga no mês, mesmo quando a regra de vencimento não somaria (ex.: já venceu no mês). */
  function temporaryExpenseForBalance(acc, monthKey) {
    if (!acc || acc.type !== "temporaria") return 0;
    var base = temporaryExpenseForMonth(acc, monthKey);
    if (paidInCalendarMonth(acc.id, monthKey)) {
      if (base > 0) return base;
      return acc.amount || 0;
    }
    return base;
  }

  function firstMonthlyDueFromEndDate(endDateISO, fromStartOfDay) {
    var end = parseISODateLocal(endDateISO);
    if (!end) return null;
    end.setHours(0, 0, 0, 0);
    var dueDay = end.getDate();
    var cur = new Date(fromStartOfDay.getFullYear(), fromStartOfDay.getMonth(), 1);
    var endMonthStart = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cur <= endMonthStart) {
      var y = cur.getFullYear();
      var m = cur.getMonth();
      var dim = lastDayOfMonth(y, m);
      var dom = Math.min(dueDay, dim);
      var due = new Date(y, m, dom);
      due.setHours(0, 0, 0, 0);
      if (due >= fromStartOfDay && due <= end) return due;
      cur.setMonth(cur.getMonth() + 1);
    }
    return null;
  }

  function isAccountGloballyInactive(acc) {
    var eff = effectiveParcelasRestantes(acc);
    if (eff !== null && eff <= 0) return true;
    if (acc.type === "temporaria" && acc.endDate) {
      var endM = acc.endDate.slice(0, 7);
      if (currentMonthKey() > endM) return true;
    }
    return false;
  }

  function isAccountActiveInMonth(acc, monthKey) {
    if (usesAutoParcelasFromEndDate(acc)) {
      var n = countParcelasFromEndDate(acc);
      if (n <= 0) return false;
      var endM = acc.endDate.slice(0, 7);
      if (monthKey > endM) return false;
      return true;
    }
    if (acc.parcelasRestantes != null && acc.parcelasRestantes <= 0) {
      return false;
    }
    if (acc.type === "temporaria" && acc.endDate) {
      var endM2 = acc.endDate.slice(0, 7);
      if (monthKey > endM2) return false;
    }
    return true;
  }

  function projectedExpenseForMonthIndex(acc, monthIndex) {
    var mk = addMonths(state.viewMonth, monthIndex);
    var amt = acc.amount || 0;
    var out = 0;
    if (usesAutoParcelasFromEndDate(acc)) {
      out = temporaryExpenseForMonth(acc, mk);
    } else if (acc.parcelasRestantes != null) {
      if (acc.parcelasRestantes <= 0) return 0;
      out = monthIndex < acc.parcelasRestantes ? amt : 0;
    } else {
      if (!isAccountActiveInMonth(acc, mk)) out = 0;
      else out = amt;
    }
    if (acc.type === "recorrente" && paidInCalendarMonth(acc.id, mk)) {
      return 0;
    }
    return out;
  }

  function computeTotalsForMonth(monthKey, accountList) {
    var recurring = 0;
    var temporary = 0;
    accountList.forEach(function (acc) {
      if (acc.type === "recorrente") {
        if (!isAccountActiveInMonth(acc, monthKey)) return;
        recurring += acc.amount || 0;
      } else {
        var paidM = paidInCalendarMonth(acc.id, monthKey);
        if (!isAccountActiveInMonth(acc, monthKey) && !paidM) return;
        temporary += temporaryExpenseForBalance(acc, monthKey);
      }
    });
    return { recurring: recurring, temporary: temporary };
  }

  function nextRecurringDueDate(acc, fromStartOfDay) {
    if (!acc.dueDay || acc.dueDay < 1 || acc.dueDay > 31) return null;
    var y = fromStartOfDay.getFullYear();
    var m = fromStartOfDay.getMonth();
    var dToday = fromStartOfDay.getDate();
    var cap = Math.min(acc.dueDay, lastDayOfMonth(y, m));
    if (dToday <= cap) {
      return new Date(y, m, cap);
    }
    var nm = m + 1;
    var ny = y;
    if (nm > 11) {
      nm = 0;
      ny++;
    }
    var cap2 = Math.min(acc.dueDay, lastDayOfMonth(ny, nm));
    return new Date(ny, nm, cap2);
  }

  function nextDueDate(acc) {
    var eff = effectiveParcelasRestantes(acc);
    if (eff !== null && eff <= 0) return null;
    if (!isAccountActiveInMonth(acc, currentMonthKey())) return null;
    var from = startOfToday();
    if (acc.type === "recorrente" && acc.dueDay) {
      return nextRecurringDueDate(acc, from);
    }
    if (acc.type === "temporaria" && acc.endDate) {
      if (usesAutoParcelasFromEndDate(acc)) {
        return firstMonthlyDueFromEndDate(acc.endDate, from);
      }
      var p = acc.endDate.split("-");
      var dt = new Date(
        parseInt(p[0], 10),
        parseInt(p[1], 10) - 1,
        parseInt(p[2], 10)
      );
      dt.setHours(0, 0, 0, 0);
      if (dt >= from) return dt;
      return null;
    }
    return null;
  }

  function daysFromTodayTo(targetDate) {
    var a = startOfToday();
    var b = new Date(targetDate);
    b.setHours(0, 0, 0, 0);
    return Math.round((b - a) / 86400000);
  }

  function paidInCalendarMonth(accId, monthKey) {
    var map = state.paidByAccount[accId];
    return map && map[monthKey] === true;
  }

  function ensureUi() {
    if (!state.ui || typeof state.ui !== "object") {
      state.ui = {
        activeTab: "main",
        dueHorizonDays: 7,
        reserveSimPct: 20,
        investSimPct: 15,
        rateNubank: 13,
        rateRF: 12.5,
        ratePoup: 6,
        simNubank: true,
        simRF: true,
        simPoup: false,
        simChartHorizon: 12,
        simChartView: "invest",
        simChartScenarioKey: "nubank",
      };
    }
  }

  function getActiveTab() {
    ensureUi();
    var t = state.ui.activeTab;
    if (t === "due" || t === "invest") return t;
    return "main";
  }

  var els = {};

  function bindEls() {
    els.monthLabel = document.getElementById("monthLabel");
    els.btnPrevMonth = document.getElementById("btnPrevMonth");
    els.btnNextMonth = document.getElementById("btnNextMonth");
    els.btnTodayMonth = document.getElementById("btnTodayMonth");
    els.incomeSourcesList = document.getElementById("incomeSourcesList");
    els.btnAddIncomeSource = document.getElementById("btnAddIncomeSource");
    els.incomeTotalDefault = document.getElementById("incomeTotalDefault");
    els.useMonthIncomeOverride = document.getElementById("useMonthIncomeOverride");
    els.monthIncomeEditor = document.getElementById("monthIncomeEditor");
    els.monthIncomeSourcesList = document.getElementById("monthIncomeSourcesList");
    els.btnAddMonthIncomeSource = document.getElementById("btnAddMonthIncomeSource");
    els.overrideMonthLabel = document.getElementById("overrideMonthLabel");
    els.savingsGoal = document.getElementById("savingsGoal");
    els.savingsGoalMonth = document.getElementById("savingsGoalMonth");
    els.statIncome = document.getElementById("statIncome");
    els.statRecurring = document.getElementById("statRecurring");
    els.statTemporary = document.getElementById("statTemporary");
    els.statBalance = document.getElementById("statBalance");
    els.statFutureDebit = document.getElementById("statFutureDebit");
    els.statFutureCredit = document.getElementById("statFutureCredit");
    els.chartHorizon = document.getElementById("chartHorizon");
    els.form = document.getElementById("accountForm");
    els.accName = document.getElementById("accName");
    els.accType = document.getElementById("accType");
    els.accAmount = document.getElementById("accAmount");
    els.accCategory = document.getElementById("accCategory");
    els.accDueDay = document.getElementById("accDueDay");
    els.accEndDate = document.getElementById("accEndDate");
    els.accParcelas = document.getElementById("accParcelas");
    els.accNotes = document.getElementById("accNotes");
    els.fieldRecurring = document.getElementById("fieldRecurring");
    els.fieldTemporary = document.getElementById("fieldTemporary");
    els.btnSubmit = document.getElementById("btnSubmit");
    els.btnCancelEdit = document.getElementById("btnCancelEdit");
    els.accountList = document.getElementById("accountList");
    els.emptyState = document.getElementById("emptyState");
    els.filterType = document.getElementById("filterType");
    els.filterCategory = document.getElementById("filterCategory");
    els.hidePaid = document.getElementById("hidePaid");
    els.upcomingList = document.getElementById("upcomingList");
    els.upcomingEmpty = document.getElementById("upcomingEmpty");
    els.btnExport = document.getElementById("btnExport");
    els.fileImport = document.getElementById("fileImport");
    els.tabPanelMain = document.getElementById("tabPanelMain");
    els.tabPanelDue = document.getElementById("tabPanelDue");
    els.tabPanelInvest = document.getElementById("tabPanelInvest");
    els.tabBtnMain = document.getElementById("tabBtnMain");
    els.tabBtnDue = document.getElementById("tabBtnDue");
    els.tabBtnInvest = document.getElementById("tabBtnInvest");
    els.dueSoonList = document.getElementById("dueSoonList");
    els.dueSoonEmpty = document.getElementById("dueSoonEmpty");
    els.simReservePct = document.getElementById("simReservePct");
    els.simInvestPct = document.getElementById("simInvestPct");
    els.simPctWarning = document.getElementById("simPctWarning");
    els.simUseNubank = document.getElementById("simUseNubank");
    els.simRateNubank = document.getElementById("simRateNubank");
    els.simUseRF = document.getElementById("simUseRF");
    els.simRateRF = document.getElementById("simRateRF");
    els.simUsePoup = document.getElementById("simUsePoup");
    els.simRatePoup = document.getElementById("simRatePoup");
    els.simChartCanvas = document.getElementById("simChartCanvas");
    els.simChartHorizon = document.getElementById("simChartHorizon");
    els.simChartView = document.getElementById("simChartView");
    els.simChartScenario = document.getElementById("simChartScenario");
    els.simChartScenarioWrap = document.getElementById("simChartScenarioWrap");
    els.simCompoundTotals = document.getElementById("simCompoundTotals");
  }

  function populateCategoryFilter() {
    var sel = els.filterCategory;
    var keep = sel.querySelector('option[value="all"]');
    sel.innerHTML = "";
    sel.appendChild(keep);
    Object.keys(CATEGORY_LABELS).forEach(function (key) {
      var o = document.createElement("option");
      o.value = key;
      o.textContent = CATEGORY_LABELS[key];
      sel.appendChild(o);
    });
  }

  function syncMonthChrome() {
    els.monthLabel.textContent = capitalizeFirst(formatMonthLong(state.viewMonth));
    if (els.overrideMonthLabel) {
      els.overrideMonthLabel.textContent = formatMonthLong(state.viewMonth);
    }
  }

  function capitalizeFirst(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function syncIncomePanel() {
    els.savingsGoal.value =
      state.savingsGoal !== 0 ? String(state.savingsGoal) : "";

    var mk = state.viewMonth;
    var patch = state.byMonth[mk];
    var sgMonth =
      patch && typeof patch.savingsGoal === "number" ? patch.savingsGoal : null;
    els.savingsGoalMonth.value = sgMonth != null ? String(sgMonth) : "";

    var hasOverride = hasIncomeOverride(mk);
    els.useMonthIncomeOverride.checked = hasOverride;
    els.monthIncomeEditor.classList.toggle("is-hidden", !hasOverride);
  }

  function renderIncomeRows(container, sources, kind) {
    container.innerHTML = "";
    sources.forEach(function (src) {
      var row = document.createElement("div");
      row.className = "income-row-line";
      row.dataset.id = src.id;

      var nameLab = document.createElement("label");
      nameLab.className = "field";
      nameLab.innerHTML =
        '<span class="field__label">Nome</span><input type="text" data-field="name" maxlength="80" />';
      nameLab.querySelector("input").value = src.name || "";

      var amtLab = document.createElement("label");
      amtLab.className = "field";
      amtLab.innerHTML =
        '<span class="field__label">Valor (R$)</span><input type="number" data-field="amount" min="0" step="0.01" inputmode="decimal" />';
      amtLab.querySelector("input").value =
        src.amount !== 0 && src.amount != null ? String(src.amount) : "";

      var del = document.createElement("button");
      del.type = "button";
      del.className = "btn btn--ghost btn--small btn--danger income-row-del";
      del.textContent = "Remover";
      del.disabled = sources.length <= 1;

      row.appendChild(nameLab);
      row.appendChild(amtLab);
      row.appendChild(del);

      del.addEventListener("click", function () {
        if (kind === "default") {
          if (state.incomeSources.length <= 1) return;
          state.incomeSources = state.incomeSources.filter(function (s) {
            return s.id !== src.id;
          });
        } else {
          var mk = state.viewMonth;
          var bm = ensureByMonth(mk);
          if (!bm.sources || bm.sources.length <= 1) return;
          bm.sources = bm.sources.filter(function (s) {
            return s.id !== src.id;
          });
          trimEmptyByMonth(mk);
        }
        saveState(state);
        render();
      });

      row.querySelectorAll("input").forEach(function (inp) {
        inp.addEventListener("change", function () {
          applyIncomeRowChange(row, src.id, kind);
        });
        inp.addEventListener("blur", function () {
          applyIncomeRowChange(row, src.id, kind);
        });
      });

      container.appendChild(row);
    });

    if (kind === "default") {
      els.incomeTotalDefault.textContent = formatBRL(
        sumSources(state.incomeSources)
      );
    }
  }

  function ensureByMonth(mk) {
    if (!state.byMonth[mk]) state.byMonth[mk] = {};
    return state.byMonth[mk];
  }

  function trimEmptyByMonth(mk) {
    var b = state.byMonth[mk];
    if (!b) return;
    if (!b.sources || !b.sources.length) {
      delete b.sources;
    }
    if (typeof b.savingsGoal !== "number") {
      delete b.savingsGoal;
    }
    if (!b.sources && typeof b.savingsGoal !== "number") {
      delete state.byMonth[mk];
    }
  }

  function applyIncomeRowChange(row, id, kind) {
    var nameInp = row.querySelector('[data-field="name"]');
    var amtInp = row.querySelector('[data-field="amount"]');
    var name = nameInp.value.trim() || "Fonte";
    var amt = parseMoneyStr(amtInp.value);

    if (kind === "default") {
      var d = state.incomeSources.find(function (s) {
        return s.id === id;
      });
      if (d) {
        d.name = name;
        d.amount = amt;
      }
    } else {
      var mk = state.viewMonth;
      var bm = ensureByMonth(mk);
      if (!bm.sources) bm.sources = cloneSources(state.incomeSources);
      var m = bm.sources.find(function (s) {
        return s.id === id;
      });
      if (m) {
        m.name = name;
        m.amount = amt;
      }
    }
    saveState(state);
    syncIncomePanel();
    els.incomeTotalDefault.textContent = formatBRL(sumSources(state.incomeSources));
    renderStatsAndChart();
  }

  function updateParcelasFieldState() {
    if (!els.accParcelas) return;
    var auto =
      els.accType.value === "temporaria" &&
      els.accEndDate &&
      els.accEndDate.value;
    els.accParcelas.disabled = !!auto;
  }

  function toggleTypeFields() {
    var isRec = els.accType.value === "recorrente";
    els.fieldRecurring.classList.toggle("is-hidden", !isRec);
    els.fieldTemporary.classList.toggle("is-hidden", isRec);
    updateParcelasFieldState();
  }

  function paidThisMonth(accId) {
    var mk = state.viewMonth;
    var map = state.paidByAccount[accId];
    return map && map[mk] === true;
  }

  function setPaidThisMonth(accId, paid) {
    var mk = state.viewMonth;
    if (!state.paidByAccount[accId]) state.paidByAccount[accId] = {};
    state.paidByAccount[accId][mk] = paid;

    var acc = state.accounts.find(function (a) {
      return a.id === accId;
    });
    if (
      acc &&
      acc.parcelasRestantes != null &&
      !usesAutoParcelasFromEndDate(acc)
    ) {
      if (paid) {
        if (acc.parcelasRestantes > 0) acc.parcelasRestantes--;
      } else {
        acc.parcelasRestantes++;
      }
    }

    saveState(state);
    render();
  }

  function renderStatsForViewMonth() {
    var mk = state.viewMonth;
    var income = getIncomeForMonth(mk);
    var goal = getSavingsForMonth(mk);
    var t = computeTotalsForMonth(mk, state.accounts);
    var expenses = t.recurring + t.temporary;
    var balance = income - expenses - goal;

    els.statIncome.textContent = formatBRL(income);
    if (hasIncomeOverride(mk)) {
      els.statIncome.title = "Este mês usa fontes personalizadas.";
    } else {
      els.statIncome.title = "";
    }
    els.statRecurring.textContent = formatBRL(t.recurring);
    els.statTemporary.textContent = formatBRL(t.temporary);
    els.statBalance.textContent = formatBRL(balance);
    els.statBalance.style.color =
      balance >= 0 ? "var(--success)" : "var(--danger)";
  }

  function buildSeries(horizon) {
    var labels = [];
    var incomes = [];
    var expenses = [];
    var debTotal = 0;
    var credTotal = 0;
    var i;
    var baseIncome = sumSources(state.incomeSources);
    var catKeys = Object.keys(CATEGORY_LABELS);
    var expenseByCat = {};
    catKeys.forEach(function (k) {
      expenseByCat[k] = new Array(horizon);
      for (var z = 0; z < horizon; z++) {
        expenseByCat[k][z] = 0;
      }
    });

    for (i = 0; i < horizon; i++) {
      var mk = addMonths(state.viewMonth, i);
      labels.push(formatMonthShort(mk));

      var inc = getIncomeForMonth(mk);
      incomes.push(inc);

      var exp = 0;
      state.accounts.forEach(function (acc) {
        var amt = projectedExpenseForMonthIndex(acc, i);
        exp += amt;
        var ck =
          acc.category && expenseByCat[acc.category] != null
            ? acc.category
            : "outros";
        expenseByCat[ck][i] += amt;
      });
      expenses.push(exp);
      debTotal += exp;

      var patch = state.byMonth[mk];
      if (!patch || !patch.sources || !patch.sources.length) {
        credTotal += baseIncome;
      } else {
        credTotal += sumSources(patch.sources);
      }
    }

    return {
      labels: labels,
      incomes: incomes,
      expenses: expenses,
      debTotal: debTotal,
      credTotal: credTotal,
      expenseByCat: expenseByCat,
    };
  }

  function updateProjectionStats() {
    var horizon = parseInt(els.chartHorizon.value, 10) || 12;
    var series = buildSeries(horizon);
    els.statFutureDebit.textContent = formatBRL(series.debTotal);
    els.statFutureCredit.textContent = formatBRL(series.credTotal);
    return series;
  }

  function applyChartFromSeries(series) {
    var canvas = document.getElementById("barChartFlow");
    if (!canvas || typeof Chart === "undefined") return;

    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    var catKeys = Object.keys(CATEGORY_LABELS);
    var datasets = [
      {
        type: "line",
        label: "Receita",
        data: series.incomes,
        borderColor: "rgba(96, 165, 250, 1)",
        backgroundColor: "rgba(61, 156, 245, 0.12)",
        borderWidth: 2,
        tension: 0.25,
        fill: false,
        yAxisID: "y1",
        order: 0,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        type: "line",
        label: "Total em contas",
        data: series.expenses,
        borderColor: "rgba(251, 191, 36, 1)",
        backgroundColor: "rgba(251, 191, 36, 0.06)",
        borderWidth: 2,
        borderDash: [6, 4],
        tension: 0.2,
        fill: false,
        yAxisID: "y1",
        order: 1,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
    ];

    catKeys.forEach(function (cat) {
      var hasAny = series.expenseByCat[cat].some(function (v) {
        return v > 0;
      });
      if (!hasAny) return;
      datasets.push({
        type: "bar",
        label: CATEGORY_LABELS[cat],
        data: series.expenseByCat[cat],
        stack: "exp",
        backgroundColor: CATEGORY_COLORS[cat],
        borderColor: CATEGORY_BORDERS[cat],
        borderWidth: 1,
        order: 1,
      });
    });

    chartInstance = new Chart(canvas.getContext("2d"), {
      type: "bar",
      data: {
        labels: series.labels,
        datasets: datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: {
            labels: {
              color: "#8b9aad",
              font: { family: "'DM Sans', sans-serif", size: 11 },
            },
          },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var v = ctx.raw;
                if (v == null || v === 0) return null;
                return ctx.dataset.label + ": " + formatBRL(v);
              },
            },
            filter: function (item) {
              return item.raw != null && item.raw > 0;
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            ticks: { color: "#8b9aad", maxRotation: 45 },
            grid: { color: "rgba(42, 53, 68, 0.6)" },
          },
          y: {
            stacked: true,
            position: "left",
            ticks: {
              color: "#8b9aad",
              callback: function (v) {
                return v >= 1000 ? "R$ " + v / 1000 + "k" : "R$ " + v;
              },
            },
            grid: { color: "rgba(42, 53, 68, 0.6)" },
          },
          y1: {
            position: "right",
            stacked: false,
            grid: { drawOnChartArea: false },
            ticks: {
              color: "rgba(96, 165, 250, 0.95)",
              callback: function (v) {
                return v >= 1000 ? "R$ " + v / 1000 + "k" : "R$ " + v;
              },
            },
          },
        },
      },
    });
  }

  function renderStatsAndChart() {
    renderStatsForViewMonth();
    var series = updateProjectionStats();
    if (getActiveTab() === "main") {
      destroyInvestSimChart();
      applyChartFromSeries(series);
      requestAnimationFrame(function () {
        if (chartInstance) chartInstance.resize();
      });
    } else {
      if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
      }
      if (getActiveTab() !== "invest") {
        destroyInvestSimChart();
      }
    }
  }

  function updateTabPanels() {
    ensureUi();
    var t = getActiveTab();
    var panels = {
      main: els.tabPanelMain,
      due: els.tabPanelDue,
      invest: els.tabPanelInvest,
    };
    Object.keys(panels).forEach(function (key) {
      var el = panels[key];
      if (!el) return;
      el.classList.toggle("is-hidden", key !== t);
    });
    [els.tabBtnMain, els.tabBtnDue, els.tabBtnInvest].forEach(function (btn) {
      if (!btn || !btn.dataset.tab) return;
      var act = btn.dataset.tab === t;
      btn.classList.toggle("is-active", act);
      btn.setAttribute("aria-selected", act ? "true" : "false");
    });
  }

  function syncSegmentedDue() {
    ensureUi();
    var days = state.ui.dueHorizonDays;
    document.querySelectorAll("[data-due-days]").forEach(function (btn) {
      var d = parseInt(btn.getAttribute("data-due-days"), 10);
      btn.classList.toggle("is-active", d === days);
    });
  }

  function renderDueSoon() {
    if (!els.dueSoonList || !els.dueSoonEmpty) return;
    ensureUi();
    var horizon = state.ui.dueHorizonDays || 7;
    var mkReal = currentMonthKey();
    var items = [];

    state.accounts.forEach(function (acc) {
      var nd = nextDueDate(acc);
      if (!nd) return;
      var days = daysFromTodayTo(nd);
      if (days < 0 || days > horizon) return;
      items.push({ acc: acc, date: nd, days: days });
    });

    items.sort(function (a, b) {
      return a.date - b.date;
    });

    els.dueSoonList.innerHTML = "";
    els.dueSoonEmpty.classList.toggle("is-hidden", items.length > 0);

    items.forEach(function (it) {
      var acc = it.acc;
      var li = document.createElement("li");
      li.className = "account-card";
      li.dataset.type = acc.type;
      if (paidInCalendarMonth(acc.id, mkReal)) li.classList.add("is-paid");

      var when = it.date.toLocaleDateString("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      });
      var daysLabel =
        it.days === 0
          ? "Hoje"
          : it.days === 1
            ? "Amanhã"
            : "Em " + it.days + " dias";

      var row = document.createElement("div");
      row.className = "account-card__top";
      var nameEl = document.createElement("p");
      nameEl.className = "account-card__name";
      nameEl.textContent = acc.name;
      var dueBadge = document.createElement("span");
      dueBadge.className = "due-date-badge";
      dueBadge.textContent = daysLabel;
      row.appendChild(nameEl);
      row.appendChild(dueBadge);

      var meta = document.createElement("p");
      meta.className = "account-card__meta";
      var parts = [
        when,
        CATEGORY_LABELS[acc.category] || acc.category,
        acc.type === "recorrente" ? "Recorrente" : "Temporária",
      ];
      if (paidInCalendarMonth(acc.id, mkReal)) {
        parts.push("Paga no mês corrente");
      }
      meta.textContent = parts.join(" · ");

      var amount = document.createElement("div");
      amount.className = "account-card__amount";
      amount.textContent = formatBRL(acc.amount || 0);

      li.appendChild(row);
      li.appendChild(meta);
      li.appendChild(amount);
      els.dueSoonList.appendChild(li);
    });
  }

  function monthlyRateFromAnnual(annualPct) {
    var a = Number(annualPct);
    if (!isFinite(a) || a <= -100) return 0;
    return Math.pow(1 + a / 100, 1 / 12) - 1;
  }

  function syncSimFieldsFromState() {
    ensureUi();
    var u = state.ui;
    if (els.simReservePct) els.simReservePct.value = String(u.reserveSimPct);
    if (els.simInvestPct) els.simInvestPct.value = String(u.investSimPct);
    if (els.simRateNubank) els.simRateNubank.value = String(u.rateNubank);
    if (els.simRateRF) els.simRateRF.value = String(u.rateRF);
    if (els.simRatePoup) els.simRatePoup.value = String(u.ratePoup);
    if (els.simUseNubank) els.simUseNubank.checked = !!u.simNubank;
    if (els.simUseRF) els.simUseRF.checked = !!u.simRF;
    if (els.simUsePoup) els.simUsePoup.checked = !!u.simPoup;
    if (els.simChartHorizon) {
      els.simChartHorizon.value = String(u.simChartHorizon);
    }
    if (els.simChartView) {
      els.simChartView.value =
        u.simChartView === "reserve" ? "reserve" : "invest";
    }
  }

  function readSimFieldsToState() {
    ensureUi();
    var u = state.ui;
    if (els.simReservePct) {
      u.reserveSimPct = Math.max(
        0,
        Math.min(100, parseFloat(els.simReservePct.value) || 0)
      );
    }
    if (els.simInvestPct) {
      u.investSimPct = Math.max(
        0,
        Math.min(100, parseFloat(els.simInvestPct.value) || 0)
      );
    }
    if (els.simRateNubank) u.rateNubank = parseFloat(els.simRateNubank.value) || 0;
    if (els.simRateRF) u.rateRF = parseFloat(els.simRateRF.value) || 0;
    if (els.simRatePoup) u.ratePoup = parseFloat(els.simRatePoup.value) || 0;
    if (els.simUseNubank) u.simNubank = els.simUseNubank.checked;
    if (els.simUseRF) u.simRF = els.simUseRF.checked;
    if (els.simUsePoup) u.simPoup = els.simUsePoup.checked;
    if (els.simChartHorizon) {
      var ch = parseInt(els.simChartHorizon.value, 10);
      u.simChartHorizon = ch === 6 || ch === 24 ? ch : 12;
    }
    if (els.simChartView) {
      u.simChartView =
        els.simChartView.value === "reserve" ? "reserve" : "invest";
    }
    if (
      els.simChartScenario &&
      els.simChartScenarioWrap &&
      !els.simChartScenarioWrap.classList.contains("is-hidden")
    ) {
      u.simChartScenarioKey =
        els.simChartScenario.value || u.simChartScenarioKey;
    }
    saveState(state);
  }

  function destroyInvestSimChart() {
    if (investSimChartInstance) {
      var cn = investSimChartInstance.canvas;
      if (cn && cn.parentNode) {
        var tip = cn.parentNode.querySelector(".sim-chart-tooltip");
        if (tip) tip.remove();
      }
      investSimChartInstance.destroy();
      investSimChartInstance = null;
    }
  }

  function simCumulativeAporteJuros(contribArr, interestArr) {
    var n = contribArr ? contribArr.length : 0;
    var aporteCum = [];
    var jurosCum = [];
    var ca = 0;
    var cj = 0;
    for (var i = 0; i < n; i++) {
      ca += Number(contribArr[i]) || 0;
      if (interestArr && interestArr.length > i) {
        cj += Number(interestArr[i]) || 0;
      }
      aporteCum.push(ca);
      jurosCum.push(cj);
    }
    return { aporte: aporteCum, juros: jurosCum };
  }

  function applyInvestSimChart(payload) {
    var canvas = els.simChartCanvas;
    if (!canvas || typeof Chart === "undefined") return;
    destroyInvestSimChart();
    var labels = payload.labels;
    if (!labels || !labels.length) return;

    var datasets = [];
    if (payload.view === "reserve") {
      datasets.push({
        type: "bar",
        label: "Aporte Caixinha (mês)",
        data: payload.reserveContrib,
        backgroundColor: "rgba(52, 211, 153, 0.75)",
        borderColor: "rgba(45, 212, 191, 1)",
        borderWidth: 1,
        order: 1,
        yAxisID: "y",
      });
      if (payload.reserveInterest && payload.reserveInterest.length) {
        datasets.push({
          type: "line",
          label: "Juros no mês (~100% CDI)",
          data: payload.reserveInterest,
          borderColor: "rgba(244, 114, 182, 1)",
          backgroundColor: "rgba(244, 114, 182, 0.08)",
          borderWidth: 2,
          tension: 0.25,
          fill: false,
          pointRadius: 3,
          pointHoverRadius: 5,
          order: 0,
          yAxisID: "y1",
        });
      }
      datasets.push({
        type: "line",
        label: "Saldo Caixinha Nubank (total)",
        data: payload.reserveTotal,
        borderColor: "rgba(251, 191, 36, 1)",
        backgroundColor: "rgba(251, 191, 36, 0.08)",
        borderWidth: 2,
        borderDash: [6, 4],
        tension: 0.25,
        fill: false,
        pointRadius: 3,
        pointHoverRadius: 5,
        order: 0,
        yAxisID: "y1",
      });
    } else {
      datasets.push({
        type: "bar",
        label: "Aporte investimento (mês)",
        data: payload.investContrib,
        backgroundColor: "rgba(96, 165, 250, 0.72)",
        borderColor: "rgba(59, 130, 246, 1)",
        borderWidth: 1,
        order: 1,
        yAxisID: "y",
      });
      if (payload.hasCompound && payload.interest && payload.totalInv) {
        datasets.push({
          type: "line",
          label: "Juros no mês (" + payload.scenarioShort + ")",
          data: payload.interest,
          borderColor: "rgba(244, 114, 182, 1)",
          backgroundColor: "rgba(244, 114, 182, 0.08)",
          borderWidth: 2,
          tension: 0.25,
          fill: false,
          pointRadius: 3,
          pointHoverRadius: 5,
          order: 0,
          yAxisID: "y1",
        });
        datasets.push({
          type: "line",
          label: "Patrimônio total (" + payload.scenarioShort + ")",
          data: payload.totalInv,
          borderColor: "rgba(167, 139, 250, 1)",
          backgroundColor: "rgba(139, 92, 246, 0.1)",
          borderWidth: 2,
          tension: 0.22,
          fill: false,
          pointRadius: 3,
          pointHoverRadius: 5,
          order: 0,
          yAxisID: "y1",
        });
      } else {
        datasets.push({
          type: "line",
          label: "Acumulado (soma dos aportes)",
          data: payload.simpleCumulative,
          borderColor: "rgba(167, 139, 250, 1)",
          backgroundColor: "rgba(139, 92, 246, 0.08)",
          borderWidth: 2,
          tension: 0.22,
          fill: false,
          pointRadius: 3,
          pointHoverRadius: 5,
          order: 0,
          yAxisID: "y1",
        });
      }
    }

    var contribForCum = [];
    var interestForCum = null;
    if (payload.view === "reserve") {
      contribForCum = payload.reserveContrib || [];
      interestForCum = payload.reserveInterest || [];
    } else {
      contribForCum = payload.investContrib || [];
      interestForCum =
        payload.hasCompound && payload.interest ? payload.interest : [];
    }
    var cumSim = simCumulativeAporteJuros(contribForCum, interestForCum);
    var COLOR_APORTE_CUM = "rgb(6, 182, 212)";
    var COLOR_JUROS_CUM = "rgb(249, 115, 22)";

    function externalSimTooltip(context) {
      var chart = context.chart;
      var tooltip = context.tooltip;
      var parent = chart.canvas.parentNode;
      if (!parent) return;
      var tooltipEl = parent.querySelector(".sim-chart-tooltip");
      if (!tooltipEl) {
        tooltipEl = document.createElement("div");
        tooltipEl.className = "sim-chart-tooltip";
        tooltipEl.setAttribute("role", "tooltip");
        parent.appendChild(tooltipEl);
      }
      if (tooltip.opacity === 0) {
        tooltipEl.style.opacity = "0";
        return;
      }
      var dps = tooltip.dataPoints;
      if (!dps || !dps.length) {
        tooltipEl.style.opacity = "0";
        return;
      }
      var idx = dps[0].dataIndex;
      var titleText =
        tooltip.title && tooltip.title.length
          ? tooltip.title.join("<br/>")
          : (chart.data.labels && chart.data.labels[idx]) || "";
      var rows = [];
      dps.forEach(function (dp) {
        var v = dp.raw;
        if (v == null || !isFinite(v)) return;
        var ds = dp.dataset;
        var lab = ds.label || "";
        var bc = ds.borderColor;
        var col =
          typeof bc === "string"
            ? bc
            : bc && bc.length
              ? bc[0]
              : "#94a3b8";
        rows.push(
          '<div class="sim-chart-tooltip__row">' +
            '<span class="sim-chart-tooltip__swatch" style="background:' +
            col +
            '"></span><span class="sim-chart-tooltip__text">' +
            lab +
            ": " +
            formatBRL(v) +
            "</span></div>"
        );
      });
      if (idx >= 0 && idx < cumSim.aporte.length && idx < cumSim.juros.length) {
        rows.push(
          '<div class="sim-chart-tooltip__extras">' +
            '<div class="sim-chart-tooltip__row">' +
            '<span class="sim-chart-tooltip__swatch" style="background:' +
            COLOR_APORTE_CUM +
            '"></span><span class="sim-chart-tooltip__text">Aporte total (até este mês): ' +
            formatBRL(cumSim.aporte[idx]) +
            "</span></div>" +
            '<div class="sim-chart-tooltip__row">' +
            '<span class="sim-chart-tooltip__swatch" style="background:' +
            COLOR_JUROS_CUM +
            '"></span><span class="sim-chart-tooltip__text">Juros total (até este mês): ' +
            formatBRL(cumSim.juros[idx]) +
            "</span></div></div>"
        );
      }
      tooltipEl.innerHTML =
        '<div class="sim-chart-tooltip__title">' +
        titleText +
        "</div>" +
        rows.join("");
      tooltipEl.style.opacity = "1";
      var cnv = chart.canvas;
      tooltipEl.style.transform = "translate(-50%, calc(-100% - 10px))";
      tooltipEl.style.left = cnv.offsetLeft + tooltip.caretX + "px";
      tooltipEl.style.top = cnv.offsetTop + tooltip.caretY + "px";
    }

    investSimChartInstance = new Chart(canvas.getContext("2d"), {
      type: "bar",
      data: {
        labels: labels,
        datasets: datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: {
            labels: {
              color: "#8b9aad",
              font: { family: "'DM Sans', sans-serif", size: 11 },
            },
          },
          tooltip: {
            enabled: false,
            external: externalSimTooltip,
          },
        },
        scales: {
          x: {
            ticks: { color: "#8b9aad", maxRotation: 45 },
            grid: { color: "rgba(42, 53, 68, 0.6)" },
          },
          y: {
            position: "left",
            stacked: false,
            ticks: {
              color: "#8b9aad",
              callback: function (v) {
                return v >= 1000 ? "R$ " + v / 1000 + "k" : "R$ " + v;
              },
            },
            grid: { color: "rgba(42, 53, 68, 0.6)" },
          },
          y1: {
            position: "right",
            grid: { drawOnChartArea: false },
            ticks: {
              color: "rgba(167, 139, 250, 0.95)",
              callback: function (v) {
                return v >= 1000 ? "R$ " + v / 1000 + "k" : "R$ " + v;
              },
            },
          },
        },
      },
    });
  }

  function renderInvestSimulation() {
    if (!els.simReservePct) return;
    ensureUi();
    syncSimFieldsFromState();
    var u = state.ui;
    var resPct = Math.max(0, Math.min(100, u.reserveSimPct)) / 100;
    var invPct = Math.max(0, Math.min(100, u.investSimPct)) / 100;
    if (els.simPctWarning) {
      var over = resPct + invPct > 1.0001;
      els.simPctWarning.classList.toggle("is-hidden", !over);
      els.simPctWarning.textContent = over
        ? "A soma das % ultrapassa 100% do sobra mensal: os dois aportes usam o mesmo valor base (planejamento agressivo)."
        : "";
    }

    var horizon = 24;
    var s = buildSeries(horizon);
    var h = s.labels.length;
    var scenarios = [];
    if (u.simNubank) {
      scenarios.push({
        key: "nubank",
        name: "Caixinha / CDI",
        rate: u.rateNubank,
      });
    }
    if (u.simRF) {
      scenarios.push({
        key: "rf",
        name: "Renda fixa (referência)",
        rate: u.rateRF,
      });
    }
    if (u.simPoup) {
      scenarios.push({
        key: "poup",
        name: "Poupança (referência)",
        rate: u.ratePoup,
      });
    }

    if (els.simChartScenarioWrap && els.simChartScenario) {
      if (scenarios.length) {
        els.simChartScenarioWrap.classList.remove("is-hidden");
        els.simChartScenario.innerHTML = "";
        var keyList = [];
        scenarios.forEach(function (sc) {
          keyList.push(sc.key);
          var o = document.createElement("option");
          o.value = sc.key;
          o.textContent = sc.name + " (" + sc.rate + "% a.a.)";
          els.simChartScenario.appendChild(o);
        });
        if (keyList.indexOf(u.simChartScenarioKey) === -1) {
          u.simChartScenarioKey = keyList[0];
          saveState(state);
        }
        els.simChartScenario.value = u.simChartScenarioKey;
      } else {
        els.simChartScenarioWrap.classList.add("is-hidden");
      }
    }

    var runningReserve = 0;
    var runningInv = {};
    scenarios.forEach(function (sc) {
      runningInv[sc.key] = 0;
    });

    var investContribFull = [];
    var reserveContribFull = [];
    var reserveTotalFull = [];
    var reserveInterestFull = [];
    var rmRes = monthlyRateFromAnnual(u.rateNubank);
    var bySc = {};
    scenarios.forEach(function (sc) {
      bySc[sc.key] = { interest: [], total: [] };
    });

    for (var i = 0; i < h; i++) {
      var mk = addMonths(state.viewMonth, i);
      var inc = s.incomes[i];
      var exp = s.expenses[i];
      var goal = getSavingsForMonth(mk);
      var rem = inc - exp - goal;
      var pos = Math.max(0, rem);
      var ci = pos * invPct;
      var cr = pos * resPct;
      investContribFull.push(ci);
      reserveContribFull.push(cr);
      var bbRes = runningReserve;
      var intRes = bbRes * rmRes;
      runningReserve = bbRes * (1 + rmRes) + cr;
      reserveInterestFull.push(intRes);
      reserveTotalFull.push(runningReserve);
      scenarios.forEach(function (sc) {
        var rm = monthlyRateFromAnnual(sc.rate);
        var bb = runningInv[sc.key];
        runningInv[sc.key] = bb * (1 + rm) + ci;
        bySc[sc.key].interest.push(bb * rm);
        bySc[sc.key].total.push(runningInv[sc.key]);
      });
    }

    var sumResAportes = reserveContribFull.reduce(function (a, b) {
      return a + b;
    }, 0);
    var reserveJurosTotal = Math.max(0, runningReserve - sumResAportes);
    var sumInvAportes = investContribFull.reduce(function (a, b) {
      return a + b;
    }, 0);
    var invJurosByKey = {};
    scenarios.forEach(function (sc) {
      invJurosByKey[sc.key] = Math.max(0, runningInv[sc.key] - sumInvAportes);
    });

    var simpleCumulative = [];
    var runC = 0;
    for (var j = 0; j < h; j++) {
      runC += investContribFull[j];
      simpleCumulative.push(runC);
    }

    var H = Math.min(u.simChartHorizon, h);
    var sliceArr = function (arr) {
      return arr.slice(0, H);
    };
    var chartLabels = s.labels.slice(0, H);

    var chartScenario = null;
    for (var q = 0; q < scenarios.length; q++) {
      if (scenarios[q].key === u.simChartScenarioKey) {
        chartScenario = scenarios[q];
        break;
      }
    }
    if (!chartScenario && scenarios.length) {
      chartScenario = scenarios[0];
    }

    if (getActiveTab() === "invest" && els.simChartCanvas) {
      if (u.simChartView === "reserve") {
        applyInvestSimChart({
          labels: chartLabels,
          view: "reserve",
          reserveContrib: sliceArr(reserveContribFull),
          reserveInterest: sliceArr(reserveInterestFull),
          reserveTotal: sliceArr(reserveTotalFull),
        });
      } else {
        var hasC = scenarios.length > 0 && chartScenario;
        applyInvestSimChart({
          labels: chartLabels,
          view: "invest",
          investContrib: sliceArr(investContribFull),
          hasCompound: !!hasC,
          interest: hasC
            ? sliceArr(bySc[chartScenario.key].interest)
            : null,
          totalInv: hasC
            ? sliceArr(bySc[chartScenario.key].total)
            : null,
          simpleCumulative: sliceArr(simpleCumulative),
          scenarioShort: chartScenario
            ? chartScenario.name
            : "",
        });
      }
      requestAnimationFrame(function () {
        if (investSimChartInstance) investSimChartInstance.resize();
      });
    } else {
      destroyInvestSimChart();
    }

    if (els.simCompoundTotals) {
      var cdiPct = u.rateNubank;
      var resP =
        "<p><strong>Reserva (Caixinha Nubank, ~100% CDI):</strong> na projeção de " +
        h +
        " mês(es), com taxa de referência <strong>" +
        cdiPct +
        "% a.a.</strong>, o total de <strong>juros compostos</strong> (rendimento acumulado) foi " +
        formatBRL(reserveJurosTotal) +
        ". Saldo ao final: " +
        formatBRL(runningReserve) +
        " (aportes somados: " +
        formatBRL(sumResAportes) +
        ").</p>";
      var invP = "";
      if (scenarios.length && chartScenario) {
        var ij = invJurosByKey[chartScenario.key];
        if (ij == null || !isFinite(ij)) ij = 0;
        ij = Math.max(0, ij);
        invP =
          "<p><strong>Investimento (" +
          chartScenario.name +
          ", " +
          chartScenario.rate +
          "% a.a.):</strong> total de juros na mesma projeção: " +
          formatBRL(ij) +
          ". Patrimônio ao final: " +
          formatBRL(runningInv[chartScenario.key]) +
          " (aportes somados: " +
          formatBRL(sumInvAportes) +
          ").</p>";
      } else {
        invP =
          "<p><strong>Investimento:</strong> marque ao menos um cenário acima para estimar juros compostos; sem cenário, o gráfico usa só a soma dos aportes (juros = 0).</p>";
      }
      els.simCompoundTotals.innerHTML = resP + invP;
    }
  }

  function renderInvestTab() {
    ensureUi();
    syncSimFieldsFromState();
    renderInvestSimulation();
  }

  function getFilteredAccounts() {
    var typeF = els.filterType.value;
    var catF = els.filterCategory.value;
    var hidePaid = els.hidePaid.checked;

    return state.accounts.filter(function (acc) {
      if (typeF !== "all" && acc.type !== typeF) return false;
      if (catF !== "all" && acc.category !== catF) return false;
      if (hidePaid && paidThisMonth(acc.id)) return false;
      return true;
    });
  }

  function formatDateBR(iso) {
    if (!iso) return "";
    var p = iso.split("-");
    if (p.length !== 3) return iso;
    return p[2] + "/" + p[1] + "/" + p[0];
  }

  function renderList() {
    var list = getFilteredAccounts();
    els.accountList.innerHTML = "";

    var hasAny = state.accounts.length > 0;
    els.emptyState.classList.toggle("is-hidden", hasAny);
    if (!hasAny) {
      renderStatsAndChart();
      return;
    }

    list.forEach(function (acc) {
      var li = document.createElement("li");
      li.className = "account-card";
      li.dataset.type = acc.type;
      if (paidThisMonth(acc.id)) li.classList.add("is-paid");
      if (isAccountGloballyInactive(acc)) {
        li.classList.add("account-card--inactive");
      }

      var typeLabel =
        acc.type === "recorrente" ? "Recorrente" : "Temporária";
      var badgeClass =
        acc.type === "recorrente" ? "badge" : "badge badge--temp";

      var metaParts = [];
      metaParts.push(CATEGORY_LABELS[acc.category] || acc.category);
      if (acc.type === "recorrente" && acc.dueDay) {
        metaParts.push("Vence dia " + acc.dueDay);
      }
      if (acc.type === "temporaria" && acc.endDate) {
        metaParts.push("Até " + formatDateBR(acc.endDate));
      }
      var effP = effectiveParcelasRestantes(acc);
      if (effP != null) {
        if (usesAutoParcelasFromEndDate(acc)) {
          metaParts.push(
            effP + " parcela(s) a vencer (dia " + acc.endDate.slice(8, 10) + " até " + formatDateBR(acc.endDate) + ")"
          );
        } else {
          metaParts.push(effP + " parcela(s) restante(s)");
        }
      }
      if (acc.notes) metaParts.push(acc.notes);

      var block = document.createElement("div");
      var row = document.createElement("div");
      row.className = "account-card__top";
      var nameEl = document.createElement("p");
      nameEl.className = "account-card__name";
      nameEl.textContent = acc.name;
      var badge = document.createElement("span");
      badge.className = badgeClass;
      badge.textContent = typeLabel;
      row.appendChild(nameEl);
      row.appendChild(badge);
      var meta = document.createElement("p");
      meta.className = "account-card__meta";
      meta.textContent = metaParts.join(" · ");
      block.appendChild(row);
      block.appendChild(meta);

      var amount = document.createElement("div");
      amount.className = "account-card__amount";
      amount.textContent = formatBRL(acc.amount || 0);

      var actions = document.createElement("div");
      actions.className = "account-card__actions";

      var btnPaid = document.createElement("button");
      btnPaid.type = "button";
      btnPaid.className = "btn btn--ghost btn--small";
      btnPaid.textContent = paidThisMonth(acc.id)
        ? "Desmarcar paga (mês)"
        : "Marcar paga neste mês";

      btnPaid.addEventListener("click", function () {
        setPaidThisMonth(acc.id, !paidThisMonth(acc.id));
      });

      var btnEdit = document.createElement("button");
      btnEdit.type = "button";
      btnEdit.className = "btn btn--ghost btn--small";
      btnEdit.textContent = "Editar";

      btnEdit.addEventListener("click", function () {
        startEdit(acc);
      });

      var btnDel = document.createElement("button");
      btnDel.type = "button";
      btnDel.className = "btn btn--ghost btn--small btn--danger";
      btnDel.textContent = "Excluir";

      btnDel.addEventListener("click", function () {
        if (confirm('Excluir "' + acc.name + '"?')) {
          removeAccount(acc.id);
        }
      });

      actions.appendChild(btnPaid);
      actions.appendChild(btnEdit);
      actions.appendChild(btnDel);

      li.appendChild(block);
      li.appendChild(amount);
      li.appendChild(actions);
      els.accountList.appendChild(li);
    });

    if (list.length === 0 && hasAny) {
      var empty = document.createElement("li");
      empty.className = "empty-state";
      empty.textContent =
        "Nenhuma conta corresponde aos filtros. Ajuste acima ou desmarque “ocultar pagas”.";
      els.accountList.appendChild(empty);
    }

    renderStatsAndChart();
  }

  function renderUpcoming() {
    els.upcomingList.innerHTML = "";
    var recurring = state.accounts.filter(function (a) {
      return (
        a.type === "recorrente" &&
        a.dueDay &&
        a.dueDay >= 1 &&
        a.dueDay <= 31 &&
        isAccountActiveInMonth(a, state.viewMonth)
      );
    });
    recurring.sort(function (a, b) {
      return (a.dueDay || 0) - (b.dueDay || 0);
    });

    els.upcomingEmpty.classList.toggle("is-hidden", recurring.length > 0);

    recurring.forEach(function (acc) {
      var li = document.createElement("li");
      var left = document.createElement("span");
      var daySpan = document.createElement("span");
      daySpan.className = "day";
      daySpan.textContent = "Dia " + acc.dueDay;
      left.appendChild(daySpan);
      left.appendChild(document.createTextNode(" · "));
      left.appendChild(document.createTextNode(acc.name));
      var right = document.createElement("span");
      right.className = "muted";
      right.textContent = formatBRL(acc.amount || 0);
      li.appendChild(left);
      li.appendChild(right);
      els.upcomingList.appendChild(li);
    });
  }

  function renderIncomeSection() {
    renderIncomeRows(els.incomeSourcesList, state.incomeSources, "default");

    var mk = state.viewMonth;
    if (els.useMonthIncomeOverride.checked) {
      if (!hasIncomeOverride(mk)) {
        ensureByMonth(mk).sources = cloneSources(state.incomeSources);
        saveState(state);
      }
      renderIncomeRows(
        els.monthIncomeSourcesList,
        state.byMonth[mk].sources,
        "month"
      );
    } else {
      els.monthIncomeSourcesList.innerHTML = "";
    }
  }

  function render() {
    ensureUi();
    syncMonthChrome();
    syncIncomePanel();
    renderIncomeSection();
    renderList();
    renderUpcoming();
    updateTabPanels();
    syncSegmentedDue();
    renderDueSoon();
    renderInvestTab();
  }

  function removeAccount(id) {
    state.accounts = state.accounts.filter(function (a) {
      return a.id !== id;
    });
    delete state.paidByAccount[id];
    if (editingId === id) cancelEdit();
    saveState(state);
    render();
  }

  function startEdit(acc) {
    editingId = acc.id;
    els.accName.value = acc.name;
    els.accType.value = acc.type;
    els.accAmount.value = acc.amount != null ? String(acc.amount) : "";
    els.accCategory.value = acc.category || "outros";
    els.accDueDay.value = acc.dueDay != null ? String(acc.dueDay) : "";
    els.accEndDate.value = acc.endDate || "";
    if (usesAutoParcelasFromEndDate(acc)) {
      els.accParcelas.value = "";
    } else {
      els.accParcelas.value =
        acc.parcelasRestantes != null ? String(acc.parcelasRestantes) : "";
    }
    els.accNotes.value = acc.notes || "";
    toggleTypeFields();
    updateParcelasFieldState();
    els.btnSubmit.textContent = "Salvar alterações";
    els.btnCancelEdit.classList.remove("is-hidden");
    els.form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function cancelEdit() {
    editingId = null;
    els.form.reset();
    if (els.accParcelas) els.accParcelas.disabled = false;
    els.btnSubmit.textContent = "Adicionar";
    els.btnCancelEdit.classList.add("is-hidden");
    toggleTypeFields();
  }

  function onSubmit(e) {
    e.preventDefault();
    var name = els.accName.value.trim();
    if (!name) return;

    var endDateVal =
      els.accType.value === "temporaria" ? els.accEndDate.value || null : null;
    var parcelasRestantes = null;
    if (!(els.accType.value === "temporaria" && endDateVal)) {
      var parcelasRaw = els.accParcelas.value.trim();
      parcelasRestantes =
        parcelasRaw === ""
          ? null
          : Math.max(0, parseInt(parcelasRaw, 10) || 0);
    }

    var acc = {
      id: editingId || uid(),
      name: name,
      type: els.accType.value,
      amount: parseMoneyEl(els.accAmount),
      category: els.accCategory.value,
      dueDay:
        els.accType.value === "recorrente"
          ? parseInt(els.accDueDay.value, 10) || null
          : null,
      endDate: endDateVal,
      parcelasRestantes: parcelasRestantes,
      notes: els.accNotes.value.trim() || "",
    };

    if (editingId) {
      var idx = state.accounts.findIndex(function (a) {
        return a.id === editingId;
      });
      if (idx !== -1) state.accounts[idx] = acc;
    } else {
      state.accounts.push(acc);
    }

    saveState(state);
    cancelEdit();
    render();
  }

  function shiftMonth(delta) {
    state.viewMonth = addMonths(state.viewMonth, delta);
    saveState(state);
    render();
  }

  function onToggleIncomeOverride() {
    var mk = state.viewMonth;
    var on = els.useMonthIncomeOverride.checked;
    if (on) {
      var bm = ensureByMonth(mk);
      if (!bm.sources || !bm.sources.length) {
        bm.sources = cloneSources(state.incomeSources);
      }
    } else {
      var b = state.byMonth[mk];
      if (b) {
        delete b.sources;
        trimEmptyByMonth(mk);
      }
    }
    saveState(state);
    render();
  }

  function onSavingsGoalGlobal() {
    state.savingsGoal = parseMoneyEl(els.savingsGoal);
    saveState(state);
    renderStatsAndChart();
  }

  function onSavingsGoalMonth() {
    var mk = state.viewMonth;
    var raw = els.savingsGoalMonth.value.trim();
    var bm = ensureByMonth(mk);
    if (raw === "") {
      delete bm.savingsGoal;
      trimEmptyByMonth(mk);
    } else {
      bm.savingsGoal = parseMoneyStr(raw);
    }
    saveState(state);
    renderStatsAndChart();
  }

  function addIncomeSourceDefault() {
    state.incomeSources.push({ id: uid(), name: "Nova fonte", amount: 0 });
    saveState(state);
    render();
  }

  function addIncomeSourceMonth() {
    var mk = state.viewMonth;
    var bm = ensureByMonth(mk);
    if (!bm.sources || !bm.sources.length) {
      bm.sources = cloneSources(state.incomeSources);
    }
    bm.sources.push({ id: uid(), name: "Nova fonte", amount: 0 });
    saveState(state);
    render();
  }

  function exportJSON() {
    var blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "organizador-contas-" + todayISODate() + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importJSON(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        state = migrateState(data);
        saveState(state);
        cancelEdit();
        render();
        alert("Dados importados com sucesso.");
      } catch (err) {
        alert("Arquivo JSON inválido.");
      }
    };
    reader.readAsText(file, "UTF-8");
  }

  function wireEvents() {
    els.btnPrevMonth.addEventListener("click", function () {
      shiftMonth(-1);
    });
    els.btnNextMonth.addEventListener("click", function () {
      shiftMonth(1);
    });
    els.btnTodayMonth.addEventListener("click", function () {
      state.viewMonth = currentMonthKey();
      saveState(state);
      render();
    });

    els.btnAddIncomeSource.addEventListener("click", addIncomeSourceDefault);
    els.btnAddMonthIncomeSource.addEventListener("click", addIncomeSourceMonth);
    els.useMonthIncomeOverride.addEventListener(
      "change",
      onToggleIncomeOverride
    );

    els.savingsGoal.addEventListener("change", onSavingsGoalGlobal);
    els.savingsGoal.addEventListener("blur", onSavingsGoalGlobal);
    els.savingsGoalMonth.addEventListener("change", onSavingsGoalMonth);
    els.savingsGoalMonth.addEventListener("blur", onSavingsGoalMonth);

    els.chartHorizon.addEventListener("change", renderStatsAndChart);

    [els.tabBtnMain, els.tabBtnDue, els.tabBtnInvest].forEach(function (btn) {
      if (!btn) return;
      btn.addEventListener("click", function () {
        ensureUi();
        state.ui.activeTab = btn.dataset.tab || "main";
        saveState(state);
        updateTabPanels();
        renderStatsAndChart();
        renderDueSoon();
        renderInvestTab();
        syncSegmentedDue();
      });
    });

    document.querySelectorAll("[data-due-days]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var d = parseInt(btn.getAttribute("data-due-days"), 10);
        if (!isFinite(d)) return;
        ensureUi();
        state.ui.dueHorizonDays = d;
        saveState(state);
        syncSegmentedDue();
        renderDueSoon();
      });
    });

    function onSimFieldChange() {
      readSimFieldsToState();
      renderInvestSimulation();
    }
    [
      els.simReservePct,
      els.simInvestPct,
      els.simRateNubank,
      els.simRateRF,
      els.simRatePoup,
      els.simUseNubank,
      els.simUseRF,
      els.simUsePoup,
      els.simChartHorizon,
      els.simChartView,
      els.simChartScenario,
    ].forEach(function (el) {
      if (!el) return;
      el.addEventListener("input", onSimFieldChange);
      el.addEventListener("change", onSimFieldChange);
    });

    els.accType.addEventListener("change", toggleTypeFields);
    if (els.accEndDate) {
      els.accEndDate.addEventListener("change", updateParcelasFieldState);
      els.accEndDate.addEventListener("input", updateParcelasFieldState);
    }
    els.form.addEventListener("submit", onSubmit);
    els.btnCancelEdit.addEventListener("click", cancelEdit);

    els.filterType.addEventListener("change", renderList);
    els.filterCategory.addEventListener("change", renderList);
    els.hidePaid.addEventListener("change", renderList);

    els.btnExport.addEventListener("click", exportJSON);
    els.fileImport.addEventListener("change", function () {
      var f = els.fileImport.files && els.fileImport.files[0];
      if (f) importJSON(f);
      els.fileImport.value = "";
    });
  }

  bindEls();
  populateCategoryFilter();
  wireEvents();

  els.savingsGoal.value =
    state.savingsGoal !== 0 ? String(state.savingsGoal) : "";

  toggleTypeFields();
  render();
})();
