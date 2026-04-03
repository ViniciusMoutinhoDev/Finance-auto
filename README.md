# 💸 FinanceAuto — MVP de Gestão Financeira Automatizada

Upload de extrato PDF → Extração automática → Categorização por IA → Dashboard de insights.

## Estrutura do Projeto

```
finance_app/
├── backend/
│   ├── main.py          # FastAPI: endpoints /upload e /export
│   ├── parser.py        # Motor de extração de PDF (coração do sistema)
│   ├── categorizer.py   # Categorização: regras estáticas + Claude IA
│   ├── reporter.py      # Geração de relatórios e insights
│   ├── exporter.py      # Exportação para .xlsx
│   └── requirements.txt
└── frontend/
    └── src/
        └── App.jsx      # Dashboard React completo (single-file)
```

## Setup — Backend

```bash
cd backend

# Instalar dependências
pip install -r requirements.txt

# Configurar chave da API Anthropic
export ANTHROPIC_API_KEY="sk-ant-..."   # Linux/Mac
set ANTHROPIC_API_KEY=sk-ant-...        # Windows

# Iniciar servidor
uvicorn main:app --reload --port 8000
```

## Setup — Frontend

```bash
# Crie um projeto Vite React
npm create vite@latest frontend -- --template react
cd frontend

# Substitua o src/App.jsx pelo arquivo gerado
# Instale e rode:
npm install
npm run dev
```

## Endpoints da API

| Método | Rota      | Descrição                                  |
|--------|-----------|--------------------------------------------|
| POST   | /upload   | Processa PDF e retorna JSON com insights   |
| POST   | /export   | Processa PDF e retorna arquivo .xlsx       |

## Pipeline de Extração

```
PDF bytes
    ↓
pdfplumber (extração de tabelas)
    ↓ (fallback se não encontrar tabelas)
regex multi-padrão no texto bruto
    ↓
normalização para schema padrão
    ↓
regras estáticas (~70% dos casos)
    ↓ (casos ambíguos)
Claude API (batch)
    ↓
relatório + dashboard
```

## Adicionando Suporte a Novos Bancos

Edite `parser.py`:
1. Adicione um novo padrão regex em `STATIC_RULES` ou crie um novo `PATTERN_*`
2. Adicione o padrão ao loop em `_parse_from_text()`
3. Se o banco usa tabelas, ajuste `_find_column()` com os nomes de cabeçalho do banco

## Testando com PDF Real

```python
# test_parser.py
from parser import extract_transactions

with open("meu_extrato.pdf", "rb") as f:
    txs = extract_transactions(f.read())

for tx in txs[:5]:
    print(tx)
```
