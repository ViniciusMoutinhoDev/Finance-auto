"""
parser.py — Motor de Extração de PDF
Suporta: layout padrão BR, Nubank (fatura cartão), formato americano.
"""

import re
import pdfplumber
from datetime import datetime
from typing import Optional
import io

# Padrão 1: DD/MM/YYYY  Descrição  R$ 1.234,56
PATTERN_BR_STANDARD = re.compile(
    r"(\d{2}/\d{2}/\d{4})\s+(.+?)\s+([-+]?\s*R?\$?\s*[\d.]+,\d{2})",
    re.IGNORECASE,
)

# Padrão 2: DD/MM  Descrição  1.234,56
PATTERN_BR_SHORT = re.compile(
    r"(\d{2}/\d{2})\s+(.+?)\s+([-+]?\s*[\d.]+,\d{2})\s*$",
    re.MULTILINE,
)

# Padrão 3: formato americano
PATTERN_US_FORMAT = re.compile(
    r"(\d{2}/\d{2}/\d{4})\s+(.+?)\s+([-+]?\s*[\d,]+\.\d{2})",
    re.IGNORECASE,
)

# Padrão 4: Nubank — "01 MAR •••• 9828 Emgconveniencia R$ 6,98"
_MESES = r"(?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)"
PATTERN_NUBANK = re.compile(
    r"(\d{2}\s+" + _MESES + r")"
    r"(?:\s+[^\w\s]{4}\s+\d{4})?"
    r"\s+(.+?)\s+"
    r"([-\u2212]?R\$\s*[\d.]+,\d{2})",
    re.IGNORECASE,
)

MESES_MAP = {
    "JAN": "01", "FEV": "02", "MAR": "03", "ABR": "04",
    "MAI": "05", "JUN": "06", "JUL": "07", "AGO": "08",
    "SET": "09", "OUT": "10", "NOV": "11", "DEZ": "12",
}


def extract_transactions(pdf_bytes: bytes) -> list[dict]:
    results = []

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        all_text = ""
        all_tables = []
        for page in pdf.pages:
            tables = page.extract_tables()
            if tables:
                all_tables.extend(tables)
            text = page.extract_text()
            if text:
                all_text += text + "\n"

    if all_tables:
        table_results = _parse_from_tables(all_tables)
        if table_results:
            results = table_results

    if len(results) < 3 and all_text:
        regex_results = _parse_from_text(all_text)
        if len(regex_results) > len(results):
            results = regex_results

    # Filtragem Global: Remove lixo (datas lidas como descrições) e dupla contagem de faturas
    valid_txs = []
    skip_substrings = [
        "saldo anterior", "total a pagar", "saldo em aberto",
        "total de compras", "limite total", "limite disponível", "valor máximo",
        "saldo do dia", "saldo final", "composição", "encargos", "emissão", 
        "próximas faturas", "utilizado", "disponível"
    ]
    
    for tx in results:
        desc_lower = tx["description"].lower().strip()
        # Elimina linhas que são apenas "a 27 MAR", "01 FEV a 28 FEV", etc.
        if re.match(r"^(a\s+|de\s+)?\d{1,2}\s+(de\s+)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)", desc_lower):
            continue
        # Elimina descrições que parecem apenas uma data (ex: 24/02/2026)
        if re.match(r"^\d{2}/\d{2}(/\d{2,4})?$", desc_lower):
            continue
        # Elimina saldos estáticos
        if any(sub in desc_lower for sub in skip_substrings):
            continue
            
        valid_txs.append(tx)

    return valid_txs


def _parse_from_tables(tables):
    transactions = []
    for table in tables:
        if not table or len(table) < 2:
            continue
        header = [str(c).lower().strip() if c else "" for c in table[0]]
        date_col = _find_column(header, ["data", "date", "dt", "vencimento"])
        desc_col = _find_column(header, ["descrição", "descricao", "historico", "lançamento", "merchant"])
        value_col = _find_column(header, ["valor", "value", "amount", "débito", "crédito"])
        if date_col is None or value_col is None:
            date_col, desc_col, value_col = _infer_columns(table)
        if date_col is None or value_col is None:
            continue
        for row in table[1:]:
            if not row or len(row) <= max(date_col or 0, value_col):
                continue
            raw_date = str(row[date_col]).strip() if date_col is not None else ""
            raw_desc = str(row[desc_col]).strip() if desc_col is not None else "Sem descrição"
            raw_value = str(row[value_col]).strip() if row[value_col] else ""
            parsed_date = _parse_date(raw_date)
            parsed_amount = _parse_amount(raw_value)
            if not parsed_date or parsed_amount is None:
                continue
            transactions.append({
                "date": parsed_date, "description": raw_desc,
                "amount": parsed_amount,
                "type": "credit" if parsed_amount > 0 else "debit",
                "category": None,
            })
    return transactions


def _parse_from_text(text):
    current_year = datetime.now().year
    best = []

    nubank = _parse_nubank(text, current_year)
    if len(nubank) > len(best):
        best = nubank

    for pattern, date_fmt, amount_fmt in [
        (PATTERN_BR_STANDARD, "full_br", "br"),
        (PATTERN_BR_SHORT, "short_br", "br"),
        (PATTERN_US_FORMAT, "full_us", "us"),
    ]:
        matches = pattern.findall(text)
        results = []
        for raw_date, raw_desc, raw_value in matches:
            parsed_date = _parse_date(raw_date.strip(), date_fmt, current_year)
            parsed_amount = _parse_amount(raw_value.strip(), amount_fmt)
            if not parsed_date or parsed_amount is None:
                continue
            results.append({
                "date": parsed_date, "description": raw_desc.strip(),
                "amount": parsed_amount,
                "type": "credit" if parsed_amount > 0 else "debit",
                "category": None,
            })
        if len(results) > len(best):
            best = results

    return best


def _parse_nubank(text, current_year):
    transactions = []
    skip_keywords = [
        "pagamento mínimo", "total a pagar", "fatura anterior", "saldo em aberto",
        "pagamento recebido", "outros lançamentos", "total de compras",
        "limite total", "limite disponível", "valor máximo", "saque no crédito",
        "pix no crédito", "pagamentos de boleto", "fechamento",
        "juros", "iof", "cet", "parcelar", "rotativo",
        "composição", "encargos", "emissão", "próximas faturas",
        "utilizado", "disponível", "pagamento total",
    ]

    matches = PATTERN_NUBANK.findall(text)
    for raw_date, raw_desc, raw_value in matches:
        desc = raw_desc.strip()
        if any(kw in desc.lower() for kw in skip_keywords):
            continue

        parsed_date = _parse_nubank_date(raw_date.strip(), current_year)
        parsed_amount = _parse_amount(raw_value.strip(), "br")
        if not parsed_date or parsed_amount is None:
            continue

        # Pagamentos têm sinal negativo no PDF do Nubank (são créditos)
        is_payment = "\u2212" in raw_value or raw_value.strip().startswith("-")
        if is_payment:
            parsed_amount = abs(parsed_amount)   # crédito = positivo
        else:
            parsed_amount = -abs(parsed_amount)  # débito = negativo

        transactions.append({
            "date": parsed_date, "description": desc,
            "amount": parsed_amount,
            "type": "credit" if parsed_amount > 0 else "debit",
            "category": None,
        })

    return transactions


def _parse_nubank_date(raw, year):
    parts = raw.upper().split()
    if len(parts) != 2:
        return None
    day, mes = parts
    month = MESES_MAP.get(mes)
    if not month:
        return None
    try:
        return datetime(year, int(month), int(day)).strftime("%Y-%m-%d")
    except ValueError:
        return None


def _find_column(header, keywords):
    for i, cell in enumerate(header):
        for kw in keywords:
            if kw in cell:
                return i
    return None


def _infer_columns(table):
    if len(table) < 2:
        return None, None, None
    date_col = value_col = desc_col = None
    sample_row = next((r for r in table[1:] if r and any(r)), None)
    if not sample_row:
        return None, None, None
    for i, cell in enumerate(sample_row):
        cell_str = str(cell or "").strip()
        if re.match(r"\d{2}/\d{2}", cell_str) and date_col is None:
            date_col = i
        elif re.search(r"[\d.]+,\d{2}", cell_str) and value_col is None:
            value_col = i
    if date_col is not None and value_col is not None:
        middle = [i for i in range(len(sample_row)) if i not in (date_col, value_col)]
        desc_col = middle[0] if middle else None
    return date_col, desc_col, value_col


def _parse_date(raw, fmt_hint="auto", fallback_year=2024):
    raw = raw.strip().replace(" ", "")
    for fmt in ["%d/%m/%Y", "%d/%m/%y", "%m/%d/%Y", "%d-%m-%Y", "%Y-%m-%d"]:
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    m = re.match(r"(\d{2})/(\d{2})$", raw)
    if m:
        try:
            return datetime.strptime(f"{m.group(1)}/{m.group(2)}/{fallback_year}", "%d/%m/%Y").strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None


def _parse_amount(raw, fmt="br"):
    raw = re.sub(r"R?\$\s*", "", raw).strip()
    is_negative = raw.startswith("-") or raw.startswith("\u2212") or raw.startswith("(")
    raw = re.sub(r"[()+\-\u2212]", "", raw).strip()
    try:
        if fmt == "us":
            amount = float(raw.replace(",", ""))
        else:
            amount = float(raw.replace(".", "").replace(",", "."))
        return -abs(amount) if is_negative else amount
    except (ValueError, AttributeError):
        return None