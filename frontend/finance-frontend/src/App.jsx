import { useState, useCallback, useMemo } from "react";
import "./index.css"; // Garante a importação do design system VIP

const API_BASE = "http://localhost:8000";

// --- Paleta e utilitários ---
const CATEGORY_COLORS = {
  "Alimentação": "#FF6B6B",
  "Transporte": "#4ECDC4",
  "Lazer & Entretenimento": "#A78BFA",
  "Moradia": "#F59E0B",
  "Saúde": "#34D399",
  "Compras Online": "#FB923C",
  "Educação": "#60A5FA",
  "Vestuário": "#F472B6",
  "Bancos & Finanças": "#94A3B8",
  "Pagamento de Fatura / Interno": "#8B5CF6",
  "Outros": "#CBD5E1",
};

const fmtBRL = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtDate = (isoString) => {
  if (!isoString) return "";
  const parts = isoString.split("-");
  if (parts.length !== 3) return isoString;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const getCategoryColor = (cat, customColors = {}) => {
  if (!cat) return "#CBD5E1";
  if (customColors[cat]) return customColors[cat];
  if (CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat];
  
  let hash = 0;
  for (let i = 0; i < cat.length; i++) {
    hash = cat.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 65%)`;
};

const getCategoryBgColor = (cat, customColors = {}) => {
  const fg = getCategoryColor(cat, customColors);
  if (fg.startsWith("hsl")) {
    return fg.replace("hsl", "hsla").replace(")", ", 0.10)");
  }
  return fg + "1A"; // hex opacity
};

// --- Sub-componentes ---

function UploadZone({ onUpload, loading }) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type === "application/pdf") onUpload(file);
  }, [onUpload]);

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file) onUpload(file);
  };

  return (
    <div
      className={`glass-panel interactive ${dragging ? 'dragging' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      style={{ textAlign: "center", padding: "64px 32px", borderStyle: "dashed" }}
    >
      <div style={{ fontSize: 56, marginBottom: 16 }}>📄</div>
      <p style={{ color: "var(--text-primary)", marginBottom: 8, fontSize: 18, fontWeight: 600 }}>
        Arraste sua fatura ou extrato aqui
      </p>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 24 }}>
        Segurança bancária • Apenas formatos PDF
      </p>
      <label style={{
        background: "linear-gradient(135deg, var(--neon-primary), #3B82F6)",
        color: "#05050A",
        padding: "12px 32px",
        borderRadius: 8,
        cursor: "pointer",
        fontWeight: 700,
        fontSize: 14,
        display: "inline-block",
        boxShadow: "0 4px 15px rgba(110, 231, 183, 0.4)",
        transition: "all 0.2s ease"
      }}>
        {loading ? "Descriptografando PDF..." : "Selecionar Documento"}
        <input type="file" accept=".pdf" onChange={handleChange} style={{ display: "none" }} disabled={loading} />
      </label>
    </div>
  );
}

function SummaryCard({ label, value, sub, accent }) {
  return (
    <div className="glass-panel summary-card" style={{ '--card-accent': accent }}>
      <span className="h-section" style={{marginBottom: 8}}>{label}</span>
      <p className="text-mono" style={{ fontSize: 28, fontWeight: 700 }}>{value}</p>
      {sub && <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>{sub}</p>}
    </div>
  );
}

function CategoryBar({ data, customColors }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {data.map((d) => (
        <div key={d.category}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 500 }}>{d.category}</span>
            <span className="text-mono" style={{ color: "var(--text-accent)", fontSize: 13 }}>
              {fmtBRL(d.total)} <span style={{ color: "var(--text-muted)" }}>({d.percentage}%)</span>
            </span>
          </div>
          <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 8, height: 8, overflow: "hidden" }}>
            <div style={{
              width: `${(d.total / max) * 100}%`,
              height: "100%",
              background: getCategoryColor(d.category, customColors),
              borderRadius: 8,
              transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)",
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DayChart({ data }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div style={{
      display: "flex", alignItems: "flex-end", gap: 6, height: 160, padding: "0 4px", marginTop: 10
    }}>
      {data.map((d) => (
        <div
          key={d.date}
          title={`${d.date}: ${fmtBRL(d.total)}`}
          style={{
            flex: 1,
            height: `${Math.max((d.total / max) * 100, 2)}%`,
            background: "linear-gradient(to top, rgba(59,130,246,0.8), var(--neon-primary))",
            borderRadius: "4px 4px 0 0",
            cursor: "pointer",
            transition: "all 0.2s ease",
            minWidth: 4,
          }}
          onMouseEnter={(e) => { e.target.style.opacity = 0.8; e.target.style.filter = "brightness(1.5)"; }}
          onMouseLeave={(e) => { e.target.style.opacity = 1; e.target.style.filter = "brightness(1)"; }}
        />
      ))}
    </div>
  );
}

function EditableCategory({ tx, allCategories, customColors, onUpdateCategory, onUpdateColor }) {
  const [editing, setEditing] = useState(false);
  const [isCreatingMode, setIsCreatingMode] = useState(false);
  const [newCatValue, setNewCatValue] = useState("");

  const handleSelect = (cat) => {
    setEditing(false);
    setIsCreatingMode(false);
    setNewCatValue("");
    if (cat && cat !== tx.category) {
      onUpdateCategory(cat);
    }
  };

  const handleCreateSubmit = () => {
    if (newCatValue.trim()) {
      handleSelect(newCatValue.trim());
    } else {
      setIsCreatingMode(false);
    }
  };

  if (editing) {
    return (
      <div style={{ 
        display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", 
        background: "rgba(5, 5, 10, 0.95)", border: "1px solid var(--glass-border)", 
        borderRadius: 12, padding: "10px", minWidth: 220,
        boxShadow: "var(--shadow-premium)", backdropFilter: "blur(20px)"
      }}>
        {allCategories.map(c => {
          const bg = getCategoryBgColor(c, customColors);
          const fg = getCategoryColor(c, customColors);
          return (
            <span key={c} onClick={() => handleSelect(c)} style={{
              background: bg, color: fg, padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
              border: c === tx.category ? `1px solid ${fg}` : "1px solid transparent",
              transition: "all 0.2s ease"
            }}
            onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.5)"; e.currentTarget.style.transform = "scale(1.05)"; }}
            onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; e.currentTarget.style.transform = "scale(1)"; }}
            >
              {c}
            </span>
          )
        })}
        {isCreatingMode ? (
          <input 
            autoFocus
            type="text"
            placeholder="Nome da categoria..."
            value={newCatValue}
            onChange={(e) => setNewCatValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateSubmit();
              if (e.key === 'Escape') setIsCreatingMode(false);
            }}
            onBlur={handleCreateSubmit}
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(110, 231, 183, 0.6)",
              boxShadow: "0 0 10px rgba(110, 231, 183, 0.15)",
              color: "#F1F5F9", padding: "6px 14px", borderRadius: 20, fontSize: 11, width: 140, outline: "none", transition: "all 0.3s ease"
            }}
          />
        ) : (
          <span 
            onClick={() => setIsCreatingMode(true)} 
            style={{
              background: "rgba(255, 255, 255, 0.03)", border: "1px dashed rgba(255, 255, 255, 0.2)",
              color: "#F1F5F9", padding: "4px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer", transition: "all 0.2s ease"
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)"; }}
          >
            ➕ Nova...
          </span>
        )}
        <div style={{ width: 1, height: 16, background: "var(--glass-border)", margin: "0 4px" }} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <span style={{ color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Cor</span>
          <input 
            type="color" 
            title="Mudar cor desta categoria"
            value={getCategoryColor(tx.category, customColors).substring(0, 7)}
            onChange={e => onUpdateColor(tx.category, e.target.value)}
            style={{ width: "24px", height: "24px", padding: 0, border: "2px solid var(--glass-border)", borderRadius: "50%", background: "transparent", cursor: "pointer" }}
          />
        </label>
        <button onClick={() => { setEditing(false); setIsCreatingMode(false); }} title="Cancelar" style={{ background: "transparent", border: "none", color: "var(--neon-negative)", cursor: "pointer", fontSize: 14, marginLeft: "auto", fontWeight: "bold" }}>✕</button>
      </div>
    );
  }

  const bgColor = getCategoryBgColor(tx.category, customColors);
  const color = getCategoryColor(tx.category, customColors);
  return (
    <span 
      onClick={() => setEditing(true)}
      title="Clique para editar"
      style={{
        background: bgColor, color: color,
        padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600,
        cursor: "pointer", display: "inline-block", transition: "all 0.2s",
        border: "1px solid transparent"
      }}
      onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.5)"; e.currentTarget.style.borderColor = color; }}
      onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; e.currentTarget.style.borderColor = "transparent"; }}
    >
      {tx.category}
    </span>
  );
}

function TransactionTable({ transactions, customColors, onUpdateTransaction, onUpdateColor }) {
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("Todas");

  const categories = ["Todas", ...new Set(transactions.map((t) => t.category))];
  const filteredAndSorted = transactions
    .filter((t) => {
      const matchSearch = t.description.toLowerCase().includes(search.toLowerCase());
      const matchCat = filterCat === "Todas" || t.category === filterCat;
      return matchSearch && matchCat;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div>
      <datalist id="cat-suggestions">
        {categories.filter(c => c !== "Todas").map((c) => <option key={c} value={c} />)}
      </datalist>
      <div className="table-header-flex">
        <input
          className="search-input"
          placeholder="Buscar descrição da compra..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <select
          className="search-input"
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          style={{ flex: "none", width: "auto" }}
        >
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div>
        <table className="table-container">
          <thead>
            <tr>
              {["Data", "Descrição da Transação", "Categoria", "Valor"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.map((tx, i) => (
              <tr key={i}>
                <td data-label="Data" className="text-mono" style={{ color: "var(--text-muted)", fontSize: 12 }}>{fmtDate(tx.date)}</td>
                <td data-label="Descrição" className="td-desc" style={{ color: "var(--text-primary)", fontWeight: 500 }}>{tx.description}</td>
                <td data-label="Categoria">
                  <EditableCategory 
                    tx={tx} 
                    allCategories={categories.filter(c => c !== "Todas")}
                    customColors={customColors}
                    onUpdateCategory={(newCat) => onUpdateTransaction(tx.id, newCat)} 
                    onUpdateColor={onUpdateColor}
                  />
                </td>
                <td data-label="Valor" className="text-mono" style={{
                  color: tx.amount < 0 ? "var(--neon-negative)" : "var(--neon-positive)",
                  fontWeight: 700, fontSize: 13
                }}>
                  {tx.amount < 0 ? "−" : "+"}{fmtBRL(Math.abs(tx.amount))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredAndSorted.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
            <span style={{ fontSize: 24, display: "block", marginBottom: 8 }}>🔍</span>
            Nenhuma transação encontrada correspondente aos filtros.
          </div>
        )}
      </div>
    </div>
  );
}

// --- Motor de Relatórios JS ---
const generateDynamicReport = (transactions, filters = []) => {
  const isIgnored = (tx) => tx.category === "Pagamento de Fatura / Interno";
  
  const all_valid_txs = transactions.filter((tx) => !isIgnored(tx));
  const raw_total_spent = Math.abs(all_valid_txs.filter((tx) => tx.amount < 0).reduce((acc, tx) => acc + tx.amount, 0));
  const raw_total_received = all_valid_txs.filter((tx) => tx.amount > 0).reduce((acc, tx) => acc + tx.amount, 0);

  const valid_txs = all_valid_txs.filter(tx => filters.length === 0 || filters.includes(tx.category));
  const debits = valid_txs.filter((tx) => tx.amount < 0);
  const credits = valid_txs.filter((tx) => tx.amount > 0);

  const total_spent = Math.abs(debits.reduce((acc, tx) => acc + tx.amount, 0));
  const total_received = credits.reduce((acc, tx) => acc + tx.amount, 0);

  const dates = valid_txs.map((tx) => tx.date).filter(Boolean).sort();
  const period = dates.length ? { start: dates[0], end: dates[dates.length - 1] } : { start: null, end: null };

  const totalsCat = {};
  const countsCat = {};
  debits.forEach((tx) => {
    const cat = tx.category || "Outros";
    totalsCat[cat] = (totalsCat[cat] || 0) + Math.abs(tx.amount);
    countsCat[cat] = (countsCat[cat] || 0) + 1;
  });

  const totalGeral = Object.values(totalsCat).reduce((a, b) => a + b, 0) || 1;
  const by_category = Object.keys(totalsCat)
    .map((cat) => ({
      category: cat,
      total: parseFloat(totalsCat[cat].toFixed(2)),
      count: countsCat[cat],
      percentage: parseFloat(((totalsCat[cat] / totalGeral) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.total - a.total);

  const totalsDay = {};
  debits.forEach((tx) => {
    if (tx.date) totalsDay[tx.date] = (totalsDay[tx.date] || 0) + Math.abs(tx.amount);
  });
  const by_day = Object.keys(totalsDay)
    .map((date) => ({ date, total: parseFloat(totalsDay[date].toFixed(2)) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const top_transactions = [...debits]
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 5)
    .map((tx) => ({ ...tx, amount: Math.abs(tx.amount) }));

  return {
    summary: { 
      total_transactions: valid_txs.length, 
      total_spent, 
      total_received, 
      balance: total_received - total_spent, 
      period,
      raw_total_spent,
      raw_total_received
    },
    by_category,
    by_day,
    top_transactions,
  };
};

// --- App Principal ---
export default function App() {
  const [state, setState] = useState("idle"); 
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  
  const [customColors, setCustomColors] = useState({});
  const [filters, setFilters] = useState([]);

  const handleUpdateTransaction = (txId, newCategory) => {
    setData((prev) => {
      if (!prev) return prev;
      const newTxs = prev.transactions.map((t) => 
        t.id === txId ? { ...t, category: newCategory } : t
      );
      return { ...prev, transactions: newTxs };
    });
  };

  const handleUpdateColor = (category, hexColor) => {
    setCustomColors(prev => ({ ...prev, [category]: hexColor }));
  };

  const handleUpload = async (file) => {
    setState("loading");
    setError("");
    setFilters([]); 
    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Erro desconhecido no processador de IA.");
      }

      const json = await res.json();
      json.transactions = json.transactions.map((tx, idx) => ({ ...tx, id: idx }));
      setData(json);
      setState("done");
    } catch (e) {
      setError(e.message);
      setState("error");
    }
  };

  const report = useMemo(() => {
    return data ? generateDynamicReport(data.transactions, filters) : null;
  }, [data?.transactions, filters]);

  const allAvailableFilters = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.transactions.map(t => t.category))].filter(c => c !== "Pagamento de Fatura / Interno");
  }, [data?.transactions]);

  return (
    <div className="app-container">
      {/* Header VIP */}
      <div style={{ marginBottom: 40, textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 32 }}>💠</span>
          <h1 className="h-title">Finance<span style={{color: "var(--neon-primary)"}}>Auto</span></h1>
          <span style={{
            background: "rgba(110,231,183,0.1)", color: "var(--neon-primary)",
            fontSize: 9, padding: "4px 8px", borderRadius: 8, fontWeight: 800, letterSpacing: 1
          }}>PRO</span>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          Inteligência Financeira & Conciliação Automática
        </p>
      </div>

      {/* Upload Zone */}
      {state !== "done" && (
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <UploadZone onUpload={handleUpload} loading={state === "loading"} />
          {state === "loading" && (
            <div style={{ textAlign: "center", marginTop: 24 }}>
              <div style={{ display: "inline-block", width: 20, height: 20, border: "2px solid var(--glass-border)", borderTopColor: "var(--neon-primary)", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: 8 }}></div>
              <p style={{ color: "var(--text-accent)", fontSize: 13 }}>Decodificando fatura via Motor Neural...</p>
              <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
            </div>
          )}
          {state === "error" && (
            <div className="glass-panel" style={{ marginTop: 24, background: "rgba(255,71,87,0.05)", borderColor: "rgba(255,71,87,0.3)", textAlign: "center" }}>
              <span style={{ fontSize: 24, display: "block", marginBottom: 8 }}>⚠️</span>
              <p style={{ color: "var(--neon-negative)", fontSize: 14, fontWeight: 500 }}>Falha na Análise</p>
              <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4 }}>{error}</p>
            </div>
          )}
        </div>
      )}

      {/* Interface Principal (Dashboard) */}
      {state === "done" && report && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
            <span style={{ color: "var(--text-muted)", fontSize: 12, background: "var(--glass-bg)", padding: "6px 12px", borderRadius: 20, border: "1px solid var(--glass-border)" }}>
              <span className="text-positive">✓</span> {report.summary.total_transactions} entradas mapeadas ({fmtDate(report.summary.period.start)} a {fmtDate(report.summary.period.end)})
            </span>
            <button
              onClick={() => { setState("idle"); setData(null); }}
              className="tag-btn"
            >
              ⟲ Processar Novo Arquivo
            </button>
          </div>

          {/* Filtros Inteligentes (Somas Condicionais) */}
          <div className="glass-panel" style={{ marginBottom: 32, padding: "20px 24px" }}>
            <span className="h-section">Seletor de Contexto (Agrupar Faturas)</span>
            <div className="filter-bar">
              {allAvailableFilters.map(cat => {
                const active = filters.includes(cat);
                const color = getCategoryColor(cat, customColors);
                const bgColor = getCategoryBgColor(cat, customColors);
                return (
                  <button
                    key={cat}
                    onClick={() => setFilters(p => active ? p.filter(c => c !== cat) : [...p, cat])}
                    className="tag-btn"
                    style={{
                      background: active ? bgColor : "var(--glass-bg)",
                      borderColor: active ? color : "var(--glass-border)",
                      color: active ? color : "var(--text-accent)",
                    }}
                  >
                    {active && <span style={{ marginRight: 4 }}>✓</span>}{cat}
                  </button>
                );
              })}
              {filters.length > 0 && (
                <button onClick={() => setFilters([])} className="tag-btn" style={{ borderColor: "var(--neon-negative)", color: "var(--neon-negative)" }}>
                  ✕ Limpar
                </button>
              )}
            </div>
          </div>

          <div className="summary-cards-grid">
            <SummaryCard 
              label={filters.length > 0 ? "Volume da Seleção" : "Custo Total"} 
              value={fmtBRL(report.summary.total_spent)} 
              accent="var(--neon-negative)" 
              sub={filters.length > 0 ? (
                <span>Fatura cheia: <span style={{color: "var(--text-primary)"}}>{fmtBRL(report.summary.raw_total_spent)}</span><br/>Diferença: <span style={{color: "var(--neon-primary)"}}>{fmtBRL(report.summary.raw_total_spent - report.summary.total_spent)}</span></span>
              ) : null}
            />
            {!filters.length && <SummaryCard label="Capital Recebido" value={fmtBRL(report.summary.total_received)} accent="var(--neon-positive)" />}
            {!filters.length && <SummaryCard label="Balanço Líquido" value={fmtBRL(report.summary.balance)} accent={report.summary.balance >= 0 ? "var(--neon-positive)" : "var(--neon-negative)"} />}
          </div>

          <div className="charts-grid">
            <div className="glass-panel">
              <span className="h-section">Distribuição de Capital</span>
              <CategoryBar data={report.by_category.slice(0, 6)} customColors={customColors} />
            </div>

            <div className="glass-panel">
              <span className="h-section">Intensidade de Gastos (Diário)</span>
              <DayChart data={report.by_day} />
            </div>
          </div>

          <div className="glass-panel" style={{ marginBottom: 32 }}>
            <span className="h-section">Top 5 Maiores Saídas</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {report.top_transactions.map((tx, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: "1px solid var(--glass-border)" }}>
                  <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    <span style={{ color: "var(--glass-border)", fontSize: 24, fontWeight: 700, width: 24, textAlign: "center" }}>{i + 1}</span>
                    <div>
                      <p style={{ color: "var(--text-primary)", fontSize: 14, margin: "0 0 4px 0", fontWeight: 500 }}>{tx.description}</p>
                      <span style={{ color: getCategoryColor(tx.category, customColors), fontSize: 11, background: getCategoryBgColor(tx.category, customColors), padding: "2px 8px", borderRadius: 12 }}>{tx.category}</span>
                      <span className="text-mono" style={{ color: "var(--text-muted)", fontSize: 11, marginLeft: 8 }}>{fmtDate(tx.date)}</span>
                    </div>
                  </div>
                  <span className="text-mono" style={{ color: "var(--neon-negative)", fontSize: 15, fontWeight: 600 }}>
                    {fmtBRL(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel">
            <span className="h-section">Livro Razão (Todas as Entradas)</span>
            <TransactionTable 
              transactions={data.transactions} 
              customColors={customColors}
              onUpdateTransaction={handleUpdateTransaction}
              onUpdateColor={handleUpdateColor}
            />
          </div>
        </>
      )}
    </div>
  );
}
