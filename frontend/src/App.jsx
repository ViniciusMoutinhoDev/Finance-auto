import { useState, useCallback } from "react";

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
  "Outros": "#CBD5E1",
};

const fmtBRL = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

// --- Sub-componentes ---

function UploadZone({ onUpload, loading }) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file?.type === "application/pdf") onUpload(file);
    },
    [onUpload]
  );

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file) onUpload(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${dragging ? "#6EE7B7" : "#334155"}`,
        borderRadius: 16,
        padding: "48px 32px",
        textAlign: "center",
        cursor: "pointer",
        background: dragging ? "rgba(110,231,183,0.05)" : "rgba(255,255,255,0.02)",
        transition: "all 0.2s ease",
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
      <p style={{ color: "#94A3B8", marginBottom: 8, fontSize: 16 }}>
        Arraste seu extrato bancário aqui
      </p>
      <p style={{ color: "#475569", fontSize: 13, marginBottom: 20 }}>
        Suporta qualquer banco • PDF apenas
      </p>
      <label style={{
        background: "linear-gradient(135deg, #6EE7B7, #3B82F6)",
        color: "#0F172A",
        padding: "10px 28px",
        borderRadius: 8,
        cursor: "pointer",
        fontWeight: 700,
        fontSize: 14,
        display: "inline-block",
      }}>
        {loading ? "Processando..." : "Selecionar PDF"}
        <input type="file" accept=".pdf" onChange={handleChange} style={{ display: "none" }} disabled={loading} />
      </label>
    </div>
  );
}

function SummaryCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: "#1E293B",
      borderRadius: 12,
      padding: "20px 24px",
      borderLeft: `3px solid ${accent}`,
      flex: 1,
      minWidth: 160,
    }}>
      <p style={{ color: "#64748B", fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{label}</p>
      <p style={{ color: "#F1F5F9", fontSize: 22, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{value}</p>
      {sub && <p style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

function CategoryBar({ data }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.map((d) => (
        <div key={d.category}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ color: "#CBD5E1", fontSize: 13 }}>{d.category}</span>
            <span style={{ color: "#94A3B8", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>
              {fmtBRL(d.total)} <span style={{ color: "#475569" }}>({d.percentage}%)</span>
            </span>
          </div>
          <div style={{ background: "#0F172A", borderRadius: 4, height: 6, overflow: "hidden" }}>
            <div style={{
              width: `${(d.total / max) * 100}%`,
              height: "100%",
              background: CATEGORY_COLORS[d.category] || "#6EE7B7",
              borderRadius: 4,
              transition: "width 0.6s ease",
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
      display: "flex",
      alignItems: "flex-end",
      gap: 4,
      height: 120,
      padding: "0 4px",
    }}>
      {data.map((d) => (
        <div
          key={d.date}
          title={`${d.date}: ${fmtBRL(d.total)}`}
          style={{
            flex: 1,
            height: `${Math.max((d.total / max) * 100, 4)}%`,
            background: "linear-gradient(to top, #3B82F6, #6EE7B7)",
            borderRadius: "3px 3px 0 0",
            cursor: "pointer",
            transition: "opacity 0.2s",
            minWidth: 4,
          }}
          onMouseEnter={(e) => (e.target.style.opacity = 0.7)}
          onMouseLeave={(e) => (e.target.style.opacity = 1)}
        />
      ))}
    </div>
  );
}

function TransactionTable({ transactions }) {
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("Todas");

  const categories = ["Todas", ...new Set(transactions.map((t) => t.category))];
  const filtered = transactions.filter((t) => {
    const matchSearch = t.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "Todas" || t.category === filterCat;
    return matchSearch && matchCat;
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          placeholder="Buscar descrição..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            background: "#0F172A", border: "1px solid #334155", borderRadius: 8,
            color: "#F1F5F9", padding: "8px 14px", fontSize: 13, flex: 1, minWidth: 180,
          }}
        />
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          style={{
            background: "#0F172A", border: "1px solid #334155", borderRadius: 8,
            color: "#94A3B8", padding: "8px 14px", fontSize: 13,
          }}
        >
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1E293B" }}>
              {["Data", "Descrição", "Categoria", "Valor"].map((h) => (
                <th key={h} style={{
                  color: "#64748B", textAlign: "left", padding: "8px 12px",
                  fontSize: 11, textTransform: "uppercase", letterSpacing: 1,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((tx, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #0F172A" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#1E293B")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <td style={{ padding: "10px 12px", color: "#64748B", fontFamily: "'DM Mono', monospace" }}>{tx.date}</td>
                <td style={{ padding: "10px 12px", color: "#CBD5E1", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.description}</td>
                <td style={{ padding: "10px 12px" }}>
                  <span style={{
                    background: `${CATEGORY_COLORS[tx.category] || "#6EE7B7"}22`,
                    color: CATEGORY_COLORS[tx.category] || "#6EE7B7",
                    padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                  }}>{tx.category}</span>
                </td>
                <td style={{
                  padding: "10px 12px",
                  color: tx.amount < 0 ? "#F87171" : "#4ADE80",
                  fontFamily: "'DM Mono', monospace",
                  fontWeight: 600,
                  textAlign: "right",
                }}>
                  {tx.amount < 0 ? "−" : "+"}{fmtBRL(Math.abs(tx.amount))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p style={{ textAlign: "center", color: "#475569", padding: 24 }}>Nenhuma transação encontrada</p>
        )}
      </div>
    </div>
  );
}

// --- App principal ---
export default function App() {
  const [state, setState] = useState("idle"); // idle | loading | done | error
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const handleUpload = async (file) => {
    setState("loading");
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Erro no servidor");
      }

      const json = await res.json();
      setData(json);
      setState("done");
    } catch (e) {
      setError(e.message);
      setState("error");
    }
  };

  const handleExport = async () => {
    alert("Para exportar, envie novamente o PDF usando o endpoint /export do backend.");
  };

  const report = data?.report;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0B1120",
      color: "#F1F5F9",
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      padding: "32px 24px",
      maxWidth: 960,
      margin: "0 auto",
    }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <span style={{ fontSize: 28 }}>💸</span>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#F1F5F9", margin: 0 }}>FinanceAuto</h1>
          <span style={{
            background: "rgba(110,231,183,0.1)", color: "#6EE7B7",
            fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 600,
          }}>MVP</span>
        </div>
        <p style={{ color: "#475569", fontSize: 14, margin: 0 }}>
          Upload do extrato → extração automática → insights instantâneos
        </p>
      </div>

      {/* Upload */}
      {state !== "done" && (
        <div style={{ marginBottom: 32 }}>
          <UploadZone onUpload={handleUpload} loading={state === "loading"} />
          {state === "loading" && (
            <p style={{ textAlign: "center", color: "#6EE7B7", marginTop: 16, fontSize: 14 }}>
              ⚙️ Extraindo e categorizando transações...
            </p>
          )}
          {state === "error" && (
            <p style={{ textAlign: "center", color: "#F87171", marginTop: 16, fontSize: 14 }}>
              ❌ {error}
            </p>
          )}
        </div>
      )}

      {/* Dashboard */}
      {state === "done" && report && (
        <>
          {/* Botão reset */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24, alignItems: "center" }}>
            <p style={{ color: "#475569", fontSize: 13 }}>
              {report.summary.total_transactions} transações • {report.summary.period.start} → {report.summary.period.end}
            </p>
            <button
              onClick={() => { setState("idle"); setData(null); }}
              style={{
                background: "transparent", border: "1px solid #334155",
                color: "#94A3B8", padding: "6px 16px", borderRadius: 8,
                cursor: "pointer", fontSize: 13,
              }}
            >
              ← Novo upload
            </button>
          </div>

          {/* Summary cards */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 28 }}>
            <SummaryCard label="Total Gasto" value={fmtBRL(report.summary.total_spent)} accent="#F87171" />
            <SummaryCard label="Total Recebido" value={fmtBRL(report.summary.total_received)} accent="#4ADE80" />
            <SummaryCard label="Saldo" value={fmtBRL(report.summary.balance)}
              accent={report.summary.balance >= 0 ? "#4ADE80" : "#F87171"} />
          </div>

          {/* Charts row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
            {/* Categorias */}
            <div style={{ background: "#1E293B", borderRadius: 12, padding: 24 }}>
              <h3 style={{ color: "#94A3B8", fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: 20, margin: "0 0 16px 0" }}>
                Top Categorias
              </h3>
              <CategoryBar data={report.by_category.slice(0, 6)} />
            </div>

            {/* Gasto por dia */}
            <div style={{ background: "#1E293B", borderRadius: 12, padding: 24 }}>
              <h3 style={{ color: "#94A3B8", fontSize: 12, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 16px 0" }}>
                Gastos por Dia
              </h3>
              <DayChart data={report.by_day} />
              <p style={{ color: "#475569", fontSize: 11, textAlign: "center", marginTop: 8 }}>
                Passe o mouse sobre as barras para ver o valor
              </p>
            </div>
          </div>

          {/* Maiores transações */}
          <div style={{ background: "#1E293B", borderRadius: 12, padding: 24, marginBottom: 28 }}>
            <h3 style={{ color: "#94A3B8", fontSize: 12, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 16px 0" }}>
              Maiores Gastos
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {report.top_transactions.map((tx, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ color: "#334155", fontSize: 18, fontWeight: 700, width: 20 }}>{i + 1}</span>
                    <div>
                      <p style={{ color: "#CBD5E1", fontSize: 13, margin: 0 }}>{tx.description}</p>
                      <p style={{ color: "#475569", fontSize: 11, margin: 0 }}>{tx.category} • {tx.date}</p>
                    </div>
                  </div>
                  <span style={{ color: "#F87171", fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
                    {fmtBRL(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Tabela de transações */}
          <div style={{ background: "#1E293B", borderRadius: 12, padding: 24 }}>
            <h3 style={{ color: "#94A3B8", fontSize: 12, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 16px 0" }}>
              Todas as Transações
            </h3>
            <TransactionTable transactions={data.transactions} />
          </div>
        </>
      )}
    </div>
  );
}
