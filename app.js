const { useState, useEffect, useMemo, useCallback } = React;

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
  if (document.getElementById(FONT_LINK_ID)) return;
  const link = document.createElement("link");
  link.id = FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap";
  document.head.appendChild(link);
}

const uid = () => Math.random().toString(36).slice(2, 10);
const todayISO = () => new Date().toISOString().slice(0, 10);
const monthKey = (iso) => iso.slice(0, 7);

function fmt(n) {
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString("ru-RU");
}

const DEFAULT_STATE = {
  version: 1,
  company: "LPL LOGISTICS",
  categories: {
    income: ["Доход", "Прочее"],
    expense: [
      "Зарплата",
      "Топливо",
      "Аренда/Лизинг",
      "Ремонт",
      "Налоги",
      "Комиссии",
      "Мойка/бытовое",
      "Долги",
      "Перевод между кассами",
      "Прочее",
    ],
  },
  districts: [
    { id: uid(), name: "1240" },
    { id: uid(), name: "5204" },
    { id: uid(), name: "3310" },
  ],
  vehicles: [
    { id: uid(), name: "Бус (аренда)", status: "аренда" },
    { id: uid(), name: "Тойота", status: "своя" },
  ],
  transactions: [],
  incomeSplits: [],
  fuelSplits: [],
  notes: [],
};

const STORE_KEY = "lpl-store-v1";

function useStore() {
  const [state, setState] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await window.storage.get(STORE_KEY, true);
        if (cancelled) return;
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          setState({ ...DEFAULT_STATE, ...parsed });
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
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (next) => {
    setSaving(true);
    try {
      await window.storage.set(STORE_KEY, JSON.stringify(next), true);
    } catch (e) {
      // swallow — local state still updated, will retry on next change
    } finally {
      setSaving(false);
    }
  }, []);

  const update = useCallback(
    (updater) => {
      setState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        persist(next);
        return next;
      });
    },
    [persist]
  );

  return { state, update, status, saving };
}

/* ---------------- small UI atoms ---------------- */

function Odometer({ value, size = "lg", tone = "hi", prefix = "", suffix = " ₽" }) {
  const sizes = { sm: "16px", md: "20px", lg: "30px", xl: "40px" };
  const tones = {
    hi: "#ECE9E2",
    green: "#5FA976",
    rust: "#C1553B",
    amber: "#E8A33D",
    steel: "#5B7A93",
    lo: "#8B939B",
  };
  return (
    <span
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontVariantNumeric: "tabular-nums",
        fontSize: sizes[size],
        color: tones[tone],
        fontWeight: 600,
        letterSpacing: "0.02em",
      }}
    >
      {prefix}
      {fmt(value)}
      <span style={{ opacity: 0.55, fontWeight: 500 }}>{suffix}</span>
    </span>
  );
}

function Pill({ active, onClick, children, tone = "amber" }) {
  const tones = {
    amber: "#E8A33D",
    green: "#5FA976",
    rust: "#C1553B",
    steel: "#5B7A93",
  };
  return (
    <button
      onClick={onClick}
      style={{
        padding: "7px 13px",
        borderRadius: 999,
        border: `1px solid ${active ? tones[tone] : "#2C333A"}`,
        background: active ? `${tones[tone]}1A` : "transparent",
        color: active ? tones[tone] : "#8B939B",
        fontSize: 13,
        fontWeight: 600,
        whiteSpace: "nowrap",
        cursor: "pointer",
        transition: "all .15s ease",
      }}
    >
      {children}
    </button>
  );
}

function Card({ children, style }) {
  return (
    <div
      style={{
        background: "#1B2025",
        border: "1px solid #262D33",
        borderRadius: 16,
        padding: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: "#8B939B", marginBottom: 6, fontWeight: 600 }}>
        {label}
      </div>
      {children}
    </label>
  );
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
  outline: "none",
};

function Select({ value, onChange, options, placeholder }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...inputStyle, appearance: "auto" }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function Empty({ title, hint }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "36px 16px",
        color: "#8B939B",
        border: "1px dashed #2C333A",
        borderRadius: 14,
      }}
    >
      <div style={{ fontSize: 15, color: "#ECE9E2", fontWeight: 600, marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontSize: 13 }}>{hint}</div>
    </div>
  );
}

/* ---------------- period helper ---------------- */

function usePeriod() {
  const [mode, setMode] = useState("month"); // month | all | custom
  const [month, setMonth] = useState(monthKey(todayISO()));
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());

  const inRange = useCallback(
    (iso) => {
      if (mode === "all") return true;
      if (mode === "month") return monthKey(iso) === month;
      return iso >= from && iso <= to;
    },
    [mode, month, from, to]
  );

  return { mode, setMode, month, setMonth, from, setFrom, to, setTo, inRange };
}

/* ================= MAIN APP ================= */

const LOGIN = "lpl.logistics1@gmail.com";
const PASSWORD = "15072026";

function LoginScreen({ onSuccess }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submit() {
    if (password === PASSWORD) {
      onSuccess();
    } else {
      setError("Неверный пароль");
    }
  }

  return (
    <div
      style={{
        ...shellStyle,
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div style={{ width: "100%", maxWidth: 340 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 28 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: "#E8A33D",
              transform: "rotate(45deg)",
            }}
          />
          <div
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: 20,
              letterSpacing: "0.04em",
            }}
          >
            LPL LOGISTICS
          </div>
        </div>

        <Card>
          <Field label="Логин">
            <div
              style={{
                ...inputStyle,
                color: "#8B939B",
                background: "#181D22",
                userSelect: "none",
              }}
            >
              {LOGIN}
            </div>
          </Field>
          <Field label="Пароль">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="••••••••"
              style={inputStyle}
              autoFocus
            />
          </Field>
          {error && (
            <div style={{ color: "#C1553B", fontSize: 12.5, marginBottom: 10 }}>{error}</div>
          )}
          <button onClick={submit} style={primaryBtnStyle}>
            Войти
          </button>
        </Card>
      </div>
    </div>
  );
}

function App() {
  useEffect(() => {
    ensureFonts();
  }, []);

  const { state, update, status } = useStore();
  const [tab, setTab] = useState("dash");
  const [authed, setAuthed] = useState(false);

  if (!authed) {
    return <LoginScreen onSuccess={() => setAuthed(true)} />;
  }

  if (status === "loading" || !state) {
    return (
      <div style={shellStyle}>
        <div style={{ color: "#8B939B", fontFamily: "'JetBrains Mono', monospace" }}>
          загрузка…
        </div>
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 0; height: 0; }
        button { font-family: inherit; }
        input::placeholder { color: #5A6169; }
      `}</style>

      <Header company={state.company} />

      <div style={{ flex: 1, overflowY: "auto", padding: "0 14px 90px" }}>
        {tab === "dash" && <Dashboard state={state} />}
        {tab === "ledger" && <Ledger state={state} update={update} />}
        {tab === "splits" && <Splits state={state} update={update} />}
        {tab === "notes" && <Notes state={state} update={update} />}
        {tab === "settings" && <Settings state={state} update={update} />}
      </div>

      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}

const shellStyle = {
  minHeight: "100vh",
  background:
    "radial-gradient(1200px 600px at 50% -10%, #1B2126 0%, #14181C 55%, #101316 100%)",
  color: "#ECE9E2",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  display: "flex",
  flexDirection: "column",
  maxWidth: 480,
  margin: "0 auto",
  position: "relative",
};

function Header({ company }) {
  return (
    <div
      style={{
        padding: "18px 16px 14px",
        borderBottom: "1px solid #21272D",
        position: "sticky",
        top: 0,
        background: "#14181Cee",
        backdropFilter: "blur(6px)",
        zIndex: 5,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            background: "#E8A33D",
            transform: "rotate(45deg)",
          }}
        />
        <div
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: 17,
            letterSpacing: "0.04em",
          }}
        >
          {company}
        </div>
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#5B7A93",
          fontFamily: "'JetBrains Mono', monospace",
          marginTop: 3,
          letterSpacing: "0.04em",
        }}
      >
        ФИНАНСОВАЯ ПАНЕЛЬ · КАССА
      </div>
    </div>
  );
}

function BottomNav({ tab, setTab }) {
  const items = [
    { id: "dash", label: "Дашборд", glyph: "▤" },
    { id: "ledger", label: "Касса", glyph: "≡" },
    { id: "splits", label: "Разбивки", glyph: "⑃" },
    { id: "notes", label: "Заметки", glyph: "✎" },
    { id: "settings", label: "Справочник", glyph: "⚙" },
  ];
  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        display: "flex",
        borderTop: "1px solid #21272D",
        background: "#14181Cf5",
        backdropFilter: "blur(6px)",
        maxWidth: 480,
        width: "100%",
      }}
    >
      {items.map((it) => {
        const active = tab === it.id;
        return (
          <button
            key={it.id}
            onClick={() => setTab(it.id)}
            style={{
              flex: 1,
              background: "none",
              border: "none",
              padding: "10px 0 12px",
              color: active ? "#E8A33D" : "#5A6169",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>{it.glyph}</span>
            <span style={{ fontSize: 10.5, fontWeight: 600 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ================= LEDGER (Касса) ================= */

function Ledger({ state, update }) {
  const [showForm, setShowForm] = useState(false);
  const [filterMethod, setFilterMethod] = useState("all");
  const period = usePeriod();

  const list = useMemo(() => {
    return state.transactions
      .filter((t) => period.inRange(t.date))
      .filter((t) => filterMethod === "all" || t.method === filterMethod)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [state.transactions, period, filterMethod]);

  function addTx(tx) {
    update((prev) => ({
      ...prev,
      transactions: [...prev.transactions, { id: uid(), ...tx }],
    }));
    setShowForm(false);
  }

  function removeTx(id) {
    update((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
    }));
  }

  return (
    <div>
      <PeriodBar period={period} />

      <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
        {["all", "cash", "card"].map((m) => (
          <Pill key={m} active={filterMethod === m} onClick={() => setFilterMethod(m)}>
            {m === "all" ? "Всё" : m === "cash" ? "Наличка" : "Карта"}
          </Pill>
        ))}
      </div>

      {list.length === 0 ? (
        <Empty title="Пока нет операций" hint="Добавьте первую запись кнопкой ниже" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((t) => (
            <TxRow key={t.id} tx={t} onDelete={() => removeTx(t.id)} />
          ))}
        </div>
      )}

      <button onClick={() => setShowForm(true)} style={fabStyle}>
        +
      </button>

      {showForm && (
        <TxForm
          categories={state.categories}
          onCancel={() => setShowForm(false)}
          onSave={addTx}
        />
      )}
    </div>
  );
}

function PeriodBar({ period }) {
  return (
    <div style={{ paddingTop: 14, display: "flex", gap: 8, alignItems: "center" }}>
      {["month", "all", "custom"].map((m) => (
        <Pill key={m} active={period.mode === m} onClick={() => period.setMode(m)} tone="steel">
          {m === "month" ? "Месяц" : m === "all" ? "Всё время" : "Период"}
        </Pill>
      ))}
      {period.mode === "month" && (
        <input
          type="month"
          value={period.month}
          onChange={(e) => period.setMonth(e.target.value)}
          style={{ ...inputStyle, width: 140, padding: "6px 8px", fontSize: 13 }}
        />
      )}
      {period.mode === "custom" && (
        <div style={{ display: "flex", gap: 6 }}>
          <input
            type="date"
            value={period.from}
            onChange={(e) => period.setFrom(e.target.value)}
            style={{ ...inputStyle, width: 120, padding: "6px 8px", fontSize: 12 }}
          />
          <input
            type="date"
            value={period.to}
            onChange={(e) => period.setTo(e.target.value)}
            style={{ ...inputStyle, width: 120, padding: "6px 8px", fontSize: 12 }}
          />
        </div>
      )}
    </div>
  );
}

const toneForType = { income: "green", expense: "rust", transfer: "steel" };
const signForType = { income: "+", expense: "−", transfer: "⇄" };

function TxRow({ tx, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <Card style={{ padding: 12 }}>
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
        onClick={() => setOpen((o) => !o)}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#ECE9E2" }}>{tx.category}</div>
          <div style={{ fontSize: 12, color: "#8B939B", marginTop: 2 }}>
            {tx.date} ·{" "}
            {tx.type === "transfer"
              ? tx.direction === "cash_to_card"
                ? "нал → карта"
                : "карта → нал"
              : tx.method === "cash"
              ? "нал"
              : "карта"}
            {tx.comment ? ` · ${tx.comment}` : ""}
          </div>
        </div>
        <Odometer
          value={tx.amount}
          size="md"
          tone={toneForType[tx.type]}
          prefix={signForType[tx.type] + " "}
        />
      </div>
      {open && (
        <div style={{ marginTop: 10, textAlign: "right" }}>
          <button onClick={onDelete} style={deleteBtnStyle}>
            Удалить запись
          </button>
        </div>
      )}
    </Card>
  );
}

function DirectionOption({ active, onClick, fromLabel, toLabel, hint }) {
  return (
    <button
      onClick={onClick}
      style={{
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
        color: "#ECE9E2",
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
          <span>{fromLabel}</span>
          <span style={{ color: active ? "#5B7A93" : "#5A6169" }}>→</span>
          <span>{toLabel}</span>
        </div>
        <div style={{ fontSize: 11.5, color: "#8B939B", marginTop: 3 }}>{hint}</div>
      </div>
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: `2px solid ${active ? "#5B7A93" : "#3A4249"}`,
          background: active ? "#5B7A93" : "transparent",
          flexShrink: 0,
        }}
      />
    </button>
  );
}

function TxForm({ categories, onCancel, onSave }) {
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
        method: direction === "cash_to_card" ? "cash" : "card", // source, for display in ledger row
        category: "Перевод между кассами",
        date,
        comment,
      });
      return;
    }
    if (!category) return;
    onSave({ type, amount: Number(amount), method, category, date, comment });
  }

  return (
    <Sheet title="Новая операция" onClose={onCancel}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[
          { id: "income", label: "Доход", tone: "green" },
          { id: "expense", label: "Расход", tone: "rust" },
          { id: "transfer", label: "Перевод", tone: "steel" },
        ].map((o) => (
          <Pill
            key={o.id}
            active={type === o.id}
            tone={o.tone}
            onClick={() => {
              setType(o.id);
              setCategory("");
            }}
          >
            {o.label}
          </Pill>
        ))}
      </div>

      <Field label="Сумма">
        <input
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          style={inputStyle}
        />
      </Field>

      {type === "transfer" ? (
        <Field label="Направление перевода">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <DirectionOption
              active={direction === "card_to_cash"}
              onClick={() => setDirection("card_to_cash")}
              fromLabel="Карта"
              toLabel="Наличка"
              hint="Например: сняли деньги в банкомате"
            />
            <DirectionOption
              active={direction === "cash_to_card"}
              onClick={() => setDirection("cash_to_card")}
              fromLabel="Наличка"
              toLabel="Карта"
              hint="Например: внесли наличные на карту/счёт"
            />
          </div>
        </Field>
      ) : (
        <Field label="Способ оплаты">
          <div style={{ display: "flex", gap: 8 }}>
            <Pill active={method === "cash"} onClick={() => setMethod("cash")}>
              Наличка
            </Pill>
            <Pill active={method === "card"} onClick={() => setMethod("card")}>
              Карта
            </Pill>
          </div>
        </Field>
      )}

      {type !== "transfer" && (
        <Field label="Категория">
          <Select value={category} onChange={setCategory} options={catList} placeholder="Выбрать категорию" />
        </Field>
      )}

      <Field label="Дата">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
      </Field>

      <Field label="Комментарий (необязательно)">
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Например: DPD за март"
          style={inputStyle}
        />
      </Field>

      <button onClick={submit} style={primaryBtnStyle}>
        Сохранить
      </button>
    </Sheet>
  );
}

/* ================= SPLITS (Разбивки) ================= */

function Splits({ state, update }) {
  const [mode, setMode] = useState("income"); // income | fuel
  return (
    <div style={{ paddingTop: 14 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <Pill active={mode === "income"} tone="green" onClick={() => setMode("income")}>
          По районам
        </Pill>
        <Pill active={mode === "fuel"} tone="rust" onClick={() => setMode("fuel")}>
          По машинам
        </Pill>
      </div>
      {mode === "income" ? (
        <SplitBlock
          state={state}
          update={update}
          storeKey="incomeSplits"
          targets={state.districts}
          targetLabel="Район"
          tone="green"
          invoiceHint="Например: DPD март 2026"
        />
      ) : (
        <SplitBlock
          state={state}
          update={update}
          storeKey="fuelSplits"
          targets={state.vehicles}
          targetLabel="Машина"
          tone="rust"
          invoiceHint="Например: DKV топливо март"
        />
      )}
    </div>
  );
}

function SplitBlock({ state, update, storeKey, targets, targetLabel, tone, invoiceHint }) {
  const [showForm, setShowForm] = useState(false);
  const splits = state[storeKey];

  function addSplit(split) {
    update((prev) => ({ ...prev, [storeKey]: [...prev[storeKey], { id: uid(), ...split }] }));
    setShowForm(false);
  }
  function removeSplit(id) {
    update((prev) => ({ ...prev, [storeKey]: prev[storeKey].filter((s) => s.id !== id) }));
  }

  if (targets.length === 0) {
    return (
      <Empty
        title={`Нет списка «${targetLabel}»`}
        hint="Добавьте хотя бы один вариант в Справочнике, прежде чем делать разбивку"
      />
    );
  }

  return (
    <div>
      {splits.length === 0 ? (
        <Empty title="Разбивок ещё нет" hint="Распределите фактуру по позициям ниже" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {splits
            .slice()
            .sort((a, b) => (a.date < b.date ? 1 : -1))
            .map((s) => (
              <SplitCard key={s.id} split={s} targets={targets} tone={tone} onDelete={() => removeSplit(s.id)} />
            ))}
        </div>
      )}

      <button onClick={() => setShowForm(true)} style={fabStyle}>
        +
      </button>

      {showForm && (
        <SplitForm
          targets={targets}
          targetLabel={targetLabel}
          invoiceHint={invoiceHint}
          onCancel={() => setShowForm(false)}
          onSave={addSplit}
        />
      )}
    </div>
  );
}

function SplitCard({ split, targets, tone, onDelete }) {
  const [open, setOpen] = useState(false);
  const allocSum = split.allocations.reduce((a, x) => a + Number(x.amount || 0), 0);
  const diff = Number(split.total) - allocSum;
  const nameOf = (id) => targets.find((t) => t.id === id)?.name || "—";

  return (
    <Card>
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
        onClick={() => setOpen((o) => !o)}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{split.label || "Фактура"}</div>
          <div style={{ fontSize: 12, color: "#8B939B", marginTop: 2 }}>{split.date}</div>
        </div>
        <Odometer value={split.total} size="md" tone={tone} prefix="" />
      </div>

      {open && (
        <div style={{ marginTop: 12, borderTop: "1px solid #262D33", paddingTop: 10 }}>
          {split.allocations.map((a, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                padding: "5px 0",
                color: "#ECE9E2",
              }}
            >
              <span>{nameOf(a.targetId)}</span>
              <Odometer value={a.amount} size="sm" tone="hi" />
            </div>
          ))}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 6,
              paddingTop: 6,
              borderTop: "1px dashed #2C333A",
              fontSize: 12,
              color: diff === 0 ? "#5FA976" : "#C1553B",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            <span>{diff === 0 ? "✓ сходится с фактурой" : "⚠ расхождение"}</span>
            <span>{diff !== 0 ? `${diff > 0 ? "+" : ""}${fmt(diff)}` : ""}</span>
          </div>
          <div style={{ textAlign: "right", marginTop: 10 }}>
            <button onClick={onDelete} style={deleteBtnStyle}>
              Удалить разбивку
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

function SplitForm({ targets, targetLabel, invoiceHint, onCancel, onSave }) {
  const [label, setLabel] = useState("");
  const [total, setTotal] = useState("");
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState(targets.map((t) => ({ targetId: t.id, amount: "" })));

  const allocSum = rows.reduce((a, r) => a + Number(r.amount || 0), 0);
  const diff = Number(total || 0) - allocSum;

  function setRowAmount(idx, val) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, amount: val } : r)));
  }

  function submit() {
    if (!total) return;
    const allocations = rows
      .filter((r) => Number(r.amount) > 0)
      .map((r) => ({ targetId: r.targetId, amount: Number(r.amount) }));
    if (allocations.length === 0) return;
    onSave({ label, total: Number(total), date, allocations });
  }

  return (
    <Sheet title={`Разбивка · ${targetLabel}`} onClose={onCancel}>
      <Field label="Название фактуры">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={invoiceHint} style={inputStyle} />
      </Field>
      <Field label="Сумма фактуры">
        <input
          type="number"
          inputMode="decimal"
          value={total}
          onChange={(e) => setTotal(e.target.value)}
          placeholder="0"
          style={inputStyle}
        />
      </Field>
      <Field label="Дата">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
      </Field>

      <div style={{ fontSize: 12, color: "#8B939B", fontWeight: 600, marginBottom: 8 }}>
        Распределить по: {targetLabel.toLowerCase()}у
      </div>
      {targets.map((t, i) => (
        <div key={t.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <div style={{ flex: 1, fontSize: 14 }}>{t.name}</div>
          <input
            type="number"
            inputMode="decimal"
            value={rows[i]?.amount ?? ""}
            onChange={(e) => setRowAmount(i, e.target.value)}
            placeholder="0"
            style={{ ...inputStyle, width: 110 }}
          />
        </div>
      ))}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 13,
          margin: "10px 0 16px",
          color: diff === 0 ? "#5FA976" : "#C1553B",
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        <span>Остаток к распределению</span>
        <span>{fmt(diff)} ₽</span>
      </div>

      <button onClick={submit} style={primaryBtnStyle}>
        Сохранить разбивку
      </button>
    </Sheet>
  );
}

/* ================= DASHBOARD ================= */

function Dashboard({ state }) {
  const period = usePeriod();

  const txInRange = useMemo(
    () => state.transactions.filter((t) => period.inRange(t.date)),
    [state.transactions, period]
  );

  const allTx = state.transactions;

  const balance = useMemo(() => {
    let cash = 0,
      card = 0;
    for (const t of allTx) {
      if (t.type === "income") {
        if (t.method === "cash") cash += t.amount;
        else card += t.amount;
      } else if (t.type === "expense") {
        if (t.method === "cash") cash -= t.amount;
        else card -= t.amount;
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
    return { cash, card };
  }, [allTx]);

  const { income, expense, byCategory } = useMemo(() => {
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
    return { income, expense, byCategory: rows };
  }, [txInRange]);

  const districtRanking = useMemo(() => {
    const sums = {};
    for (const s of state.incomeSplits) {
      if (!period.inRange(s.date)) continue;
      for (const a of s.allocations) sums[a.targetId] = (sums[a.targetId] || 0) + Number(a.amount);
    }
    return state.districts
      .map((d) => ({ name: d.name, total: sums[d.id] || 0 }))
      .sort((a, b) => b.total - a.total);
  }, [state.incomeSplits, state.districts, period]);

  const vehicleRanking = useMemo(() => {
    const sums = {};
    for (const s of state.fuelSplits) {
      if (!period.inRange(s.date)) continue;
      for (const a of s.allocations) sums[a.targetId] = (sums[a.targetId] || 0) + Number(a.amount);
    }
    return state.vehicles
      .map((v) => ({ name: v.name, total: sums[v.id] || 0 }))
      .sort((a, b) => b.total - a.total);
  }, [state.fuelSplits, state.vehicles, period]);

  const net = income - expense;
  const maxCat = byCategory[0]?.[1] || 1;
  const maxDist = districtRanking[0]?.total || 1;
  const maxVeh = vehicleRanking[0]?.total || 1;

  return (
    <div style={{ paddingTop: 14, paddingBottom: 10 }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <Card style={{ flex: 1 }}>
          <div style={smallLabel}>НАЛИЧКА</div>
          <Odometer value={balance.cash} size="lg" tone={balance.cash < 0 ? "rust" : "hi"} />
        </Card>
        <Card style={{ flex: 1 }}>
          <div style={smallLabel}>КАРТА</div>
          <Odometer value={balance.card} size="lg" tone={balance.card < 0 ? "rust" : "hi"} />
        </Card>
      </div>

      <PeriodBar period={period} />

      <div style={{ display: "flex", gap: 10, margin: "14px 0" }}>
        <Card style={{ flex: 1 }}>
          <div style={smallLabel}>ДОХОД</div>
          <Odometer value={income} size="md" tone="green" prefix="+ " />
        </Card>
        <Card style={{ flex: 1 }}>
          <div style={smallLabel}>РАСХОД</div>
          <Odometer value={expense} size="md" tone="rust" prefix="− " />
        </Card>
        <Card style={{ flex: 1 }}>
          <div style={smallLabel}>ИТОГО</div>
          <Odometer value={net} size="md" tone={net >= 0 ? "amber" : "rust"} prefix={net >= 0 ? "+ " : ""} />
        </Card>
      </div>

      <SectionTitle>Расходы по категориям</SectionTitle>
      {byCategory.length === 0 ? (
        <Empty title="Нет расходов за период" hint="Измените период или добавьте операции в Кассе" />
      ) : (
        <Card style={{ marginBottom: 16 }}>
          {byCategory.map(([name, val]) => (
            <BarRow key={name} label={name} value={val} max={maxCat} tone="rust" />
          ))}
        </Card>
      )}

      <SectionTitle>Районы · кто сколько принёс</SectionTitle>
      {districtRanking.every((d) => d.total === 0) ? (
        <Empty title="Разбивок по районам ещё нет" hint="Добавьте их во вкладке «Разбивки»" />
      ) : (
        <Card style={{ marginBottom: 16 }}>
          {districtRanking.map((d) => (
            <BarRow key={d.name} label={d.name} value={d.total} max={maxDist} tone="green" />
          ))}
        </Card>
      )}

      <SectionTitle>Машины · во что обходятся</SectionTitle>
      {vehicleRanking.every((v) => v.total === 0) ? (
        <Empty title="Разбивок по машинам ещё нет" hint="Добавьте их во вкладке «Разбивки»" />
      ) : (
        <Card style={{ marginBottom: 8 }}>
          {vehicleRanking.map((v) => (
            <BarRow key={v.name} label={v.name} value={v.total} max={maxVeh} tone="rust" />
          ))}
        </Card>
      )}
    </div>
  );
}

const smallLabel = {
  fontSize: 10.5,
  color: "#5B7A93",
  fontWeight: 700,
  letterSpacing: "0.06em",
  marginBottom: 6,
};

function SectionTitle({ children }) {
  return (
    <div
      style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 14,
        fontWeight: 600,
        margin: "6px 0 8px 2px",
        color: "#ECE9E2",
      }}
    >
      {children}
    </div>
  );
}

function BarRow({ label, value, max, tone }) {
  const pct = Math.max(4, Math.round((value / max) * 100));
  const colors = { green: "#5FA976", rust: "#C1553B", amber: "#E8A33D" };
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: "#ECE9E2" }}>{label}</span>
        <Odometer value={value} size="sm" tone="hi" />
      </div>
      <div style={{ height: 6, background: "#14181C", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: colors[tone], borderRadius: 4 }} />
      </div>
    </div>
  );
}

/* ================= NOTES (Заметки) ================= */

const NOTE_KINDS = [
  { id: "debt", label: "Долг", tone: "amber" },
  { id: "todo", label: "Напоминание", tone: "steel" },
  { id: "info", label: "Инфо", tone: "green" },
];

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
  overdue: { color: "#C1553B", label: "просрочено" },
  soon: { color: "#E8A33D", label: "скоро" },
  later: { color: "#5B7A93", label: null },
  none: { color: "#5B7A93", label: null },
};

function Notes({ state, update }) {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("all");

  const notes = state.notes || [];

  const list = useMemo(() => {
    return notes
      .filter((n) => filter === "all" || n.kind === filter)
      .sort((a, b) => {
        if (!!a.done !== !!b.done) return a.done ? 1 : -1;
        const ua = urgencyOf(a);
        const ub = urgencyOf(b);
        const rank = { overdue: 0, soon: 1, later: 2, none: 3 };
        if (rank[ua] !== rank[ub]) return rank[ua] - rank[ub];
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return (b.createdAt || "").localeCompare(a.createdAt || "");
      });
  }, [notes, filter]);

  const upcomingCount = useMemo(
    () => notes.filter((n) => !n.done && ["overdue", "soon"].includes(urgencyOf(n))).length,
    [notes]
  );

  function addNote(note) {
    update((prev) => ({
      ...prev,
      notes: [...(prev.notes || []), { id: uid(), createdAt: new Date().toISOString(), done: false, ...note }],
    }));
    setShowForm(false);
  }

  function toggleDone(id) {
    update((prev) => ({
      ...prev,
      notes: prev.notes.map((n) => (n.id === id ? { ...n, done: !n.done } : n)),
    }));
  }

  function removeNote(id) {
    update((prev) => ({ ...prev, notes: prev.notes.filter((n) => n.id !== id) }));
  }

  return (
    <div style={{ paddingTop: 14 }}>
      {upcomingCount > 0 && (
        <div
          style={{
            marginBottom: 12,
            padding: "9px 12px",
            borderRadius: 10,
            background: "#E8A33D14",
            border: "1px solid #E8A33D40",
            color: "#E8A33D",
            fontSize: 12.5,
            fontWeight: 600,
          }}
        >
          ⚠ {upcomingCount} {upcomingCount === 1 ? "напоминание требует" : "напоминания требуют"} внимания
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <Pill active={filter === "all"} tone="steel" onClick={() => setFilter("all")}>
          Всё
        </Pill>
        {NOTE_KINDS.map((k) => (
          <Pill key={k.id} active={filter === k.id} tone={k.tone} onClick={() => setFilter(k.id)}>
            {k.label}
          </Pill>
        ))}
      </div>

      {list.length === 0 ? (
        <Empty title="Заметок нет" hint="Отмечайте долги, платежи со сроком (страховка, техосмотр) или любую важную информацию" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((n) => (
            <NoteRow key={n.id} note={n} onToggle={() => toggleDone(n.id)} onDelete={() => removeNote(n.id)} />
          ))}
        </div>
      )}

      <button onClick={() => setShowForm(true)} style={fabStyle}>
        +
      </button>

      {showForm && <NoteForm onCancel={() => setShowForm(false)} onSave={addNote} />}
    </div>
  );
}

function NoteRow({ note, onToggle, onDelete }) {
  const [open, setOpen] = useState(false);
  const kind = NOTE_KINDS.find((k) => k.id === note.kind) || NOTE_KINDS[2];
  const colors = { amber: "#E8A33D", steel: "#5B7A93", green: "#5FA976" };
  const urgency = urgencyOf(note);
  const ustyle = urgencyStyle[urgency];
  const d = note.dueDate ? daysUntil(note.dueDate) : null;

  return (
    <Card style={{ opacity: note.done ? 0.5 : 1, borderColor: urgency !== "none" && urgency !== "later" ? `${ustyle.color}55` : "#262D33" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <button
          onClick={onToggle}
          style={{
            width: 20,
            height: 20,
            borderRadius: 6,
            border: `2px solid ${colors[kind.tone]}`,
            background: note.done ? colors[kind.tone] : "transparent",
            flexShrink: 0,
            marginTop: 2,
            cursor: "pointer",
          }}
        />
        <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setOpen((o) => !o)}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: colors[kind.tone],
                letterSpacing: "0.04em",
              }}
            >
              {kind.label.toUpperCase()}
            </span>
            {note.amount ? <Odometer value={note.amount} size="sm" tone="hi" /> : null}
            {ustyle.label && (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: ustyle.color,
                  border: `1px solid ${ustyle.color}55`,
                  borderRadius: 999,
                  padding: "1px 8px",
                }}
              >
                {ustyle.label}
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              marginTop: 3,
              textDecoration: note.done ? "line-through" : "none",
            }}
          >
            {note.title}
          </div>
          {note.text && (open || note.text.length < 60) && (
            <div style={{ fontSize: 13, color: "#8B939B", marginTop: 4, whiteSpace: "pre-wrap" }}>{note.text}</div>
          )}
          <div style={{ fontSize: 11, color: "#5A6169", marginTop: 4 }}>
            {note.dueDate
              ? `срок: ${note.dueDate}${d !== null ? ` (${d >= 0 ? `через ${d} дн.` : `${Math.abs(d)} дн. назад`})` : ""}`
              : (note.createdAt || "").slice(0, 10)}
          </div>
        </div>
      </div>
      {open && (
        <div style={{ marginTop: 10, textAlign: "right" }}>
          <button onClick={onDelete} style={deleteBtnStyle}>
            Удалить заметку
          </button>
        </div>
      )}
    </Card>
  );
}

function NoteForm({ onCancel, onSave }) {
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
      remindBefore: hasDue ? remindBefore : null,
    });
  }

  return (
    <Sheet title="Новая заметка" onClose={onCancel}>
      <Field label="Тип">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {NOTE_KINDS.map((k) => (
            <Pill key={k.id} active={kind === k.id} tone={k.tone} onClick={() => setKind(k.id)}>
              {k.label}
            </Pill>
          ))}
        </div>
      </Field>

      <Field label="Заголовок">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={kind === "debt" ? "Например: Артём должен за март" : "Например: Страховка авто, Техосмотр"}
          style={inputStyle}
        />
      </Field>

      {kind === "debt" && (
        <Field label="Сумма (необязательно)">
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            style={inputStyle}
          />
        </Field>
      )}

      <Field label="Срок / платёж с датой">
        <div style={{ display: "flex", gap: 8, marginBottom: hasDue ? 10 : 0 }}>
          <Pill active={!hasDue} tone="steel" onClick={() => setHasDue(false)}>
            Без срока
          </Pill>
          <Pill active={hasDue} tone="amber" onClick={() => setHasDue(true)}>
            Есть дата
          </Pill>
        </div>
        {hasDue && (
          <>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{ ...inputStyle, marginBottom: 10 }}
            />
            <div style={{ fontSize: 12, color: "#8B939B", marginBottom: 6 }}>Напомнить заранее за:</div>
            <div style={{ display: "flex", gap: 8 }}>
              <Pill active={remindBefore === "week"} onClick={() => setRemindBefore("week")}>
                Неделю
              </Pill>
              <Pill active={remindBefore === "month"} onClick={() => setRemindBefore("month")}>
                Месяц
              </Pill>
            </div>
          </>
        )}
      </Field>

      <Field label="Подробности (необязательно)">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Любая дополнительная информация"
          rows={4}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />
      </Field>

      <button onClick={submit} style={primaryBtnStyle}>
        Сохранить
      </button>
    </Sheet>
  );
}

/* ================= SETTINGS (Справочник) ================= */

function Settings({ state, update }) {
  return (
    <div style={{ paddingTop: 14 }}>
      <ListEditor
        title="Районы"
        items={state.districts}
        placeholder="Номер района, напр. 1240"
        onAdd={(name) => update((p) => ({ ...p, districts: [...p.districts, { id: uid(), name }] }))}
        onRename={(id, name) =>
          update((p) => ({ ...p, districts: p.districts.map((d) => (d.id === id ? { ...d, name } : d)) }))
        }
        onRemove={(id) => update((p) => ({ ...p, districts: p.districts.filter((d) => d.id !== id) }))}
      />

      <ListEditor
        title="Машины"
        items={state.vehicles}
        placeholder="Название машины"
        extraField
        onAdd={(name, status) =>
          update((p) => ({ ...p, vehicles: [...p.vehicles, { id: uid(), name, status: status || "своя" }] }))
        }
        onRename={(id, name) =>
          update((p) => ({ ...p, vehicles: p.vehicles.map((v) => (v.id === id ? { ...v, name } : v)) }))
        }
        onRemove={(id) => update((p) => ({ ...p, vehicles: p.vehicles.filter((v) => v.id !== id) }))}
        onStatusChange={(id, status) =>
          update((p) => ({ ...p, vehicles: p.vehicles.map((v) => (v.id === id ? { ...v, status } : v)) }))
        }
      />

      <CategoryEditor
        title="Категории дохода"
        list={state.categories.income}
        onChange={(list) => update((p) => ({ ...p, categories: { ...p.categories, income: list } }))}
      />
      <CategoryEditor
        title="Категории расхода"
        list={state.categories.expense}
        onChange={(list) => update((p) => ({ ...p, categories: { ...p.categories, expense: list } }))}
      />
    </div>
  );
}

function ListEditor({ title, items, placeholder, onAdd, onRename, onRemove, onStatusChange, extraField }) {
  const [val, setVal] = useState("");
  const [status, setStatus] = useState("своя");
  const [editingId, setEditingId] = useState(null);
  const [editVal, setEditVal] = useState("");

  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionTitle>{title}</SectionTitle>
      {items.map((it) => (
        <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
          {editingId === it.id ? (
            <input
              value={editVal}
              onChange={(e) => setEditVal(e.target.value)}
              onBlur={() => {
                if (editVal.trim()) onRename(it.id, editVal.trim());
                setEditingId(null);
              }}
              autoFocus
              style={{ ...inputStyle, flex: 1, padding: "6px 8px" }}
            />
          ) : (
            <div
              style={{ flex: 1, fontSize: 14, cursor: "pointer" }}
              onClick={() => {
                setEditingId(it.id);
                setEditVal(it.name);
              }}
            >
              {it.name}
              {extraField && it.status && (
                <span style={{ fontSize: 11, color: "#5B7A93", marginLeft: 8 }}>· {it.status}</span>
              )}
            </div>
          )}
          {extraField && onStatusChange && (
            <select
              value={it.status}
              onChange={(e) => onStatusChange(it.id, e.target.value)}
              style={{ ...inputStyle, width: 96, padding: "5px 6px", fontSize: 12 }}
            >
              <option value="своя">своя</option>
              <option value="аренда">аренда</option>
            </select>
          )}
          <button onClick={() => onRemove(it.id)} style={smallDeleteStyle}>
            ✕
          </button>
        </div>
      ))}

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={placeholder}
          style={{ ...inputStyle, flex: 1 }}
        />
        {extraField && (
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...inputStyle, width: 96 }}>
            <option value="своя">своя</option>
            <option value="аренда">аренда</option>
          </select>
        )}
        <button
          onClick={() => {
            if (!val.trim()) return;
            onAdd(val.trim(), status);
            setVal("");
          }}
          style={{ ...primaryBtnStyle, width: 56, padding: 0, marginTop: 0 }}
        >
          +
        </button>
      </div>
    </Card>
  );
}

function CategoryEditor({ title, list, onChange }) {
  const [val, setVal] = useState("");
  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionTitle>{title}</SectionTitle>
      {list.map((c, i) => (
        <div key={c + i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
          <div style={{ flex: 1, fontSize: 14 }}>{c}</div>
          <button
            onClick={() => onChange(list.filter((_, idx) => idx !== i))}
            style={smallDeleteStyle}
          >
            ✕
          </button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="Новая категория"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          onClick={() => {
            if (!val.trim()) return;
            onChange([...list, val.trim()]);
            setVal("");
          }}
          style={{ ...primaryBtnStyle, width: 56, padding: 0, marginTop: 0 }}
        >
          +
        </button>
      </div>
    </Card>
  );
}

/* ---------------- shared bits ---------------- */

function Sheet({ title, onClose, children }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000000a0",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#181D22",
          borderTop: "1px solid #2C333A",
          borderRadius: "18px 18px 0 0",
          padding: "18px 16px 26px",
          width: "100%",
          maxWidth: 480,
          maxHeight: "86vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8B939B", fontSize: 20, cursor: "pointer" }}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
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
  lineHeight: "50px",
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
  marginTop: 6,
};

const deleteBtnStyle = {
  background: "none",
  border: "1px solid #3A2A26",
  color: "#C1553B",
  fontSize: 12,
  padding: "6px 10px",
  borderRadius: 8,
  cursor: "pointer",
};

const smallDeleteStyle = {
  background: "none",
  border: "none",
  color: "#5A6169",
  fontSize: 14,
  cursor: "pointer",
  padding: "2px 4px",
};


function mountApp() {
  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(React.createElement(App));
}

if (window.storage) {
  mountApp();
} else {
  window.addEventListener("firebase-ready", mountApp, { once: true });
}
