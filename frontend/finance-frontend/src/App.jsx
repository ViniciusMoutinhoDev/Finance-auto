import { useState, useCallback, useMemo, useEffect } from "react";
import "./index.css"; 

const API_BASE = "http://localhost:8000";

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

const fmtBRL = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

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
  for (let i = 0; i < cat.length; i++) hash = cat.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 70%, 65%)`;
};

const getCategoryBgColor = (cat, customColors = {}) => {
  const fg = getCategoryColor(cat, customColors);
  if (fg.startsWith("hsl")) return fg.replace("hsl", "hsla").replace(")", ", 0.10)");
  return fg + "1A";
};

// --- AUTH ---
function AuthScreen({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      if (isLogin) {
        const form = new URLSearchParams();
        form.append("username", email);
        form.append("password", password);
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: form.toString(),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Credenciais inválidas");
        const data = await res.json();
        onAuthSuccess(data.access_token);
      } else {
        const res = await fetch(`${API_BASE}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Erro no cadastro");
        onAuthSuccess(data.access_token);
      }
    } catch (err) {
      if (err.name === "AbortError") {
        setError("Servidor não respondeu. Verifique se o backend está rodando.");
      } else {
        setError(err.message);
      }
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "var(--bg-dark)" }}>
      <div className="glass-panel" style={{ maxWidth: 400, width: "100%", padding: 40, textAlign: "center" }}>
        <h1 className="h-title" style={{ marginBottom: 8 }}>Finance<span style={{ color: "var(--neon-primary)" }}>Auto</span></h1>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 32 }}>O seu cofre digital de conciliação.</p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <input type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} className="search-input" required />
          <input type="password" placeholder="Senha Forte" value={password} onChange={e => setPassword(e.target.value)} className="search-input" required minLength={4} />
          {error && <p style={{ color: "var(--neon-negative)", fontSize: 12 }}>{error}</p>}
          <button type="submit" style={{ background: "var(--neon-primary)", color: "#05050A", border: "none", padding: "12px", borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: "pointer", marginTop: 8 }} disabled={loading}>
            {loading ? "Autenticando..." : (isLogin ? "Acessar Cofre" : "Criar Conta Segura")}
          </button>
        </form>
        <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 24, cursor: "pointer" }} onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? "Primeira vez? Crie sua conta grátis" : "Já possui conta? Faça login"}
        </p>
      </div>
    </div>
  );
}

// --- COMPONENTES ---
function UploadZone({ onUpload, loading }) {
  const [dragging, setDragging] = useState(false);
  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type === "application/pdf") onUpload(file);
  }, [onUpload]);
  const handleChange = (e) => { const file = e.target.files[0]; if (file) onUpload(file); };
  return (
    <div className={`glass-panel interactive ${dragging ? 'dragging' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      style={{ textAlign: "center", padding: "64px 32px", borderStyle: "dashed" }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>📄</div>
      <p style={{ color: "var(--text-primary)", marginBottom: 8, fontSize: 18, fontWeight: 600 }}>Arraste sua fatura ou extrato aqui</p>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 24 }}>Sincronização Nuvem Encriptada • Sem duplicatas</p>
      <label style={{ background: "linear-gradient(135deg, var(--neon-primary), #3B82F6)", color: "#05050A", padding: "12px 32px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 14, display: "inline-block", boxShadow: "0 4px 15px rgba(110, 231, 183, 0.4)" }}>
        {loading ? "Decodificando Inteligência Neural..." : "Selecionar Documento"}
        <input type="file" accept=".pdf" onChange={handleChange} style={{ display: "none" }} disabled={loading} />
      </label>
    </div>
  );
}

function SummaryCard({ label, value, sub, accent }) {
  return (
    <div className="glass-panel summary-card" style={{ '--card-accent': accent }}>
      <span className="h-section" style={{ marginBottom: 8 }}>{label}</span>
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
            <div style={{ width: `${(d.total / max) * 100}%`, height: "100%", background: getCategoryColor(d.category, customColors), borderRadius: 8, transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)" }} />
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
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 160, padding: "0 4px", marginTop: 10 }}>
      {data.map((d) => (
        <div key={d.date} title={`${d.date}: ${fmtBRL(d.total)}`}
          style={{ flex: 1, height: `${Math.max((d.total / max) * 100, 2)}%`, background: "linear-gradient(to top, rgba(59,130,246,0.8), var(--neon-primary))", borderRadius: "4px 4px 0 0", cursor: "pointer", transition: "all 0.2s ease", minWidth: 4 }}
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
    setEditing(false); setIsCreatingMode(false); setNewCatValue("");
    if (cat && cat !== tx.category) onUpdateCategory(tx.id, cat);
  };
  const handleCreateSubmit = () => {
    if (newCatValue.trim()) handleSelect(newCatValue.trim());
    else setIsCreatingMode(false);
  };

  if (editing) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", background: "rgba(5, 5, 10, 0.95)", border: "1px solid var(--glass-border)", borderRadius: 12, padding: "10px", minWidth: 220, boxShadow: "var(--shadow-premium)", backdropFilter: "blur(20px)" }}>
        {allCategories.map(c => {
          const bg = getCategoryBgColor(c, customColors);
          const fg = getCategoryColor(c, customColors);
          return (
            <span key={c} onClick={() => handleSelect(c)}
              style={{ background: bg, color: fg, padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer", border: c === tx.category ? `1px solid ${fg}` : "1px solid transparent", transition: "all 0.2s ease" }}
              onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.5)"; e.currentTarget.style.transform = "scale(1.05)"; }}
              onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; e.currentTarget.style.transform = "scale(1)"; }}
            >{c}</span>
          );
        })}
        {isCreatingMode ? (
          <input autoFocus type="text" placeholder="Nome da categoria..." value={newCatValue}
            onChange={(e) => setNewCatValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateSubmit(); if (e.key === 'Escape') setIsCreatingMode(false); }}
            onBlur={handleCreateSubmit}
            style={{ background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(110, 231, 183, 0.6)", color: "#F1F5F9", padding: "6px 14px", borderRadius: 20, fontSize: 11, width: 140, outline: "none" }}
          />
        ) : (
          <span onClick={() => setIsCreatingMode(true)} style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px dashed rgba(255, 255, 255, 0.2)", color: "#F1F5F9", padding: "4px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer" }}>➕ Nova...</span>
        )}
        <div style={{ width: 1, height: 16, background: "var(--glass-border)", margin: "0 4px" }} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <span style={{ color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase" }}>Cor</span>
          <input type="color" value={getCategoryColor(tx.category, customColors).substring(0, 7)} onChange={e => onUpdateColor(tx.category, e.target.value)} style={{ width: 24, height: 24, padding: 0, border: "2px solid var(--glass-border)", borderRadius: "50%", background: "transparent", cursor: "pointer" }} />
        </label>
        <button onClick={() => { setEditing(false); setIsCreatingMode(false); }} style={{ background: "transparent", border: "none", color: "var(--neon-negative)", cursor: "pointer", fontSize: 14, marginLeft: "auto", fontWeight: "bold" }}>✕</button>
      </div>
    );
  }

  return (
    <span onClick={() => setEditing(true)} title="Clique para editar"
      style={{ background: getCategoryBgColor(tx.category, customColors), color: getCategoryColor(tx.category, customColors), padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "1px solid transparent", display: "inline-block" }}>
      {tx.category}
    </span>
  );
}

function TransactionTable({ transactions, customColors, onUpdateTransaction, onUpdateColor }) {
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("Todas");
  const categories = ["Todas", ...new Set(transactions.map((t) => t.category))];
  const filteredAndSorted = transactions
    .filter((t) => (search === "" || t.description.toLowerCase().includes(search.toLowerCase())) && (filterCat === "Todas" || t.category === filterCat))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  return (
    <div>
      <div className="table-header-flex">
        <input className="search-input" placeholder="Buscar compra..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <select className="search-input" value={filterCat} onChange={(e) => setFilterCat(e.target.value)} style={{ flex: "none", width: "auto" }}>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <table className="table-container">
        <thead><tr>{["Data", "Descrição da Transação", "Categoria", "Valor"].map(h => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {filteredAndSorted.map((tx) => (
            <tr key={tx.id}>
              <td data-label="Data" className="text-mono" style={{ color: "var(--text-muted)", fontSize: 12 }}>{fmtDate(tx.date)}</td>
              <td data-label="Descrição" className="td-desc" style={{ color: "var(--text-primary)", fontWeight: 500 }}>{tx.description}</td>
              <td data-label="Categoria">
                <EditableCategory tx={tx} allCategories={categories.filter(c => c !== "Todas")} customColors={customColors} onUpdateCategory={onUpdateTransaction} onUpdateColor={onUpdateColor} />
              </td>
              <td data-label="Valor" className="text-mono" style={{ color: tx.amount < 0 ? "var(--neon-negative)" : "var(--neon-positive)", fontWeight: 700, fontSize: 13 }}>
                {tx.amount < 0 ? "−" : "+"}{fmtBRL(Math.abs(tx.amount))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filteredAndSorted.length === 0 && <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>Nenhuma transação encontrada.</div>}
    </div>
  );
}

// --- LÓGICA ---
const generateDynamicReport = (transactions, filters = []) => {
  const isIgnored = (tx) => tx.category === "Pagamento de Fatura / Interno";
  const all_valid_txs = transactions.filter((tx) => !isIgnored(tx));
  const raw_total_spent = Math.abs(all_valid_txs.filter(t => t.amount < 0).reduce((acc, t) => acc + t.amount, 0));
  const raw_total_received = all_valid_txs.filter(t => t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
  const valid_txs = all_valid_txs.filter(tx => filters.length === 0 || filters.includes(tx.category));
  const debits = valid_txs.filter(t => t.amount < 0);
  const credits = valid_txs.filter(t => t.amount > 0);
  const total_spent = Math.abs(debits.reduce((acc, t) => acc + t.amount, 0));
  const total_received = credits.reduce((acc, t) => acc + t.amount, 0);
  const dates = valid_txs.map(t => t.date).filter(Boolean).sort();
  const period = dates.length ? { start: dates[0], end: dates[dates.length - 1] } : { start: null, end: null };
  const totalsCat = {};
  debits.forEach(t => { totalsCat[t.category || "Outros"] = (totalsCat[t.category || "Outros"] || 0) + Math.abs(t.amount); });
  const totalGeral = Object.values(totalsCat).reduce((a, b) => a + b, 0) || 1;
  const by_category = Object.keys(totalsCat).map(c => ({ category: c, total: parseFloat(totalsCat[c].toFixed(2)), percentage: parseFloat(((totalsCat[c] / totalGeral) * 100).toFixed(1)) })).sort((a, b) => b.total - a.total);
  const totalsDay = {};
  debits.forEach(t => { if (t.date) totalsDay[t.date] = (totalsDay[t.date] || 0) + Math.abs(t.amount); });
  const by_day = Object.keys(totalsDay).map(d => ({ date: d, total: parseFloat(totalsDay[d].toFixed(2)) })).sort((a, b) => a.date.localeCompare(b.date));
  const top_transactions = [...debits].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 5).map(t => ({ ...t, amount: Math.abs(t.amount) }));
  return { summary: { total_transactions: valid_txs.length, total_spent, total_received, balance: total_received - total_spent, period, raw_total_spent, raw_total_received }, by_category, by_day, top_transactions };
};

const mapMonthName = (YYYY_MM) => {
  if (YYYY_MM === "ALL") return "Todas as Datas";
  const [y, m] = YYYY_MM.split("-");
  const date = new Date(y, parseInt(m) - 1, 1);
  return date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
};

// --- APP PRINCIPAL ---
export default function App() {
  const [token, setToken] = useState(localStorage.getItem("finance_token"));
  const [allData, setAllData] = useState([]);
  const [customColors, setCustomColors] = useState({});
  const [filters, setFilters] = useState([]);
  const [selectedYearMonth, setSelectedYearMonth] = useState("ALL");
  const [appState, setAppState] = useState("idle");

  const fetchMyData = useCallback(async () => {
    if (!token) return;
    try {
      const [txRes, colorsRes] = await Promise.all([
        fetch(`${API_BASE}/api/transactions`, { headers: { "Authorization": `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/colors`, { headers: { "Authorization": `Bearer ${token}` } })
      ]);
      if (txRes.status === 401) { logout(); return; }
      const txData = await txRes.json();
      const colData = await colorsRes.json();
      setAllData(txData.transactions || []);
      setCustomColors(colData.customColors || {});
    } catch (e) { console.error(e); }
  }, [token]);

  useEffect(() => { fetchMyData(); }, [fetchMyData]);

  const logout = () => {
    localStorage.removeItem("finance_token");
    setToken(null);
    setAllData([]);
  };

  const handleAuthSuccess = (newToken) => {
    localStorage.setItem("finance_token", newToken);
    setToken(newToken);
  };

  const handleUpdateTransaction = async (txId, newCategory) => {
    setAllData(prev => prev.map(t => t.id === txId ? { ...t, category: newCategory } : t));
    await fetch(`${API_BASE}/api/transactions/${txId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ category: newCategory })
    });
  };

  const handleUpdateColor = async (category, hexColor) => {
    setCustomColors(p => ({ ...p, [category]: hexColor }));
    await fetch(`${API_BASE}/api/colors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ category, hex_color: hexColor })
    });
  };

  const handleUpload = async (file) => {
    setAppState("loading"); setFilters([]);
    try {
      const form = new FormData(); form.append("file", file);
      const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: form, headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) throw new Error("Erro no processador neural");
      await fetchMyData();
      setAppState("idle");
    } catch (e) {
      alert("Falha: " + e.message);
      setAppState("error");
    }
  };

  // TODOS os hooks ANTES do early return
  const timeBuckets = useMemo(() => {
    const buckets = new Set();
    allData.forEach(tx => {
      if (tx.date) {
        const parts = tx.date.split("-");
        if (parts.length >= 2) buckets.add(`${parts[0]}-${parts[1]}`);
      }
    });
    return Array.from(buckets).sort((a, b) => b.localeCompare(a));
  }, [allData]);

  const activeTransactions = useMemo(() => {
    if (selectedYearMonth === "ALL") return allData;
    return allData.filter(t => t.date && t.date.startsWith(selectedYearMonth));
  }, [allData, selectedYearMonth]);

  const report = useMemo(() => {
    return activeTransactions.length > 0 ? generateDynamicReport(activeTransactions, filters) : null;
  }, [activeTransactions, filters]);

  const allAvailableFilters = useMemo(() => {
    return [...new Set(activeTransactions.map(t => t.category))].filter(c => c !== "Pagamento de Fatura / Interno");
  }, [activeTransactions]);

  // Early return DEPOIS de todos os hooks
  if (!token) return <AuthScreen onAuthSuccess={handleAuthSuccess} />;

  return (
    <div className="app-container">
      <div style={{ marginBottom: 40, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 32 }}>💠</span>
            <h1 className="h-title">Finance<span style={{ color: "var(--neon-primary)" }}>Auto</span></h1>
            <span style={{ background: "rgba(110,231,183,0.1)", color: "var(--neon-primary)", fontSize: 9, padding: "4px 8px", borderRadius: 8, fontWeight: 800 }}>PRO</span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Seu cofre digital sincronizado na nuvem</p>
        </div>
        <button onClick={logout} className="tag-btn" style={{ borderColor: "rgba(255,71,87,0.3)", color: "var(--neon-negative)", padding: "8px 16px" }}>🔒 Encerrar Sessão</button>
      </div>

      {timeBuckets.length > 0 && (
        <div style={{ marginBottom: 32, display: "flex", overflowX: "auto", paddingBottom: 8, gap: 8 }}>
          <button onClick={() => setSelectedYearMonth("ALL")} className="tag-btn"
            style={{ background: selectedYearMonth === "ALL" ? "var(--neon-primary)" : "var(--glass-bg)", color: selectedYearMonth === "ALL" ? "#000" : "var(--text-accent)" }}>
            Visão Geral Total
          </button>
          <div style={{ width: 1, background: "var(--glass-border)", margin: "0 8px" }} />
          {timeBuckets.map(bucket => (
            <button key={bucket} onClick={() => setSelectedYearMonth(bucket)} className="tag-btn"
              style={{ background: selectedYearMonth === bucket ? "rgba(110, 231, 183, 0.15)" : "var(--glass-bg)", borderColor: selectedYearMonth === bucket ? "var(--neon-primary)" : "var(--glass-border)", color: selectedYearMonth === bucket ? "var(--neon-primary)" : "var(--text-accent)", fontWeight: selectedYearMonth === bucket ? 700 : 500, whiteSpace: "nowrap" }}>
              {mapMonthName(bucket)}
            </button>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 40 }}>
        {appState === "loading" ? (
          <div className="glass-panel" style={{ textAlign: "center", padding: 48 }}>
            <div style={{ display: "inline-block", width: 24, height: 24, border: "3px solid var(--glass-border)", borderTopColor: "var(--neon-primary)", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: 16 }}></div>
            <p style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 500 }}>Minerando dados do PDF...</p>
            <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Evitando duplicação de transações via Hashing MD5</p>
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <UploadZone onUpload={handleUpload} loading={appState === "loading"} />
        )}
      </div>

      {activeTransactions.length === 0 && appState !== "loading" && (
        <div className="glass-panel" style={{ textAlign: "center", padding: 60 }}>
          <span style={{ fontSize: 40, display: "block", marginBottom: 12 }}>🧘</span>
          <p style={{ color: "var(--text-accent)" }}>Nenhum gasto registrado neste período.</p>
        </div>
      )}

      {report && activeTransactions.length > 0 && (
        <>
          <div className="glass-panel" style={{ marginBottom: 32, padding: "20px 24px" }}>
            <span className="h-section">Seletor Condicional ({mapMonthName(selectedYearMonth)})</span>
            <div className="filter-bar">
              {allAvailableFilters.map(cat => {
                const active = filters.includes(cat);
                return (
                  <button key={cat} onClick={() => setFilters(p => active ? p.filter(c => c !== cat) : [...p, cat])} className="tag-btn"
                    style={{ background: active ? getCategoryBgColor(cat, customColors) : "var(--glass-bg)", borderColor: active ? getCategoryColor(cat, customColors) : "var(--glass-border)", color: active ? getCategoryColor(cat, customColors) : "var(--text-accent)" }}>
                    {active && <span style={{ marginRight: 4 }}>✓</span>}{cat}
                  </button>
                );
              })}
              {filters.length > 0 && <button onClick={() => setFilters([])} className="tag-btn" style={{ borderColor: "var(--neon-negative)", color: "var(--neon-negative)" }}>✕ Limpar</button>}
            </div>
          </div>

          <div className="summary-cards-grid">
            <SummaryCard label={filters.length > 0 ? "Volume da Seleção" : "Custo Total do Mês"} value={fmtBRL(report.summary.total_spent)} accent="var(--neon-negative)"
              sub={filters.length > 0 ? <span>Fatura original: <span style={{ color: "var(--text-primary)" }}>{fmtBRL(report.summary.raw_total_spent)}</span><br />Restante devedor: <span style={{ color: "var(--neon-primary)" }}>{fmtBRL(report.summary.raw_total_spent - report.summary.total_spent)}</span></span> : null} />
            {!filters.length && <SummaryCard label="Entradas do Mês" value={fmtBRL(report.summary.total_received)} accent="var(--neon-positive)" />}
            {!filters.length && <SummaryCard label="Balanço Líquido (Mês)" value={fmtBRL(report.summary.balance)} accent={report.summary.balance >= 0 ? "var(--neon-positive)" : "var(--neon-negative)"} />}
          </div>

          <div className="charts-grid">
            <div className="glass-panel"><span className="h-section">Distribuição Financeira</span><CategoryBar data={report.by_category.slice(0, 6)} customColors={customColors} /></div>
            <div className="glass-panel"><span className="h-section">Intensidade de Gastos no Tempo</span><DayChart data={report.by_day} /></div>
          </div>

          {report.top_transactions.length > 0 && (
            <div className="glass-panel" style={{ marginBottom: 32 }}>
              <span className="h-section">Top Maiores Saídas deste Mês</span>
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
                    <span className="text-mono" style={{ color: "var(--neon-negative)", fontSize: 15, fontWeight: 600 }}>{fmtBRL(tx.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="glass-panel">
            <span className="h-section">Livro Razão ({mapMonthName(selectedYearMonth)})</span>
            <TransactionTable transactions={activeTransactions} customColors={customColors} onUpdateTransaction={handleUpdateTransaction} onUpdateColor={handleUpdateColor} />
          </div>
        </>
      )}
    </div>
  );
}