"""
reporter.py — Gerador de Relatórios e Insights Financeiros
Transforma a lista de transações categorizadas em dados estruturados para o dashboard.
"""

from collections import defaultdict
from datetime import datetime


def generate_report(transactions: list[dict]) -> dict:
    """
    Gera o relatório completo de insights financeiros.

    Retorna:
      - summary: totais gerais
      - by_category: gastos agrupados por categoria
      - by_day: gastos agrupados por data
      - by_month: gastos agrupados por mês
      - top_transactions: as 5 maiores transações individuais
    """
    # Ignora itens de pagamento de fatura ou transferências internas do cálculo de gastos
    valid_txs = [tx for tx in transactions if tx.get("category") != "Pagamento de Fatura / Interno"]

    debits = [tx for tx in valid_txs if tx["amount"] < 0]
    credits = [tx for tx in valid_txs if tx["amount"] > 0]

    total_spent = abs(sum(tx["amount"] for tx in debits))
    total_received = sum(tx["amount"] for tx in credits)

    return {
        "summary": {
            "total_transactions": len(transactions),
            "total_spent": round(total_spent, 2),
            "total_received": round(total_received, 2),
            "balance": round(total_received - total_spent, 2),
            "period": _get_period(transactions),
        },
        "by_category": _group_by_category(debits),
        "by_day": _group_by_day(debits),
        "by_month": _group_by_month(debits),
        "top_transactions": _top_transactions(debits, n=5),
    }


def _group_by_category(transactions: list[dict]) -> list[dict]:
    """Agrupa gastos por categoria, ordenado do maior para o menor."""
    totals: dict[str, float] = defaultdict(float)
    counts: dict[str, int] = defaultdict(int)

    for tx in transactions:
        cat = tx.get("category", "Outros")
        totals[cat] += abs(tx["amount"])
        counts[cat] += 1

    total_geral = sum(totals.values()) or 1  # Evita divisão por zero

    return sorted(
        [
            {
                "category": cat,
                "total": round(totals[cat], 2),
                "count": counts[cat],
                "percentage": round((totals[cat] / total_geral) * 100, 1),
            }
            for cat in totals
        ],
        key=lambda x: x["total"],
        reverse=True,
    )


def _group_by_day(transactions: list[dict]) -> list[dict]:
    """Agrupa gastos por dia para o gráfico de linha temporal."""
    totals: dict[str, float] = defaultdict(float)

    for tx in transactions:
        totals[tx["date"]] += abs(tx["amount"])

    return sorted(
        [{"date": date, "total": round(total, 2)} for date, total in totals.items()],
        key=lambda x: x["date"],
    )


def _group_by_month(transactions: list[dict]) -> list[dict]:
    """Agrupa gastos por mês (YYYY-MM)."""
    totals: dict[str, float] = defaultdict(float)

    for tx in transactions:
        month = tx["date"][:7]  # YYYY-MM
        totals[month] += abs(tx["amount"])

    return sorted(
        [{"month": month, "total": round(total, 2)} for month, total in totals.items()],
        key=lambda x: x["month"],
    )


def _top_transactions(transactions: list[dict], n: int = 5) -> list[dict]:
    """Retorna as N maiores transações individuais (débitos)."""
    sorted_txs = sorted(transactions, key=lambda x: abs(x["amount"]), reverse=True)
    return [
        {
            "date": tx["date"],
            "description": tx["description"],
            "amount": abs(tx["amount"]),
            "category": tx.get("category", "Outros"),
        }
        for tx in sorted_txs[:n]
    ]


def _get_period(transactions: list[dict]) -> dict:
    """Calcula o período coberto pelas transações."""
    if not transactions:
        return {"start": None, "end": None}

    dates = [tx["date"] for tx in transactions if tx.get("date")]
    if not dates:
        return {"start": None, "end": None}

    return {"start": min(dates), "end": max(dates)}
