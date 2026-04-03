"""
categorizer.py — Módulo de Categorização Inteligente
Classifica descrições de transações bancárias usando a API da Anthropic.

Estratégia em duas camadas:
  1. Regras estáticas (rápido, sem custo de API) — cobre ~70% dos casos
  2. IA (Anthropic Claude) para os casos ambíguos restantes
"""

from typing import Optional

# --- Mapeamento estático de palavras-chave para categorias ---
STATIC_RULES: dict[str, list[str]] = {
    "Transporte": [
        "uber", "99", "cabify", "lyft", "metro", "metrô", "onibus", "ônibus",
        "bilhete", "bom", "estacionamento", "shell", "posto", "combustivel",
        "gasolina", "pedagio", "pedágio", "sem parar", "autopass", "move",
    ],
    "Alimentação": [
        "ifood", "rappi", "uber eats", "mcdonalds", "mcdonald", "burger king",
        "subway", "pizzaria", "lanchonete", "restaurante", "padaria", "mercado",
        "supermercado", "hortifruti", "açougue", "atacadão", "carrefour",
        "extra", "pão de açúcar", "sams club", "costco",
    ],
    "Saúde": [
        "farmacia", "farmácia", "drogasil", "ultrafarma", "droga raia",
        "hospital", "clinica", "clínica", "médico", "dentista", "plano de saúde",
        "unimed", "amil", "bradesco saude", "hapvida", "lab", "exame",
    ],
    "Lazer & Entretenimento": [
        "netflix", "spotify", "amazon prime", "disney", "hbo", "globoplay",
        "deezer", "youtube premium", "apple tv", "cinemark", "uci cinema",
        "teatro", "show", "ingresso", "steam", "playstation", "xbox",
    ],
    "Educação": [
        "udemy", "coursera", "alura", "fiap", "faculdade", "universidade",
        "livros", "amazon kindle", "material escolar", "curso",
    ],
    "Moradia": [
        "condominio", "condomínio", "aluguel", "iptu", "luz", "água",
        "cemig", "sabesp", "copel", "enel", "energia", "gás", "comgas",
        "internet", "claro", "tim", "vivo", "oi",
    ],
    "Compras Online": [
        "amazon", "mercado livre", "shopee", "americanas", "magalu",
        "magazine luiza", "submarino", "casas bahia", "aliexpress",
    ],
    "Pagamento de Fatura / Interno": [
        "pagamento recebido", "pagamento fatura", "fatura", "pagamento de cartão",
        "pagamento cartão", "pag fatura", "boleto nubank", "pgto fatura",
        "vinicius m salvino"
    ],
    "Bancos & Finanças": [
        "ted", "pix", "transferencia", "transferência", "saldo", "rendimento",
        "juros", "tarifa", "anuidade", "iof", "imposto", "seguro",
    ],
    "Vestuário": [
        "zara", "renner", "c&a", "riachuelo", "hm", "h&m", "nike", "adidas",
        "reserva", "farm", "arezzo", "centauro",
    ],
}

def categorize_transactions(transactions: list[dict]) -> list[dict]:
    """Categoriza todas as transações usando apenas regras estáticas."""
    for tx in transactions:
        tx["category"] = _apply_static_rules(tx["description"]) or "Outros"
    return transactions


def _apply_static_rules(description: str) -> Optional[str]:
    """Verifica se a descrição corresponde a alguma regra estática."""
    desc_lower = description.lower()
    for category, keywords in STATIC_RULES.items():
        if any(kw in desc_lower for kw in keywords):
            return category
    return None