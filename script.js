
const STORAGE_KEY = "finora_transactions_v1";
const BUDGET_KEY = "finora_budget_v1";

const categories = {
  income: ["Gaji", "Uang Saku", "Bonus", "Investasi", "Lainnya"],
  expense: ["Makanan", "Transportasi", "Belanja", "Tagihan", "Pendidikan", "Hiburan", "Kesehatan", "Lainnya"]
};

const colors = [
  "#16a779", "#5588e8", "#f2b544", "#9569dc",
  "#e75a68", "#43b6c8", "#ed8a50", "#8491a8"
];

const $ = id => document.getElementById(id);

function loadTransactions() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(data)) return [];

    return data.filter(t =>
      t &&
      typeof t.id === "string" &&
      typeof t.description === "string" &&
      ["income", "expense"].includes(t.type) &&
      Number.isSafeInteger(t.amount) &&
      t.amount > 0 &&
      typeof t.category === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(t.date) &&
      !Number.isNaN(Date.parse(t.date))
    );
  } catch {
    return [];
  }
}

function loadBudget() {
  try {
    const value = Number(localStorage.getItem(BUDGET_KEY));
    return Number.isSafeInteger(value) && value > 0 ? value : 2000000;
  } catch {
    return 2000000;
  }
}

let transactions = loadTransactions();
let budget = loadBudget();
let flowChart = null;
let categoryChart = null;
let toastTimer;

const rupiah = value => new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0
}).format(value);

function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthKey(date) {
  return date.slice(0, 7);
}

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric"
  });
}

function saveTransactions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    return true;
  } catch {
    showToast("Penyimpanan gagal. Periksa ruang browser.");
    return false;
  }
}

function saveBudget() {
  try {
    localStorage.setItem(BUDGET_KEY, String(budget));
    return true;
  } catch {
    showToast("Anggaran tidak bisa disimpan di browser.");
    return false;
  }
}

function showToast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    $("toast").classList.remove("show");
  }, 2600);
}

function totals(list) {
  let income = 0;
  let expense = 0;

  for (const t of list) {
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  }

  return { income, expense, balance: income - expense };
}

function currentMonthTransactions() {
  const key = monthKey(localDateString());
  return transactions.filter(t => monthKey(t.date) === key);
}

function setupCategories() {
  updateCategories();

  $("type").addEventListener("change", updateCategories);
}

function updateCategories() {
  const type = $("type").value;
  const select = $("category");
  select.replaceChildren();

  for (const name of categories[type]) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  }
}

function setupDateAndFilters() {
  $("date").value = localDateString();
  $("today").textContent = new Date().toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  const monthSelect = $("monthFilter");
  const months = [...new Set(transactions.map(t => monthKey(t.date)))].sort().reverse();

  for (const month of months) {
    const option = document.createElement("option");
    option.value = month;
    option.textContent = monthLabel(month);
    monthSelect.appendChild(option);
  }

  const current = monthKey(localDateString());
  if (months.includes(current)) monthSelect.value = current;

  const years = new Set([new Date().getFullYear()]);
  transactions.forEach(t => years.add(Number(t.date.slice(0, 4))));

  const yearSelect = $("chartYear");
  yearSelect.replaceChildren();

  [...years].sort((a, b) => b - a).forEach(year => {
    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = String(year);
    yearSelect.appendChild(option);
  });
}

function renderSummary() {
  const all = totals(transactions);
  const month = totals(currentMonthTransactions());
  const remaining = budget - month.expense;

  $("balance").textContent = rupiah(all.balance);
  $("income").textContent = rupiah(all.income);
  $("expense").textContent = rupiah(all.expense);
  $("remaining").textContent = rupiah(remaining);

  $("monthExpense").textContent = rupiah(month.expense);
  $("budgetLimit").textContent = rupiah(budget);

  const ratio = budget > 0 ? month.expense / budget * 100 : 0;
  $("budgetProgress").style.width = Math.min(ratio, 100) + "%";
  $("budgetProgress").classList.toggle("over", ratio > 100);

  $("budgetCaption").textContent = remaining < 0
    ? "Anggaran terlampaui"
    : "Sisa anggaran bulan ini";

  $("budgetNote").textContent = ratio > 100
    ? `Pengeluaran melampaui anggaran sebesar ${rupiah(month.expense - budget)}.`
    : `Terpakai ${ratio.toFixed(1)}% dari anggaran bulanan. Sisa ${rupiah(remaining)}.`;
}

function filteredTransactions() {
  const query = $("search").value.trim().toLocaleLowerCase("id-ID");
  const type = $("typeFilter").value;
  const month = $("monthFilter").value;

  return transactions
    .filter(t => {
      const matchesQuery =
        t.description.toLocaleLowerCase("id-ID").includes(query) ||
        t.category.toLocaleLowerCase("id-ID").includes(query);

      const matchesType = type === "all" || t.type === type;
      const matchesMonth = month === "all" || monthKey(t.date) === month;

      return matchesQuery && matchesType && matchesMonth;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

function renderTransactions() {
  const tbody = $("transactionList");
  tbody.replaceChildren();

  const list = filteredTransactions();

  for (const t of list) {
    const tr = document.createElement("tr");

    const description = document.createElement("td");
    description.textContent = t.description;

    const category = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "category-badge";
    badge.textContent = t.category;
    category.appendChild(badge);

    const date = document.createElement("td");
    date.textContent = new Date(t.date + "T12:00:00").toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });

    const amount = document.createElement("td");
    amount.className = t.type === "income" ? "amount-income" : "amount-expense";
    amount.textContent = (t.type === "income" ? "+ " : "− ") + rupiah(t.amount);

    const action = document.createElement("td");
    const del = document.createElement("button");
    del.className = "delete-button";
    del.textContent = "Hapus";
    del.setAttribute("aria-label", "Hapus " + t.description);
    del.addEventListener("click", () => deleteTransaction(t.id));
    action.appendChild(del);

    tr.append(description, category, date, amount, action);
    tbody.appendChild(tr);
  }

  $("emptyState").style.display = list.length ? "none" : "block";
  $("transactionList").parentElement.style.display = list.length ? "table" : "none";
}

function deleteTransaction(id) {
  const target = transactions.find(t => t.id === id);
  if (!target) return;

  if (!confirm(`Hapus transaksi "${target.description}"?`)) return;

  transactions = transactions.filter(t => t.id !== id);

  if (saveTransactions()) {
    refresh();
    showToast("Transaksi berhasil dihapus.");
  }
}

function renderFlowChart() {
  if (typeof Chart === "undefined") {
    showToast("Grafik memerlukan koneksi internet untuk memuat Chart.js.");
    return;
  }

  const year = Number($("chartYear").value) || new Date().getFullYear();
  const labels = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const income = Array(12).fill(0);
  const expense = Array(12).fill(0);

  for (const t of transactions) {
    if (Number(t.date.slice(0, 4)) !== year) continue;
    const month = Number(t.date.slice(5, 7)) - 1;

    if (t.type === "income") income[month] += t.amount;
    else expense[month] += t.amount;
  }

  if (flowChart) flowChart.destroy();

  flowChart = new Chart($("flowChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Pemasukan",
          data: income,
          backgroundColor: "#16a779",
          borderRadius: 4,
          maxBarThickness: 17
        },
        {
          label: "Pengeluaran",
          data: expense,
          backgroundColor: "#f2b4ba",
          borderRadius: 4,
          maxBarThickness: 17
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "bottom",
          labels: { usePointStyle: true, boxWidth: 7, padding: 18, font: { size: 10 } }
        },
        tooltip: {
          callbacks: {
            label: context => `${context.dataset.label}: ${rupiah(context.raw)}`
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: {
          beginAtZero: true,
          grid: { color: "#edf0f5" },
          ticks: {
            font: { size: 9 },
            callback: value => {
              if (value >= 1000000) return (value / 1000000) + " jt";
              if (value >= 1000) return (value / 1000) + " rb";
              return value;
            }
          }
        }
      }
    }
  });
}

function renderCategoryChart() {
  if (typeof Chart === "undefined") return;

  const expenses = currentMonthTransactions().filter(t => t.type === "expense");
  const grouped = {};

  expenses.forEach(t => {
    grouped[t.category] = (grouped[t.category] || 0) + t.amount;
  });

  const entries = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  const labels = entries.map(item => item[0]);
  const values = entries.map(item => item[1]);
  const palette = labels.map((_, i) => colors[i % colors.length]);

  if (categoryChart) categoryChart.destroy();

  categoryChart = new Chart($("categoryChart"), {
    type: "doughnut",
    data: {
      labels: labels.length ? labels : ["Belum ada data"],
      datasets: [{
        data: values.length ? values : [1],
        backgroundColor: values.length ? palette : ["#edf0f5"],
        borderWidth: 0,
        hoverOffset: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "72%",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: context => values.length
              ? `${context.label}: ${rupiah(context.raw)}`
              : "Belum ada pengeluaran"
          }
        }
      }
    }
  });

  const legend = $("categoryLegend");
  legend.replaceChildren();

  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Belum ada pengeluaran bulan ini.";
    legend.appendChild(empty);
    return;
  }

  entries.slice(0, 5).forEach(([name, amount], i) => {
    const row = document.createElement("div");
    row.className = "legend-item";

    const left = document.createElement("span");
    left.className = "legend-name";

    const dot = document.createElement("span");
    dot.className = "legend-dot";
    dot.style.background = palette[i];

    const text = document.createElement("span");
    text.textContent = name;

    left.append(dot, text);

    const right = document.createElement("strong");
    right.textContent = rupiah(amount);

    row.append(left, right);
    legend.appendChild(row);
  });
}

function refresh() {
  setupDateAndFilters();
  renderSummary();
  renderTransactions();
  renderFlowChart();
  renderCategoryChart();
}

function openModal() {
  $("transactionForm").reset();
  $("date").value = localDateString();
  updateCategories();
  $("transactionModal").classList.add("show");
  $("description").focus();
}

function closeModal() {
  $("transactionModal").classList.remove("show");
}

$("openModal").addEventListener("click", openModal);
$("closeModal").addEventListener("click", closeModal);

$("transactionModal").addEventListener("click", event => {
  if (event.target === $("transactionModal")) closeModal();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeModal();
});

$("transactionForm").addEventListener("submit", event => {
  event.preventDefault();

  const description = $("description").value.trim();
  const type = $("type").value;
  const amount = Number($("amount").value);
  const category = $("category").value;
  const date = $("date").value;

  if (!description || description.length > 80) {
    showToast("Masukkan nama transaksi yang valid.");
    return;
  }

  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1000000000000) {
    showToast("Jumlah harus berupa angka positif yang valid.");
    return;
  }

  if (!["income", "expense"].includes(type) ||
      !categories[type].includes(category) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(Date.parse(date)) ||
      date > "9999-12-31") {
    showToast("Periksa kembali data transaksi.");
    return;
  }

  const transaction = {
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    description,
    type,
    amount,
    category,
    date
  };

  transactions.push(transaction);

  if (!saveTransactions()) {
    transactions.pop();
    return;
  }

  closeModal();
  refresh();
  showToast("Transaksi berhasil disimpan!");
});

$("search").addEventListener("input", renderTransactions);
$("typeFilter").addEventListener("change", renderTransactions);
$("monthFilter").addEventListener("change", renderTransactions);
$("chartYear").addEventListener("change", renderFlowChart);

$("editBudget").addEventListener("click", () => {
  const answer = prompt("Masukkan anggaran pengeluaran bulanan (Rp):", String(budget));

  if (answer === null) return;

  const value = Number(answer.trim());

  if (!Number.isSafeInteger(value) || value <= 0 || value > 1000000000000) {
    showToast("Anggaran harus berupa angka positif yang valid.");
    return;
  }

  const oldBudget = budget;
  budget = value;

  if (!saveBudget()) {
    budget = oldBudget;
    return;
  }

  renderSummary();
  showToast("Anggaran berhasil diperbarui.");
});

$("exportCsv").addEventListener("click", () => {
  if (!transactions.length) {
    showToast("Belum ada transaksi untuk diekspor.");
    return;
  }

  const quote = value => `"${String(value).replace(/"/g, '""')}"`;
  const rows = [
    ["Nama transaksi", "Jenis", "Kategori", "Tanggal", "Jumlah (Rp)"],
    ...transactions
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(t => [
        t.description,
        t.type === "income" ? "Pemasukan" : "Pengeluaran",
        t.category,
        t.date,
        t.amount
      ])
  ];

  const csv = "\uFEFF" + rows.map(row => row.map(quote).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `finora-transaksi-${localDateString()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  showToast("File CSV berhasil dibuat.");
});

$("menuToggle").addEventListener("click", () => {
  $("sidebar").classList.toggle("open");
});

document.querySelectorAll(".nav-item").forEach(link => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
    link.classList.add("active");
    $("sidebar").classList.remove("open");
  });
});

setupCategories();
refresh();
