"""
main.py — Entrypoint da API FastAPI
Gerencia upload de PDFs e roteamento dos módulos de extração, categorização e relatórios.
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import io

from parser import extract_transactions
from categorizer import categorize_transactions
from reporter import generate_report
from exporter import export_to_excel

app = FastAPI(title="FinanceAuto MVP", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em produção, restrinja ao domínio do frontend
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """
    Recebe um PDF de extrato bancário ou fatura.
    Executa o pipeline completo: extração → categorização → relatório.
    Retorna JSON com transações categorizadas e insights.
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Apenas arquivos PDF são aceitos.")

    pdf_bytes = await file.read()

    # 1. Extrair transações brutas do PDF
    raw_transactions = extract_transactions(pdf_bytes)

    if not raw_transactions:
        raise HTTPException(status_code=422, detail="Não foi possível extrair transações deste PDF.")

    # 2. Categorizar via IA
    categorized = categorize_transactions(raw_transactions)

    # 3. Gerar relatório de insights
    report = generate_report(categorized)

    return {
        "transactions": categorized,
        "report": report,
        "total_extracted": len(categorized),
    }


@app.post("/export")
async def export_excel(file: UploadFile = File(...)):
    """
    Mesmo pipeline do /upload, mas retorna um arquivo .xlsx para download.
    """
    pdf_bytes = await file.read()
    raw_transactions = extract_transactions(pdf_bytes)
    categorized = categorize_transactions(raw_transactions)

    excel_bytes = export_to_excel(categorized)

    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=extrato_processado.xlsx"},
    )
