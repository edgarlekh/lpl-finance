const {
  useState,
  useEffect,
  useMemo,
  useCallback
} = React;

/* ============================================================
   LPL LOGISTICS — Касса / Разбивки / Дашборд / Справочник
   Design tokens:
   - bg-base   #14181C  (asphalt)
   - bg-surface #1B2025 (panel)
   - bg-raised #21272D  (card)
   - line     #2C333A
   - text-hi  #ECE9E2
   - text-lo  #8B939B
   - amber    #E8A33D   (signature accent — road marking)
   - green    #5FA976   (income)
   - rust     #C1553B   (expense)
   - steel    #5B7A93   (transfer / neutral)
   Type: display = "Space Grotesk", numbers = "JetBrains Mono", body = system-ui
   Signature: odometer-style tabular readouts for every amount
   ============================================================ */

const FONT_LINK_ID = "lpl-fonts";
function ensureFonts() {
  // Intentionally a no-op now: we use system fonts only, to avoid extra
  // network round-trips to fonts.googleapis.com on slow connections.
  // Kept as a function so call sites don't need to change.
}
const uid = () => Math.random().toString(36).slice(2, 10);
const todayISO = () => new Date().toISOString().slice(0, 10);
const monthKey = iso => iso.slice(0, 7);
function fmt(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("pl-PL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}
const DEFAULT_STATE = {
  version: 1,
  company: "LPL LOGISTICS",
  categories: {
    income: ["Доход", "Прочее"],
    expense: ["Зарплата", "Топливо", "Аренда/Лизинг", "Ремонт", "Налоги", "Комиссии", "Мойка/бытовое", "Долги", "Перевод между кассами", "Прочее"]
  },
  districts: [{
    id: uid(),
    name: "1240"
  }, {
    id: uid(),
    name: "5204"
  }, {
    id: uid(),
    name: "3310"
  }],
  vehicles: [{
    id: uid(),
    name: "Бус (аренда)",
    status: "аренда"
  }, {
    id: uid(),
    name: "Тойота",
    status: "своя"
  }],
  transactions: [],
  incomeSplits: [],
  fuelSplits: [],
  notes: []
};
const STORE_KEY = "lpl-store-v1";
function useStore() {
  const [state, setState] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let unsubscribe = null;
    if (window.storage.listen) {
      // Live mode: fires immediately with current data, then again on every
      // change made by this device OR any partner's device.
      unsubscribe = window.storage.listen(STORE_KEY, rawValue => {
        if (cancelled) return;
        try {
          const parsed = rawValue ? JSON.parse(rawValue) : {};
          setState({
            ...DEFAULT_STATE,
            ...parsed
          });
        } catch (e) {
          setState(prev => prev || DEFAULT_STATE);
        }
        setStatus("ready");
      });
    } else {
      // Fallback: one-time load (older bridge without live listening)
      (async () => {
        try {
          const res = await window.storage.get(STORE_KEY, true);
          if (cancelled) return;
          if (res && res.value) {
            const parsed = JSON.parse(res.value);
            setState({
              ...DEFAULT_STATE,
              ...parsed
            });
          } else {
            setState(DEFAULT_STATE);
          }
          setStatus("ready");
        } catch (e) {
          if (cancelled) return;
          setState(DEFAULT_STATE);
          setStatus("ready");
        }
      })();
    }
    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, []);
  const persist = useCallback(async next => {
    setSaving(true);
    try {
      await window.storage.set(STORE_KEY, JSON.stringify(next), true);
      setSaveError(false);
    } catch (e) {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }, []);
  const update = useCallback(updater => {
    setState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      persist(next);
      return next;
    });
  }, [persist]);
  return {
    state,
    update,
    status,
    saving,
    saveError
  };
}

/* ---------------- small UI atoms ---------------- */

function Odometer({
  value,
  size = "lg",
  tone = "hi",
  prefix = "",
  suffix = "\u00A0zł"
}) {
  const sizes = {
    sm: "16px",
    sm2: "18px",
    md: "20px",
    lg: "30px",
    xl: "40px"
  };
  const tones = {
    hi: "#ECE9E2",
    green: "#5FA976",
    rust: "#C1553B",
    amber: "#E8A33D",
    steel: "#5B7A93",
    lo: "#8B939B"
  };
  const formatted = fmt(value).replace(/\s/g, "\u00A0");
  return /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      fontVariantNumeric: "tabular-nums",
      fontSize: sizes[size],
      color: tones[tone],
      fontWeight: 600,
      letterSpacing: "0.02em",
      whiteSpace: "nowrap"
    }
  }, prefix, formatted, /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: 0.55,
      fontWeight: 500
    }
  }, suffix));
}
function Pill({
  active,
  onClick,
  children,
  tone = "amber"
}) {
  const tones = {
    amber: "#E8A33D",
    green: "#5FA976",
    rust: "#C1553B",
    steel: "#5B7A93"
  };
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      padding: "7px 13px",
      borderRadius: 999,
      border: `1px solid ${active ? tones[tone] : "#2C333A"}`,
      background: active ? `${tones[tone]}1A` : "transparent",
      color: active ? tones[tone] : "#8B939B",
      fontSize: 13,
      fontWeight: 600,
      whiteSpace: "nowrap",
      cursor: "pointer",
      transition: "all .15s ease"
    }
  }, children);
}
function Card({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#1B2025",
      border: "1px solid #262D33",
      borderRadius: 16,
      padding: 16,
      ...style
    }
  }, children);
}
function Field({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "block",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#8B939B",
      marginBottom: 6,
      fontWeight: 600
    }
  }, label), children);
}
const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  background: "#14181C",
  border: "1px solid #2C333A",
  borderRadius: 10,
  padding: "11px 12px",
  color: "#ECE9E2",
  fontSize: 15,
  fontFamily: "inherit",
  outline: "none"
};
function Select({
  value,
  onChange,
  options,
  placeholder
}) {
  return /*#__PURE__*/React.createElement("select", {
    value: value,
    onChange: e => onChange(e.target.value),
    style: {
      ...inputStyle,
      appearance: "auto"
    }
  }, placeholder && /*#__PURE__*/React.createElement("option", {
    value: ""
  }, placeholder), options.map(o => /*#__PURE__*/React.createElement("option", {
    key: o,
    value: o
  }, o)));
}
function Empty({
  title,
  hint
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "36px 16px",
      color: "#8B939B",
      border: "1px dashed #2C333A",
      borderRadius: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: "#ECE9E2",
      fontWeight: 600,
      marginBottom: 4
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13
    }
  }, hint));
}

/* ---------------- period helper ---------------- */

function usePeriod() {
  const [mode, setMode] = useState("month"); // month | all | custom
  const [month, setMonth] = useState(monthKey(todayISO()));
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const inRange = useCallback(iso => {
    if (mode === "all") return true;
    if (mode === "month") return monthKey(iso) === month;
    return iso >= from && iso <= to;
  }, [mode, month, from, to]);
  return {
    mode,
    setMode,
    month,
    setMonth,
    from,
    setFrom,
    to,
    setTo,
    inRange
  };
}

/* ================= MAIN APP ================= */

const LOGIN = "lpl.logistics1@gmail.com";
const PASSWORD = "15072026";
function LoginScreen({
  onSuccess
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  function submit() {
    if (password === PASSWORD) {
      onSuccess();
    } else {
      setError("Неверный пароль");
    }
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...shellStyle,
      alignItems: "center",
      justifyContent: "center",
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      maxWidth: 340
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      justifyContent: "center",
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 2,
      background: "#E8A33D",
      transform: "rotate(45deg)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontWeight: 700,
      fontSize: 20,
      letterSpacing: "0.04em"
    }
  }, "LPL LOGISTICS")), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(Field, {
    label: "Логин"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...inputStyle,
      color: "#8B939B",
      background: "#181D22",
      userSelect: "none"
    }
  }, LOGIN)), /*#__PURE__*/React.createElement(Field, {
    label: "Пароль"
  }, /*#__PURE__*/React.createElement("input", {
    type: "password",
    value: password,
    onChange: e => setPassword(e.target.value),
    onKeyDown: e => e.key === "Enter" && submit(),
    placeholder: "••••••••",
    style: inputStyle,
    autoFocus: true
  })), error && /*#__PURE__*/React.createElement("div", {
    style: {
      color: "#C1553B",
      fontSize: 12.5,
      marginBottom: 10
    }
  }, error), /*#__PURE__*/React.createElement("button", {
    onClick: submit,
    style: primaryBtnStyle
  }, "Войти"))));
}
function App() {
  useEffect(() => {
    ensureFonts();
  }, []);
  const {
    state,
    update,
    status,
    saving,
    saveError
  } = useStore();
  const [tab, setTab] = useState("dash");
  const [authed, setAuthed] = useState(false);
  if (!authed) {
    return /*#__PURE__*/React.createElement(LoginScreen, {
      onSuccess: () => setAuthed(true)
    });
  }
  if (status === "loading" || !state) {
    return /*#__PURE__*/React.createElement("div", {
      style: shellStyle
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        color: "#8B939B",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
      }
    }, "загрузка…"));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: shellStyle
  }, /*#__PURE__*/React.createElement("style", null, `
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 0; height: 0; }
        button { font-family: inherit; }
        input::placeholder { color: #5A6169; }
      `), /*#__PURE__*/React.createElement(Header, {
    company: state.company,
    saving: saving,
    saveError: saveError
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: "auto",
      padding: "0 14px 90px"
    }
  }, tab === "dash" && /*#__PURE__*/React.createElement(Dashboard, {
    state: state
  }), tab === "ledger" && /*#__PURE__*/React.createElement(Ledger, {
    state: state,
    update: update
  }), tab === "splits" && /*#__PURE__*/React.createElement(Splits, {
    state: state,
    update: update
  }), tab === "notes" && /*#__PURE__*/React.createElement(Notes, {
    state: state,
    update: update
  }), tab === "settings" && /*#__PURE__*/React.createElement(Settings, {
    state: state,
    update: update
  })), /*#__PURE__*/React.createElement(BottomNav, {
    tab: tab,
    setTab: setTab
  }));
}
const shellStyle = {
  minHeight: "100vh",
  background: "radial-gradient(1200px 600px at 50% -10%, #1B2126 0%, #14181C 55%, #101316 100%)",
  color: "#ECE9E2",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  display: "flex",
  flexDirection: "column",
  maxWidth: 480,
  margin: "0 auto",
  position: "relative",
  paddingTop: "env(safe-area-inset-top)",
  paddingBottom: "env(safe-area-inset-bottom)"
};
function Header({
  company,
  saving,
  saveError
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "12px 16px 10px",
      borderBottom: "1px solid #21272D",
      position: "sticky",
      top: 0,
      background: "#14181Cee",
      backdropFilter: "blur(6px)",
      zIndex: 5
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 2,
      background: "#E8A33D",
      transform: "rotate(45deg)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontWeight: 700,
      fontSize: 17,
      letterSpacing: "0.04em"
    }
  }, company)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      fontWeight: 600,
      color: saveError ? "#C1553B" : saving ? "#E8A33D" : "#5FA976"
    }
  }, saveError ? "⚠ не сохранено" : saving ? "сохранение…" : "✓ сохранено")));
}
function BottomNav({
  tab,
  setTab
}) {
  const items = [{
    id: "dash",
    label: "Дашборд",
    glyph: "▤"
  }, {
    id: "ledger",
    label: "Касса",
    glyph: "≡"
  }, {
    id: "splits",
    label: "Разбивки",
    glyph: "⑃"
  }, {
    id: "notes",
    label: "Заметки",
    glyph: "✎"
  }, {
    id: "settings",
    label: "Справочник",
    glyph: "⚙"
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "sticky",
      bottom: 0,
      display: "flex",
      borderTop: "1px solid #21272D",
      background: "#14181Cf5",
      backdropFilter: "blur(6px)",
      maxWidth: 480,
      width: "100%",
      paddingBottom: "env(safe-area-inset-bottom)"
    }
  }, items.map(it => {
    const active = tab === it.id;
    return /*#__PURE__*/React.createElement("button", {
      key: it.id,
      onClick: () => setTab(it.id),
      style: {
        flex: 1,
        background: "none",
        border: "none",
        padding: "7px 0 8px",
        color: active ? "#E8A33D" : "#5A6169",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 16,
        lineHeight: 1
      }
    }, it.glyph), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 600
      }
    }, it.label));
  }));
}

/* ================= LEDGER (Касса) ================= */

const RECEIPT_PROXY_URL = "https://lpl-receipt-proxy.edgar-lekh99.workers.dev";
function Ledger({
  state,
  update
}) {
  const [showForm, setShowForm] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [filterMethod, setFilterMethod] = useState("all");
  const [search, setSearch] = useState("");
  const period = usePeriod();
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.transactions.filter(t => period.inRange(t.date)).filter(t => filterMethod === "all" || t.method === filterMethod).filter(t => {
      if (!q) return true;
      const haystack = `${t.category || ""} ${t.comment || ""}`.toLowerCase();
      return haystack.includes(q);
    }).sort((a, b) => a.date < b.date ? 1 : -1);
  }, [state.transactions, period, filterMethod, search]);
  function addTx(tx) {
    update(prev => ({
      ...prev,
      transactions: [...prev.transactions, {
        id: uid(),
        ...tx
      }]
    }));
    setShowForm(false);
  }
  function addManyTx(txs) {
    update(prev => ({
      ...prev,
      transactions: [...prev.transactions, ...txs.map(tx => ({
        id: uid(),
        ...tx
      }))]
    }));
    setShowScan(false);
  }
  function removeTx(id) {
    update(prev => ({
      ...prev,
      transactions: prev.transactions.filter(t => t.id !== id)
    }));
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PeriodBar, {
    period: period
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      margin: "12px 0"
    }
  }, ["all", "cash", "card"].map(m => /*#__PURE__*/React.createElement(Pill, {
    key: m,
    active: filterMethod === m,
    onClick: () => setFilterMethod(m)
  }, m === "all" ? "Всё" : m === "cash" ? "Наличка" : "Карта"))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: search,
    onChange: e => setSearch(e.target.value),
    placeholder: "Поиск по категории или комментарию…",
    style: {
      ...inputStyle,
      paddingRight: search ? 34 : 12
    }
  }), search && /*#__PURE__*/React.createElement("button", {
    onClick: () => setSearch(""),
    style: {
      position: "absolute",
      right: 8,
      top: "50%",
      transform: "translateY(-50%)",
      background: "none",
      border: "none",
      color: "#5A6169",
      fontSize: 15,
      cursor: "pointer"
    }
  }, "✕")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowScan(true),
    style: scanButtonStyle
  }, "📷 Загрузить скриншот банка"), list.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    title: search ? "Ничего не найдено" : "Пока нет операций",
    hint: search ? "Попробуйте другой запрос" : "Добавьте первую запись кнопкой ниже"
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, list.map(t => /*#__PURE__*/React.createElement(TxRow, {
    key: t.id,
    tx: t,
    onDelete: () => removeTx(t.id)
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowForm(true),
    style: fabStyle
  }, "+"), showForm && /*#__PURE__*/React.createElement(TxForm, {
    categories: state.categories,
    onCancel: () => setShowForm(false),
    onSave: addTx
  }), showScan && /*#__PURE__*/React.createElement(ReceiptScanForm, {
    onCancel: () => setShowScan(false),
    onSave: addManyTx
  }));
}
const scanButtonStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: 12,
  border: "1px dashed #5B7A93",
  background: "#5B7A9314",
  color: "#8FB0C4",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  marginBottom: 12
};
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function ReceiptScanForm({
  onCancel,
  onSave
}) {
  const [stage, setStage] = useState("pick"); // pick | loading | review | error
  const [rows, setRows] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  async function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setStage("loading");
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch(RECEIPT_PROXY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          image: base64,
          mediaType: file.type || "image/png"
        })
      });
      if (!res.ok) throw new Error("Сервис распознавания недоступен");
      const data = await res.json();
      if (!data.transactions || data.transactions.length === 0) {
        setErrorMsg("Не удалось найти операции на скриншоте. Попробуйте другой скриншот или добавьте вручную.");
        setStage("error");
        return;
      }
      setRows(data.transactions.map(t => ({
        date: t.date || todayISO(),
        amount: t.amount != null ? String(t.amount) : "",
        type: t.type === "income" ? "income" : "expense",
        method: t.method === "cash" ? "cash" : "card",
        category: t.suggestedCategory || "",
        comment: t.comment || "",
        include: true
      })));
      setStage("review");
    } catch (err) {
      setErrorMsg("Ошибка распознавания. Проверьте интернет-соединение и попробуйте снова.");
      setStage("error");
    }
  }
  function updateRow(i, patch) {
    setRows(prev => prev.map((r, idx) => idx === i ? {
      ...r,
      ...patch
    } : r));
  }
  function submit() {
    const toSave = rows.filter(r => r.include && r.amount).map(r => ({
      date: r.date,
      amount: Number(r.amount),
      type: r.type,
      method: r.method,
      category: r.category || (r.type === "income" ? "Доход" : "Прочее"),
      comment: r.comment
    }));
    if (toSave.length === 0) return;
    onSave(toSave);
  }
  return /*#__PURE__*/React.createElement(Sheet, {
    title: "Скриншот банка",
    onClose: onCancel
  }, stage === "pick" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "#8B939B",
      marginBottom: 14
    }
  }, "Загрузите скриншот банковской выписки — операции распознаются автоматически, вы сможете проверить и поправить их перед сохранением."), /*#__PURE__*/React.createElement("label", {
    style: pickFileLabelStyle
  }, "Выбрать скриншот", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/*",
    onChange: handleFile,
    style: {
      display: "none"
    }
  }))), stage === "loading" && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "30px 0",
      color: "#8B939B"
    }
  }, "Распознаём скриншот…"), stage === "error" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: "#C1553B",
      fontSize: 13.5,
      marginBottom: 14
    }
  }, errorMsg), /*#__PURE__*/React.createElement("label", {
    style: pickFileLabelStyle
  }, "Попробовать снова", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/*",
    onChange: handleFile,
    style: {
      display: "none"
    }
  }))), stage === "review" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "#8B939B",
      marginBottom: 12
    }
  }, "Найдено операций: ", rows.length, ". Проверьте и поправьте перед сохранением."), rows.map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      border: "1px solid #262D33",
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
      opacity: r.include ? 1 : 0.4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontSize: 12.5
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: r.include,
    onChange: e => updateRow(i, {
      include: e.target.checked
    })
  }), "включить"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    active: r.type === "income",
    tone: "green",
    onClick: () => updateRow(i, {
      type: "income"
    })
  }, "Доход"), /*#__PURE__*/React.createElement(Pill, {
    active: r.type === "expense",
    tone: "rust",
    onClick: () => updateRow(i, {
      type: "expense"
    })
  }, "Расход"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: r.amount,
    onChange: e => updateRow(i, {
      amount: e.target.value
    }),
    placeholder: "Сумма",
    style: {
      ...inputStyle,
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: r.date,
    onChange: e => updateRow(i, {
      date: e.target.value
    }),
    style: {
      ...inputStyle,
      width: 130
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    active: r.method === "cash",
    onClick: () => updateRow(i, {
      method: "cash"
    })
  }, "Наличка"), /*#__PURE__*/React.createElement(Pill, {
    active: r.method === "card",
    onClick: () => updateRow(i, {
      method: "card"
    })
  }, "Карта")), /*#__PURE__*/React.createElement("input", {
    value: r.category,
    onChange: e => updateRow(i, {
      category: e.target.value
    }),
    placeholder: "Категория",
    style: {
      ...inputStyle,
      marginBottom: 8
    }
  }), /*#__PURE__*/React.createElement("input", {
    value: r.comment,
    onChange: e => updateRow(i, {
      comment: e.target.value
    }),
    placeholder: "Комментарий",
    style: inputStyle
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: submit,
    style: primaryBtnStyle
  }, "Сохранить выбранные операции")));
}
const pickFileLabelStyle = {
  display: "block",
  textAlign: "center",
  padding: "14px",
  borderRadius: 12,
  border: "1px solid #E8A33D",
  color: "#E8A33D",
  fontWeight: 700,
  cursor: "pointer"
};
function PeriodBar({
  period
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 14,
      display: "flex",
      gap: 8,
      alignItems: "center"
    }
  }, ["month", "all", "custom"].map(m => /*#__PURE__*/React.createElement(Pill, {
    key: m,
    active: period.mode === m,
    onClick: () => period.setMode(m),
    tone: "steel"
  }, m === "month" ? "Месяц" : m === "all" ? "Всё время" : "Период")), period.mode === "month" && /*#__PURE__*/React.createElement("input", {
    type: "month",
    value: period.month,
    onChange: e => period.setMonth(e.target.value),
    style: {
      ...inputStyle,
      width: 140,
      padding: "6px 8px",
      fontSize: 13
    }
  }), period.mode === "custom" && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: period.from,
    onChange: e => period.setFrom(e.target.value),
    style: {
      ...inputStyle,
      width: 120,
      padding: "6px 8px",
      fontSize: 12
    }
  }), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: period.to,
    onChange: e => period.setTo(e.target.value),
    style: {
      ...inputStyle,
      width: 120,
      padding: "6px 8px",
      fontSize: 12
    }
  })));
}
const toneForType = {
  income: "green",
  expense: "rust",
  transfer: "steel"
};
const signForType = {
  income: "+",
  expense: "−",
  transfer: "⇄"
};
function TxRow({
  tx,
  onDelete
}) {
  const [open, setOpen] = useState(false);
  return /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      cursor: "pointer"
    },
    onClick: () => setOpen(o => !o)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: "#ECE9E2"
    }
  }, tx.category), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#8B939B",
      marginTop: 2
    }
  }, tx.date, " ·", " ", tx.type === "transfer" ? tx.direction === "cash_to_card" ? "нал → карта" : "карта → нал" : tx.method === "cash" ? "нал" : "карта", tx.comment ? ` · ${tx.comment}` : "")), /*#__PURE__*/React.createElement(Odometer, {
    value: tx.amount,
    size: "md",
    tone: toneForType[tx.type],
    prefix: signForType[tx.type] + " "
  })), open && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onDelete,
    style: deleteBtnStyle
  }, "Удалить запись")));
}
function DirectionOption({
  active,
  onClick,
  fromLabel,
  toLabel,
  hint
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      textAlign: "left",
      padding: "12px 14px",
      borderRadius: 12,
      border: `1px solid ${active ? "#5B7A93" : "#2C333A"}`,
      background: active ? "#5B7A931A" : "#14181C",
      cursor: "pointer",
      color: "#ECE9E2"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", null, fromLabel), /*#__PURE__*/React.createElement("span", {
    style: {
      color: active ? "#5B7A93" : "#5A6169"
    }
  }, "→"), /*#__PURE__*/React.createElement("span", null, toLabel)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "#8B939B",
      marginTop: 3
    }
  }, hint)), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 18,
      height: 18,
      borderRadius: "50%",
      border: `2px solid ${active ? "#5B7A93" : "#3A4249"}`,
      background: active ? "#5B7A93" : "transparent",
      flexShrink: 0
    }
  }));
}
function TxForm({
  categories,
  onCancel,
  onSave
}) {
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [direction, setDirection] = useState("card_to_cash"); // for transfer
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(todayISO());
  const [comment, setComment] = useState("");
  const catList = type === "income" ? categories.income : type === "expense" ? categories.expense : ["Перевод между кассами"];
  function submit() {
    if (!amount) return;
    if (type === "transfer") {
      onSave({
        type,
        amount: Number(amount),
        direction,
        method: direction === "cash_to_card" ? "cash" : "card",
        // source, for display in ledger row
        category: "Перевод между кассами",
        date,
        comment
      });
      return;
    }
    if (!category) return;
    onSave({
      type,
      amount: Number(amount),
      method,
      category,
      date,
      comment
    });
  }
  return /*#__PURE__*/React.createElement(Sheet, {
    title: "Новая операция",
    onClose: onCancel
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 14
    }
  }, [{
    id: "income",
    label: "Доход",
    tone: "green"
  }, {
    id: "expense",
    label: "Расход",
    tone: "rust"
  }, {
    id: "transfer",
    label: "Перевод",
    tone: "steel"
  }].map(o => /*#__PURE__*/React.createElement(Pill, {
    key: o.id,
    active: type === o.id,
    tone: o.tone,
    onClick: () => {
      setType(o.id);
      setCategory("");
    }
  }, o.label))), /*#__PURE__*/React.createElement(Field, {
    label: "Сумма"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    inputMode: "decimal",
    value: amount,
    onChange: e => setAmount(e.target.value),
    placeholder: "0",
    style: inputStyle
  })), type === "transfer" ? /*#__PURE__*/React.createElement(Field, {
    label: "Направление перевода"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(DirectionOption, {
    active: direction === "card_to_cash",
    onClick: () => setDirection("card_to_cash"),
    fromLabel: "Карта",
    toLabel: "Наличка",
    hint: "Например: сняли деньги в банкомате"
  }), /*#__PURE__*/React.createElement(DirectionOption, {
    active: direction === "cash_to_card",
    onClick: () => setDirection("cash_to_card"),
    fromLabel: "Наличка",
    toLabel: "Карта",
    hint: "Например: внесли наличные на карту/счёт"
  }))) : /*#__PURE__*/React.createElement(Field, {
    label: "Способ оплаты"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    active: method === "cash",
    onClick: () => setMethod("cash")
  }, "Наличка"), /*#__PURE__*/React.createElement(Pill, {
    active: method === "card",
    onClick: () => setMethod("card")
  }, "Карта"))), type !== "transfer" && /*#__PURE__*/React.createElement(Field, {
    label: "Категория"
  }, /*#__PURE__*/React.createElement(Select, {
    value: category,
    onChange: setCategory,
    options: catList,
    placeholder: "Выбрать категорию"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Дата"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: date,
    onChange: e => setDate(e.target.value),
    style: inputStyle
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Комментарий (необязательно)"
  }, /*#__PURE__*/React.createElement("input", {
    value: comment,
    onChange: e => setComment(e.target.value),
    placeholder: "Например: DPD за март",
    style: inputStyle
  })), /*#__PURE__*/React.createElement("button", {
    onClick: submit,
    style: primaryBtnStyle
  }, "Сохранить"));
}

/* ================= SPLITS (Разбивки) ================= */

function Splits({
  state,
  update
}) {
  const [mode, setMode] = useState("income"); // income | fuel
  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    active: mode === "income",
    tone: "green",
    onClick: () => setMode("income")
  }, "По районам"), /*#__PURE__*/React.createElement(Pill, {
    active: mode === "fuel",
    tone: "rust",
    onClick: () => setMode("fuel")
  }, "По машинам")), mode === "income" ? /*#__PURE__*/React.createElement(SplitBlock, {
    state: state,
    update: update,
    storeKey: "incomeSplits",
    targets: state.districts,
    targetLabel: "Район",
    tone: "green",
    invoiceHint: "Например: DPD март 2026"
  }) : /*#__PURE__*/React.createElement(SplitBlock, {
    state: state,
    update: update,
    storeKey: "fuelSplits",
    targets: state.vehicles,
    targetLabel: "Машина",
    tone: "rust",
    invoiceHint: "Например: DKV топливо март"
  }));
}
function SplitBlock({
  state,
  update,
  storeKey,
  targets,
  targetLabel,
  tone,
  invoiceHint
}) {
  const [showForm, setShowForm] = useState(false);
  const splits = state[storeKey];
  function addSplit(split) {
    update(prev => ({
      ...prev,
      [storeKey]: [...prev[storeKey], {
        id: uid(),
        ...split
      }]
    }));
    setShowForm(false);
  }
  function removeSplit(id) {
    update(prev => ({
      ...prev,
      [storeKey]: prev[storeKey].filter(s => s.id !== id)
    }));
  }
  if (targets.length === 0) {
    return /*#__PURE__*/React.createElement(Empty, {
      title: `Нет списка «${targetLabel}»`,
      hint: "Добавьте хотя бы один вариант в Справочнике, прежде чем делать разбивку"
    });
  }
  return /*#__PURE__*/React.createElement("div", null, splits.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    title: "Разбивок ещё нет",
    hint: "Распределите фактуру по позициям ниже"
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, splits.slice().sort((a, b) => a.date < b.date ? 1 : -1).map(s => /*#__PURE__*/React.createElement(SplitCard, {
    key: s.id,
    split: s,
    targets: targets,
    tone: tone,
    onDelete: () => removeSplit(s.id)
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowForm(true),
    style: fabStyle
  }, "+"), showForm && /*#__PURE__*/React.createElement(SplitForm, {
    targets: targets,
    targetLabel: targetLabel,
    invoiceHint: invoiceHint,
    onCancel: () => setShowForm(false),
    onSave: addSplit
  }));
}
function SplitCard({
  split,
  targets,
  tone,
  onDelete
}) {
  const [open, setOpen] = useState(false);
  const allocSum = split.allocations.reduce((a, x) => a + Number(x.amount || 0), 0);
  const diff = Number(split.total) - allocSum;
  const nameOf = id => targets.find(t => t.id === id)?.name || "—";
  return /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      cursor: "pointer"
    },
    onClick: () => setOpen(o => !o)
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 14
    }
  }, split.label || "Фактура"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#8B939B",
      marginTop: 2
    }
  }, split.date)), /*#__PURE__*/React.createElement(Odometer, {
    value: split.total,
    size: "md",
    tone: tone,
    prefix: ""
  })), open && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      borderTop: "1px solid #262D33",
      paddingTop: 10
    }
  }, split.allocations.map((a, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      justifyContent: "space-between",
      fontSize: 13,
      padding: "5px 0",
      color: "#ECE9E2"
    }
  }, /*#__PURE__*/React.createElement("span", null, nameOf(a.targetId)), /*#__PURE__*/React.createElement(Odometer, {
    value: a.amount,
    size: "sm",
    tone: "hi"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginTop: 6,
      paddingTop: 6,
      borderTop: "1px dashed #2C333A",
      fontSize: 12,
      color: diff === 0 ? "#5FA976" : "#C1553B",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    }
  }, /*#__PURE__*/React.createElement("span", null, diff === 0 ? "✓ сходится с фактурой" : "⚠ расхождение"), /*#__PURE__*/React.createElement("span", null, diff !== 0 ? `${diff > 0 ? "+" : ""}${fmt(diff)}` : "")), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right",
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onDelete,
    style: deleteBtnStyle
  }, "Удалить разбивку"))));
}
function SplitForm({
  targets,
  targetLabel,
  invoiceHint,
  onCancel,
  onSave
}) {
  const [label, setLabel] = useState("");
  const [total, setTotal] = useState("");
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState(targets.map(t => ({
    targetId: t.id,
    amount: ""
  })));
  const allocSum = rows.reduce((a, r) => a + Number(r.amount || 0), 0);
  const diff = Number(total || 0) - allocSum;
  function setRowAmount(idx, val) {
    setRows(prev => prev.map((r, i) => i === idx ? {
      ...r,
      amount: val
    } : r));
  }
  function submit() {
    if (!total) return;
    const allocations = rows.filter(r => Number(r.amount) > 0).map(r => ({
      targetId: r.targetId,
      amount: Number(r.amount)
    }));
    if (allocations.length === 0) return;
    onSave({
      label,
      total: Number(total),
      date,
      allocations
    });
  }
  return /*#__PURE__*/React.createElement(Sheet, {
    title: `Разбивка · ${targetLabel}`,
    onClose: onCancel
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Название фактуры"
  }, /*#__PURE__*/React.createElement("input", {
    value: label,
    onChange: e => setLabel(e.target.value),
    placeholder: invoiceHint,
    style: inputStyle
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Сумма фактуры"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    inputMode: "decimal",
    value: total,
    onChange: e => setTotal(e.target.value),
    placeholder: "0",
    style: inputStyle
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Дата"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: date,
    onChange: e => setDate(e.target.value),
    style: inputStyle
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#8B939B",
      fontWeight: 600,
      marginBottom: 8
    }
  }, "Распределить по: ", targetLabel.toLowerCase(), "у"), targets.map((t, i) => /*#__PURE__*/React.createElement("div", {
    key: t.id,
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontSize: 14
    }
  }, t.name), /*#__PURE__*/React.createElement("input", {
    type: "number",
    inputMode: "decimal",
    value: rows[i]?.amount ?? "",
    onChange: e => setRowAmount(i, e.target.value),
    placeholder: "0",
    style: {
      ...inputStyle,
      width: 110
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      fontSize: 13,
      margin: "10px 0 16px",
      color: diff === 0 ? "#5FA976" : "#C1553B",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    }
  }, /*#__PURE__*/React.createElement("span", null, "Остаток к распределению"), /*#__PURE__*/React.createElement("span", null, fmt(diff), " zł")), /*#__PURE__*/React.createElement("button", {
    onClick: submit,
    style: primaryBtnStyle
  }, "Сохранить разбивку"));
}

/* ================= DASHBOARD ================= */

function prevPeriodRange(period) {
  // Returns an inRange-style predicate for the period immediately preceding
  // the current one, of the same length — used for "vs previous period".
  if (period.mode === "month") {
    const [y, m] = period.month.split("-").map(Number);
    const prevDate = new Date(y, m - 2, 1); // JS months are 0-indexed
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
    return iso => monthKey(iso) === prevKey;
  }
  if (period.mode === "custom") {
    const from = new Date(period.from);
    const to = new Date(period.to);
    const lengthMs = to - from;
    const prevTo = new Date(from.getTime() - 24 * 60 * 60 * 1000);
    const prevFrom = new Date(prevTo.getTime() - lengthMs);
    const prevFromIso = prevFrom.toISOString().slice(0, 10);
    const prevToIso = prevTo.toISOString().slice(0, 10);
    return iso => iso >= prevFromIso && iso <= prevToIso;
  }
  return null; // "all" mode has no meaningful previous period
}
function Dashboard({
  state
}) {
  const period = usePeriod();
  const txInRange = useMemo(() => state.transactions.filter(t => period.inRange(t.date)), [state.transactions, period]);
  const allTx = state.transactions;
  const balance = useMemo(() => {
    let cash = 0,
      card = 0;
    for (const t of allTx) {
      if (t.type === "income") {
        if (t.method === "cash") cash += t.amount;else card += t.amount;
      } else if (t.type === "expense") {
        if (t.method === "cash") cash -= t.amount;else card -= t.amount;
      } else if (t.type === "transfer") {
        // direction: 'cash_to_card' moves money OUT of cash INTO card, and vice versa
        if (t.direction === "cash_to_card") {
          cash -= t.amount;
          card += t.amount;
        } else {
          card -= t.amount;
          cash += t.amount;
        }
      }
    }
    return {
      cash,
      card
    };
  }, [allTx]);
  const {
    income,
    expense,
    byCategory
  } = useMemo(() => {
    let income = 0,
      expense = 0;
    const cat = {};
    for (const t of txInRange) {
      if (t.type === "income") income += t.amount;
      if (t.type === "expense") {
        expense += t.amount;
        cat[t.category] = (cat[t.category] || 0) + t.amount;
      }
    }
    const rows = Object.entries(cat).sort((a, b) => b[1] - a[1]);
    return {
      income,
      expense,
      byCategory: rows
    };
  }, [txInRange]);
  const comparison = useMemo(() => {
    const prevInRange = prevPeriodRange(period);
    if (!prevInRange) return null;
    let prevIncome = 0,
      prevExpense = 0;
    for (const t of state.transactions) {
      if (!prevInRange(t.date)) continue;
      if (t.type === "income") prevIncome += t.amount;
      if (t.type === "expense") prevExpense += t.amount;
    }
    const pctChange = (curr, prev) => {
      if (prev === 0) return curr === 0 ? 0 : null; // no baseline to compare against
      return (curr - prev) / Math.abs(prev) * 100;
    };
    return {
      prevIncome,
      prevExpense,
      prevNet: prevIncome - prevExpense,
      incomeChange: pctChange(income, prevIncome),
      expenseChange: pctChange(expense, prevExpense)
    };
  }, [period, state.transactions, income, expense]);
  const districtRanking = useMemo(() => {
    const sums = {};
    for (const s of state.incomeSplits) {
      if (!period.inRange(s.date)) continue;
      for (const a of s.allocations) sums[a.targetId] = (sums[a.targetId] || 0) + Number(a.amount);
    }
    return state.districts.map(d => ({
      id: d.id,
      name: d.name,
      total: sums[d.id] || 0
    })).sort((a, b) => b.total - a.total);
  }, [state.incomeSplits, state.districts, period]);
  const vehicleRanking = useMemo(() => {
    const sums = {};
    for (const s of state.fuelSplits) {
      if (!period.inRange(s.date)) continue;
      for (const a of s.allocations) sums[a.targetId] = (sums[a.targetId] || 0) + Number(a.amount);
    }
    return state.vehicles.map(v => ({
      name: v.name,
      total: sums[v.id] || 0
    })).sort((a, b) => b.total - a.total);
  }, [state.fuelSplits, state.vehicles, period]);
  const vehicleProfitability = useMemo(() => {
    const fuelByVehicle = {};
    for (const s of state.fuelSplits) {
      if (!period.inRange(s.date)) continue;
      for (const a of s.allocations) fuelByVehicle[a.targetId] = (fuelByVehicle[a.targetId] || 0) + Number(a.amount);
    }
    const incomeByDistrict = {};
    for (const s of state.incomeSplits) {
      if (!period.inRange(s.date)) continue;
      for (const a of s.allocations) incomeByDistrict[a.targetId] = (incomeByDistrict[a.targetId] || 0) + Number(a.amount);
    }
    return (state.vehicles || []).filter(v => v.districtId).map(v => {
      const revenue = incomeByDistrict[v.districtId] || 0;
      const cost = fuelByVehicle[v.id] || 0;
      const district = (state.districts || []).find(d => d.id === v.districtId);
      return {
        name: v.name,
        districtName: district ? district.name : "—",
        revenue,
        cost,
        profit: revenue - cost
      };
    }).sort((a, b) => b.profit - a.profit);
  }, [state.vehicles, state.districts, state.fuelSplits, state.incomeSplits, period]);
  const net = income - expense;
  const maxCat = byCategory[0]?.[1] || 1;
  const maxDist = districtRanking[0]?.total || 1;
  const maxVeh = vehicleRanking[0]?.total || 1;
  const maxProfit = Math.max(1, ...vehicleProfitability.map(v => Math.abs(v.profit)));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 14,
      paddingBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: smallLabel
  }, "НАЛИЧКА"), /*#__PURE__*/React.createElement(Odometer, {
    value: balance.cash,
    size: "lg",
    tone: balance.cash < 0 ? "rust" : "hi"
  })), /*#__PURE__*/React.createElement(Card, {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: smallLabel
  }, "КАРТА"), /*#__PURE__*/React.createElement(Odometer, {
    value: balance.card,
    size: "lg",
    tone: balance.card < 0 ? "rust" : "hi"
  }))), /*#__PURE__*/React.createElement(PeriodBar, {
    period: period
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      margin: "14px 0"
    }
  }, /*#__PURE__*/React.createElement(Card, {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: smallLabel
  }, "ДОХОД"), /*#__PURE__*/React.createElement(Odometer, {
    value: income,
    size: "sm2",
    tone: "green",
    prefix: "+ "
  }), comparison && /*#__PURE__*/React.createElement(ChangeBadge, {
    pct: comparison.incomeChange,
    goodDirection: "up"
  })), /*#__PURE__*/React.createElement(Card, {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: smallLabel
  }, "РАСХОД"), /*#__PURE__*/React.createElement(Odometer, {
    value: expense,
    size: "sm2",
    tone: "rust",
    prefix: "− "
  }), comparison && /*#__PURE__*/React.createElement(ChangeBadge, {
    pct: comparison.expenseChange,
    goodDirection: "down"
  }))), /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: smallLabel
  }, "ИТОГО ЗА ПЕРИОД"), /*#__PURE__*/React.createElement(Odometer, {
    value: net,
    size: "md",
    tone: net >= 0 ? "amber" : "rust",
    prefix: net >= 0 ? "+ " : ""
  })), comparison && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "#5B7A93",
      marginBottom: 14,
      marginTop: -6
    }
  }, "vs предыдущий период: доход ", fmt(comparison.prevIncome), " zł, расход ", fmt(comparison.prevExpense), " zł"), /*#__PURE__*/React.createElement(SectionTitle, null, "Расходы по категориям"), byCategory.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    title: "Нет расходов за период",
    hint: "Измените период или добавьте операции в Кассе"
  }) : /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 16
    }
  }, byCategory.map(([name, val]) => /*#__PURE__*/React.createElement(BarRow, {
    key: name,
    label: name,
    value: val,
    max: maxCat,
    tone: "rust"
  }))), /*#__PURE__*/React.createElement(SectionTitle, null, "Районы · кто сколько принёс"), districtRanking.every(d => d.total === 0) ? /*#__PURE__*/React.createElement(Empty, {
    title: "Разбивок по районам ещё нет",
    hint: "Добавьте их во вкладке «Разбивки»"
  }) : /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 16
    }
  }, districtRanking.map(d => /*#__PURE__*/React.createElement(BarRow, {
    key: d.name,
    label: d.name,
    value: d.total,
    max: maxDist,
    tone: "green"
  }))), /*#__PURE__*/React.createElement(SectionTitle, null, "Машины · во что обходятся"), vehicleRanking.every(v => v.total === 0) ? /*#__PURE__*/React.createElement(Empty, {
    title: "Разбивок по машинам ещё нет",
    hint: "Добавьте их во вкладке «Разбивки»"
  }) : /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 16
    }
  }, vehicleRanking.map(v => /*#__PURE__*/React.createElement(BarRow, {
    key: v.name,
    label: v.name,
    value: v.total,
    max: maxVeh,
    tone: "rust"
  }))), /*#__PURE__*/React.createElement(SectionTitle, null, "Рентабельность машин"), vehicleProfitability.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    title: "Привяжите машину к району",
    hint: "В Справочнике → Машины укажите, за какой район отвечает машина — тогда посчитаем доход минус топливо"
  }) : /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 8
    }
  }, vehicleProfitability.map(v => /*#__PURE__*/React.createElement("div", {
    key: v.name,
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: "#ECE9E2"
    }
  }, v.name, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#5B7A93",
      fontSize: 11
    }
  }, "· район ", v.districtName)), /*#__PURE__*/React.createElement(Odometer, {
    value: v.profit,
    size: "sm",
    tone: v.profit >= 0 ? "green" : "rust",
    prefix: v.profit >= 0 ? "+ " : ""
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 4,
      height: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: Math.max(v.revenue, 1),
      background: "#5FA976",
      borderRadius: 4,
      opacity: 0.85
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: Math.max(v.cost, 1),
      background: "#C1553B",
      borderRadius: 4,
      opacity: 0.85
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginTop: 3,
      fontSize: 10.5,
      color: "#5B7A93"
    }
  }, /*#__PURE__*/React.createElement("span", null, "доход ", fmt(v.revenue), " zł"), /*#__PURE__*/React.createElement("span", null, "топливо ", fmt(v.cost), " zł"))))));
}
function ChangeBadge({
  pct,
  goodDirection
}) {
  if (pct === null) return /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: "#5B7A93",
      marginTop: 4
    }
  }, "новое");
  const isUp = pct >= 0;
  const isGood = goodDirection === "up" ? isUp : !isUp;
  const color = pct === 0 ? "#5B7A93" : isGood ? "#5FA976" : "#C1553B";
  const arrow = pct === 0 ? "•" : isUp ? "▲" : "▼";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color,
      marginTop: 4,
      fontWeight: 600
    }
  }, arrow, " ", Math.abs(pct).toFixed(0), "%");
}
const smallLabel = {
  fontSize: 10.5,
  color: "#5B7A93",
  fontWeight: 700,
  letterSpacing: "0.06em",
  marginBottom: 6
};
function SectionTitle({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontSize: 14,
      fontWeight: 600,
      margin: "6px 0 8px 2px",
      color: "#ECE9E2"
    }
  }, children);
}
function BarRow({
  label,
  value,
  max,
  tone
}) {
  const pct = Math.max(4, Math.round(value / max * 100));
  const colors = {
    green: "#5FA976",
    rust: "#C1553B",
    amber: "#E8A33D"
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: "#ECE9E2"
    }
  }, label), /*#__PURE__*/React.createElement(Odometer, {
    value: value,
    size: "sm",
    tone: "hi"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 6,
      background: "#14181C",
      borderRadius: 4,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${pct}%`,
      height: "100%",
      background: colors[tone],
      borderRadius: 4
    }
  })));
}

/* ================= NOTES (Заметки) ================= */

const NOTE_KINDS = [{
  id: "debt",
  label: "Долг",
  tone: "amber"
}, {
  id: "todo",
  label: "Напоминание",
  tone: "steel"
}, {
  id: "info",
  label: "Инфо",
  tone: "green"
}];
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(todayISO());
  const target = new Date(dateStr);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}
function urgencyOf(note) {
  if (note.done || !note.dueDate) return "none";
  const d = daysUntil(note.dueDate);
  if (d < 0) return "overdue";
  const remindDays = note.remindBefore === "month" ? 30 : note.remindBefore === "week" ? 7 : 3;
  if (d <= remindDays) return "soon";
  return "later";
}
const urgencyStyle = {
  overdue: {
    color: "#C1553B",
    label: "просрочено"
  },
  soon: {
    color: "#E8A33D",
    label: "скоро"
  },
  later: {
    color: "#5B7A93",
    label: null
  },
  none: {
    color: "#5B7A93",
    label: null
  }
};
function Notes({
  state,
  update
}) {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("all");
  const notes = state.notes || [];
  const list = useMemo(() => {
    return notes.filter(n => filter === "all" || n.kind === filter).sort((a, b) => {
      if (!!a.done !== !!b.done) return a.done ? 1 : -1;
      const ua = urgencyOf(a);
      const ub = urgencyOf(b);
      const rank = {
        overdue: 0,
        soon: 1,
        later: 2,
        none: 3
      };
      if (rank[ua] !== rank[ub]) return rank[ua] - rank[ub];
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });
  }, [notes, filter]);
  const upcomingCount = useMemo(() => notes.filter(n => !n.done && ["overdue", "soon"].includes(urgencyOf(n))).length, [notes]);
  function addNote(note) {
    update(prev => ({
      ...prev,
      notes: [...(prev.notes || []), {
        id: uid(),
        createdAt: new Date().toISOString(),
        done: false,
        ...note
      }]
    }));
    setShowForm(false);
  }
  function toggleDone(id) {
    update(prev => ({
      ...prev,
      notes: prev.notes.map(n => n.id === id ? {
        ...n,
        done: !n.done
      } : n)
    }));
  }
  function removeNote(id) {
    update(prev => ({
      ...prev,
      notes: prev.notes.filter(n => n.id !== id)
    }));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 14
    }
  }, upcomingCount > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12,
      padding: "9px 12px",
      borderRadius: 10,
      background: "#E8A33D14",
      border: "1px solid #E8A33D40",
      color: "#E8A33D",
      fontSize: 12.5,
      fontWeight: 600
    }
  }, "⚠ ", upcomingCount, " ", upcomingCount === 1 ? "напоминание требует" : "напоминания требуют", " внимания"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 14,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    active: filter === "all",
    tone: "steel",
    onClick: () => setFilter("all")
  }, "Всё"), NOTE_KINDS.map(k => /*#__PURE__*/React.createElement(Pill, {
    key: k.id,
    active: filter === k.id,
    tone: k.tone,
    onClick: () => setFilter(k.id)
  }, k.label))), list.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    title: "Заметок нет",
    hint: "Отмечайте долги, платежи со сроком (страховка, техосмотр) или любую важную информацию"
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, list.map(n => /*#__PURE__*/React.createElement(NoteRow, {
    key: n.id,
    note: n,
    onToggle: () => toggleDone(n.id),
    onDelete: () => removeNote(n.id)
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowForm(true),
    style: fabStyle
  }, "+"), showForm && /*#__PURE__*/React.createElement(NoteForm, {
    onCancel: () => setShowForm(false),
    onSave: addNote
  }));
}
function NoteRow({
  note,
  onToggle,
  onDelete
}) {
  const [open, setOpen] = useState(false);
  const kind = NOTE_KINDS.find(k => k.id === note.kind) || NOTE_KINDS[2];
  const colors = {
    amber: "#E8A33D",
    steel: "#5B7A93",
    green: "#5FA976"
  };
  const urgency = urgencyOf(note);
  const ustyle = urgencyStyle[urgency];
  const d = note.dueDate ? daysUntil(note.dueDate) : null;
  return /*#__PURE__*/React.createElement(Card, {
    style: {
      opacity: note.done ? 0.5 : 1,
      borderColor: urgency !== "none" && urgency !== "later" ? `${ustyle.color}55` : "#262D33"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onToggle,
    style: {
      width: 20,
      height: 20,
      borderRadius: 6,
      border: `2px solid ${colors[kind.tone]}`,
      background: note.done ? colors[kind.tone] : "transparent",
      flexShrink: 0,
      marginTop: 2,
      cursor: "pointer"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      cursor: "pointer"
    },
    onClick: () => setOpen(o => !o)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      color: colors[kind.tone],
      letterSpacing: "0.04em"
    }
  }, kind.label.toUpperCase()), note.amount ? /*#__PURE__*/React.createElement(Odometer, {
    value: note.amount,
    size: "sm",
    tone: "hi"
  }) : null, ustyle.label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      color: ustyle.color,
      border: `1px solid ${ustyle.color}55`,
      borderRadius: 999,
      padding: "1px 8px"
    }
  }, ustyle.label)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      marginTop: 3,
      textDecoration: note.done ? "line-through" : "none"
    }
  }, note.title), note.text && (open || note.text.length < 60) && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "#8B939B",
      marginTop: 4,
      whiteSpace: "pre-wrap"
    }
  }, note.text), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#5A6169",
      marginTop: 4
    }
  }, note.dueDate ? `срок: ${note.dueDate}${d !== null ? ` (${d >= 0 ? `через ${d} дн.` : `${Math.abs(d)} дн. назад`})` : ""}` : (note.createdAt || "").slice(0, 10)))), open && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onDelete,
    style: deleteBtnStyle
  }, "Удалить заметку")));
}
function NoteForm({
  onCancel,
  onSave
}) {
  const [kind, setKind] = useState("debt");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [amount, setAmount] = useState("");
  const [hasDue, setHasDue] = useState(false);
  const [dueDate, setDueDate] = useState(todayISO());
  const [remindBefore, setRemindBefore] = useState("week");
  function submit() {
    if (!title.trim()) return;
    onSave({
      kind,
      title: title.trim(),
      text: text.trim(),
      amount: amount ? Number(amount) : null,
      dueDate: hasDue ? dueDate : null,
      remindBefore: hasDue ? remindBefore : null
    });
  }
  return /*#__PURE__*/React.createElement(Sheet, {
    title: "Новая заметка",
    onClose: onCancel
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Тип"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, NOTE_KINDS.map(k => /*#__PURE__*/React.createElement(Pill, {
    key: k.id,
    active: kind === k.id,
    tone: k.tone,
    onClick: () => setKind(k.id)
  }, k.label)))), /*#__PURE__*/React.createElement(Field, {
    label: "Заголовок"
  }, /*#__PURE__*/React.createElement("input", {
    value: title,
    onChange: e => setTitle(e.target.value),
    placeholder: kind === "debt" ? "Например: Артём должен за март" : "Например: Страховка авто, Техосмотр",
    style: inputStyle
  })), kind === "debt" && /*#__PURE__*/React.createElement(Field, {
    label: "Сумма (необязательно)"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    inputMode: "decimal",
    value: amount,
    onChange: e => setAmount(e.target.value),
    placeholder: "0",
    style: inputStyle
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Срок / платёж с датой"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: hasDue ? 10 : 0
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    active: !hasDue,
    tone: "steel",
    onClick: () => setHasDue(false)
  }, "Без срока"), /*#__PURE__*/React.createElement(Pill, {
    active: hasDue,
    tone: "amber",
    onClick: () => setHasDue(true)
  }, "Есть дата")), hasDue && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: dueDate,
    onChange: e => setDueDate(e.target.value),
    style: {
      ...inputStyle,
      marginBottom: 10
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#8B939B",
      marginBottom: 6
    }
  }, "Напомнить заранее за:"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    active: remindBefore === "week",
    onClick: () => setRemindBefore("week")
  }, "Неделю"), /*#__PURE__*/React.createElement(Pill, {
    active: remindBefore === "month",
    onClick: () => setRemindBefore("month")
  }, "Месяц")))), /*#__PURE__*/React.createElement(Field, {
    label: "Подробности (необязательно)"
  }, /*#__PURE__*/React.createElement("textarea", {
    value: text,
    onChange: e => setText(e.target.value),
    placeholder: "Любая дополнительная информация",
    rows: 4,
    style: {
      ...inputStyle,
      resize: "vertical",
      fontFamily: "inherit"
    }
  })), /*#__PURE__*/React.createElement("button", {
    onClick: submit,
    style: primaryBtnStyle
  }, "Сохранить"));
}

/* ================= SETTINGS (Справочник) ================= */

function Settings({
  state,
  update
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 14
    }
  }, /*#__PURE__*/React.createElement(ListEditor, {
    title: "Районы",
    items: state.districts,
    placeholder: "Номер района, напр. 1240",
    onAdd: name => update(p => ({
      ...p,
      districts: [...p.districts, {
        id: uid(),
        name
      }]
    })),
    onRename: (id, name) => update(p => ({
      ...p,
      districts: p.districts.map(d => d.id === id ? {
        ...d,
        name
      } : d)
    })),
    onRemove: id => update(p => ({
      ...p,
      districts: p.districts.filter(d => d.id !== id)
    }))
  }), /*#__PURE__*/React.createElement(ListEditor, {
    title: "Машины",
    items: state.vehicles,
    placeholder: "Название машины",
    extraField: true,
    onAdd: (name, status) => update(p => ({
      ...p,
      vehicles: [...p.vehicles, {
        id: uid(),
        name,
        status: status || "своя"
      }]
    })),
    onRename: (id, name) => update(p => ({
      ...p,
      vehicles: p.vehicles.map(v => v.id === id ? {
        ...v,
        name
      } : v)
    })),
    onRemove: id => update(p => ({
      ...p,
      vehicles: p.vehicles.filter(v => v.id !== id)
    })),
    onStatusChange: (id, status) => update(p => ({
      ...p,
      vehicles: p.vehicles.map(v => v.id === id ? {
        ...v,
        status
      } : v)
    })),
    linkOptions: state.districts,
    linkFieldLabel: "Район (для рентабельности)",
    onLinkChange: (id, districtId) => update(p => ({
      ...p,
      vehicles: p.vehicles.map(v => v.id === id ? {
        ...v,
        districtId
      } : v)
    }))
  }), /*#__PURE__*/React.createElement(CategoryEditor, {
    title: "Категории дохода",
    list: state.categories.income,
    onChange: list => update(p => ({
      ...p,
      categories: {
        ...p.categories,
        income: list
      }
    }))
  }), /*#__PURE__*/React.createElement(CategoryEditor, {
    title: "Категории расхода",
    list: state.categories.expense,
    onChange: list => update(p => ({
      ...p,
      categories: {
        ...p.categories,
        expense: list
      }
    }))
  }), /*#__PURE__*/React.createElement(BackupCard, {
    state: state
  }));
}
function BackupCard({
  state
}) {
  function download() {
    const payload = JSON.stringify(state, null, 2);
    const blob = new Blob([payload], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lpl-logistics-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  return /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(SectionTitle, null, "Резервная копия"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "#8B939B",
      marginBottom: 12
    }
  }, "Скачайте файл со всеми данными (касса, разбивки, заметки, справочник) — на всякий случай, независимо от базы."), /*#__PURE__*/React.createElement("button", {
    onClick: download,
    style: primaryBtnStyle
  }, "Скачать резервную копию"));
}
function ListEditor({
  title,
  items,
  placeholder,
  onAdd,
  onRename,
  onRemove,
  onStatusChange,
  extraField,
  linkOptions,
  onLinkChange,
  linkFieldLabel
}) {
  const [val, setVal] = useState("");
  const [status, setStatus] = useState("своя");
  const [editingId, setEditingId] = useState(null);
  const [editVal, setEditVal] = useState("");
  return /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(SectionTitle, null, title), items.map(it => /*#__PURE__*/React.createElement("div", {
    key: it.id,
    style: {
      padding: "6px 0",
      borderBottom: "1px solid #1D2328"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, editingId === it.id ? /*#__PURE__*/React.createElement("input", {
    value: editVal,
    onChange: e => setEditVal(e.target.value),
    onBlur: () => {
      if (editVal.trim()) onRename(it.id, editVal.trim());
      setEditingId(null);
    },
    autoFocus: true,
    style: {
      ...inputStyle,
      flex: 1,
      padding: "6px 8px"
    }
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontSize: 14,
      cursor: "pointer"
    },
    onClick: () => {
      setEditingId(it.id);
      setEditVal(it.name);
    }
  }, it.name, extraField && it.status && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: "#5B7A93",
      marginLeft: 8
    }
  }, "· ", it.status)), extraField && onStatusChange && /*#__PURE__*/React.createElement("select", {
    value: it.status,
    onChange: e => onStatusChange(it.id, e.target.value),
    style: {
      ...inputStyle,
      width: 90,
      padding: "5px 6px",
      fontSize: 12
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "своя"
  }, "своя"), /*#__PURE__*/React.createElement("option", {
    value: "аренда"
  }, "аренда")), /*#__PURE__*/React.createElement("button", {
    onClick: () => onRemove(it.id),
    style: smallDeleteStyle
  }, "✕")), linkOptions && onLinkChange && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      marginTop: 6,
      paddingLeft: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: "#5B7A93",
      whiteSpace: "nowrap"
    }
  }, linkFieldLabel, ":"), /*#__PURE__*/React.createElement("select", {
    value: it.districtId || "",
    onChange: e => onLinkChange(it.id, e.target.value || null),
    style: {
      ...inputStyle,
      flex: 1,
      padding: "5px 6px",
      fontSize: 12
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "не привязана"), linkOptions.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.id,
    value: o.id
  }, o.name)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: val,
    onChange: e => setVal(e.target.value),
    placeholder: placeholder,
    style: {
      ...inputStyle,
      flex: 1
    }
  }), extraField && /*#__PURE__*/React.createElement("select", {
    value: status,
    onChange: e => setStatus(e.target.value),
    style: {
      ...inputStyle,
      width: 96
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "своя"
  }, "своя"), /*#__PURE__*/React.createElement("option", {
    value: "аренда"
  }, "аренда")), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (!val.trim()) return;
      onAdd(val.trim(), status);
      setVal("");
    },
    style: {
      ...primaryBtnStyle,
      width: 56,
      padding: 0,
      marginTop: 0
    }
  }, "+")));
}
function CategoryEditor({
  title,
  list,
  onChange
}) {
  const [val, setVal] = useState("");
  return /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(SectionTitle, null, title), list.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: c + i,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "5px 0"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontSize: 14
    }
  }, c), /*#__PURE__*/React.createElement("button", {
    onClick: () => onChange(list.filter((_, idx) => idx !== i)),
    style: smallDeleteStyle
  }, "✕"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: val,
    onChange: e => setVal(e.target.value),
    placeholder: "Новая категория",
    style: {
      ...inputStyle,
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (!val.trim()) return;
      onChange([...list, val.trim()]);
      setVal("");
    },
    style: {
      ...primaryBtnStyle,
      width: 56,
      padding: 0,
      marginTop: 0
    }
  }, "+")));
}

/* ---------------- shared bits ---------------- */

function Sheet({
  title,
  onClose,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "#000000a0",
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center",
      zIndex: 50
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      background: "#181D22",
      borderTop: "1px solid #2C333A",
      borderRadius: "18px 18px 0 0",
      padding: "18px 16px 26px",
      width: "100%",
      maxWidth: 480,
      maxHeight: "86vh",
      overflowY: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontWeight: 700,
      fontSize: 16
    }
  }, title), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      background: "none",
      border: "none",
      color: "#8B939B",
      fontSize: 20,
      cursor: "pointer"
    }
  }, "✕")), children));
}
const fabStyle = {
  position: "sticky",
  bottom: 14,
  marginLeft: "calc(100% - 54px)",
  width: 50,
  height: 50,
  borderRadius: "50%",
  background: "#E8A33D",
  color: "#14181C",
  fontSize: 26,
  fontWeight: 700,
  border: "none",
  boxShadow: "0 6px 18px #00000060",
  cursor: "pointer",
  lineHeight: "50px"
};
const primaryBtnStyle = {
  width: "100%",
  padding: "13px",
  borderRadius: 12,
  border: "none",
  background: "#E8A33D",
  color: "#14181C",
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
  marginTop: 6
};
const deleteBtnStyle = {
  background: "none",
  border: "1px solid #3A2A26",
  color: "#C1553B",
  fontSize: 12,
  padding: "6px 10px",
  borderRadius: 8,
  cursor: "pointer"
};
const smallDeleteStyle = {
  background: "none",
  border: "none",
  color: "#5A6169",
  fontSize: 14,
  cursor: "pointer",
  padding: "2px 4px"
};
function mountApp() {
  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(React.createElement(App));
}
if (window.storage) {
  mountApp();
} else {
  window.addEventListener("firebase-ready", mountApp, {
    once: true
  });
}