import io
import hashlib
import re
from typing import List, Optional
from pydantic import BaseModel
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from parser import extract_transactions
from categorizer import categorize_transactions
from reporter import generate_report
from exporter import export_to_excel

# --- DB & Auth ---
from database import engine, get_db
import models
import auth

# Inicializar Tabelas no SQLite automaticamente ao iniciar
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="FinanceAuto PRO API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Schemas ---
class UserCreate(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TransactionUpdate(BaseModel):
    category: str

class ColorUpdate(BaseModel):
    category: str
    hex_color: str


def _validate_month(month: str) -> str:
    m = (month or "").strip()
    if not re.fullmatch(r"\d{4}-\d{2}", m):
        raise HTTPException(status_code=422, detail="month inválido. Use o formato YYYY-MM (ex: 2026-04).")
    mm = int(m[5:7])
    if mm < 1 or mm > 12:
        raise HTTPException(status_code=422, detail="month inválido. Mês deve ser 01..12.")
    return m

# --- Fluxo de Autenticação (Auth) ---

@app.post("/auth/register", response_model=Token)
async def register_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="E-mail já está cadastrado.")
    
    hashed_password = await auth.get_password_hash_async(user.password)
    new_user = models.User(email=user.email, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Auto-login ao registrar
    access_token = auth.create_access_token(data={"sub": new_user.email})
    return {"access_token": access_token, "token_type": "bearer"}


@app.post("/auth/login", response_model=Token)
async def login_user(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not await auth.verify_password_async(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = auth.create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/auth/me")
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return {"email": current_user.email, "id": current_user.id}


# --- Funcionalidades do Dashboard ---

@app.post("/upload")
async def upload_pdf(
    file: UploadFile = File(...), 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Motor Base: Upload de PDF protegidíssimo! Extrai transações e injeta no BD do usuário,
    usando hashing MD5 para ignorar contas duplicadas de faturas reenviadas.
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Apenas arquivos PDF são aceitos.")

    pdf_bytes = await file.read()
    raw_transactions = extract_transactions(pdf_bytes)
    if not raw_transactions:
        raise HTTPException(status_code=422, detail="Não foi possível extrair transações deste PDF.")

    categorized = categorize_transactions(raw_transactions)
    sucesso_adicionados = 0

    for tx in categorized:
        # Criar HASH único (deduplicação)
        base_str = f"{current_user.id}-{tx['date']}-{tx['description']}-{tx['amount']}"
        tx_hash = hashlib.md5(base_str.encode()).hexdigest()
        
        # Só injeta se não existir
        existing = db.query(models.Transaction).filter(models.Transaction.transaction_hash == tx_hash).first()
        if not existing:
            new_tx = models.Transaction(
                date=tx["date"],
                description=tx["description"],
                category=tx["category"],
                amount=tx["amount"],
                transaction_hash=tx_hash,
                user_id=current_user.id
            )
            db.add(new_tx)
            sucesso_adicionados += 1
            
    db.commit()

    return {"message": f"Extração concluída. {sucesso_adicionados} transações injetadas no banco de forma irrepetível."}


@app.post("/api/upload-batch")
async def upload_batch_for_month(
    month: str,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Upload de várias faturas (PDFs) para um mês (YYYY-MM).
    Salva um registro de batch, registra documentos enviados e injeta transações deduplicadas.
    """
    month = _validate_month(month)

    if not files:
        raise HTTPException(status_code=422, detail="Nenhum arquivo enviado.")

    batch = models.UploadBatch(month=month, user_id=current_user.id)
    db.add(batch)
    db.commit()
    db.refresh(batch)

    total_extracted = 0
    total_inserted = 0
    doc_results: list[dict] = []

    for f in files:
        if not (f.filename or "").lower().endswith(".pdf"):
            doc_results.append({"filename": f.filename, "status": "skipped", "reason": "Apenas PDF"})
            continue

        pdf_bytes = await f.read()
        if not pdf_bytes:
            doc_results.append({"filename": f.filename, "status": "skipped", "reason": "Arquivo vazio"})
            continue

        doc_hash = hashlib.sha256(pdf_bytes).hexdigest()
        existing_doc = (
            db.query(models.UploadedDocument)
            .filter(models.UploadedDocument.user_id == current_user.id, models.UploadedDocument.doc_hash == doc_hash)
            .first()
        )
        if existing_doc:
            doc_results.append({"filename": f.filename, "status": "skipped", "reason": "PDF já enviado"})
            continue

        raw_transactions = extract_transactions(pdf_bytes)
        extracted_count = len(raw_transactions or [])
        total_extracted += extracted_count

        if not raw_transactions:
            # Ainda registramos o doc, para não repetir upload inútil
            doc = models.UploadedDocument(
                user_id=current_user.id,
                batch_id=batch.id,
                original_filename=f.filename or "sem_nome.pdf",
                doc_hash=doc_hash,
            )
            db.add(doc)
            db.commit()
            doc_results.append({"filename": f.filename, "status": "ok", "extracted": 0, "inserted": 0})
            continue

        categorized = categorize_transactions(raw_transactions)
        inserted_for_doc = 0

        for tx in categorized:
            base_str = f"{current_user.id}-{tx['date']}-{tx['description']}-{tx['amount']}"
            tx_hash = hashlib.md5(base_str.encode()).hexdigest()

            existing_tx = (
                db.query(models.Transaction)
                .filter(models.Transaction.transaction_hash == tx_hash)
                .first()
            )
            if existing_tx:
                continue

            new_tx = models.Transaction(
                date=tx["date"],
                description=tx["description"],
                category=tx.get("category") or "Outros",
                amount=tx["amount"],
                transaction_hash=tx_hash,
                user_id=current_user.id,
                batch_id=batch.id,
            )
            db.add(new_tx)
            inserted_for_doc += 1

        doc = models.UploadedDocument(
            user_id=current_user.id,
            batch_id=batch.id,
            original_filename=f.filename or "sem_nome.pdf",
            doc_hash=doc_hash,
        )
        db.add(doc)

        db.commit()
        total_inserted += inserted_for_doc
        doc_results.append(
            {"filename": f.filename, "status": "ok", "extracted": extracted_count, "inserted": inserted_for_doc}
        )

    batch.total_files = len(files)
    batch.total_extracted = total_extracted
    batch.total_inserted = total_inserted
    db.commit()

    return {
        "batchId": batch.id,
        "month": month,
        "totalFiles": len(files),
        "totalExtracted": total_extracted,
        "totalInserted": total_inserted,
        "documents": doc_results,
    }


@app.get("/api/transactions")
def get_transactions(
    year: Optional[str] = None, 
    month: Optional[str] = None, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Retorna TODAS ou filtra por ano e mês. Ex: 2026-03"""
    query = db.query(models.Transaction).filter(models.Transaction.user_id == current_user.id)
    
    if year and month:
        # formata mês para 2 dígitos
        mm = month.zfill(2)
        prefix = f"{year}-{mm}-"
        query = query.filter(models.Transaction.date.startswith(prefix))
        
    txs = query.order_by(models.Transaction.date.desc()).all()
    
    result = []
    for t in txs:
        result.append({
            "id": t.id,
            "date": t.date,
            "description": t.description,
            "amount": t.amount,
            "category": t.category
        })
    return {"transactions": result}


@app.put("/api/transactions/{tx_id}")
def update_transaction_category(
    tx_id: int, 
    update: TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Atualiza a categoria de uma conta persistindo no banco."""
    tx = db.query(models.Transaction).filter(
        models.Transaction.id == tx_id, 
        models.Transaction.user_id == current_user.id
    ).first()
    
    if not tx:
        raise HTTPException(status_code=404, detail="Transação não encontrada")
        
    tx.category = update.category
    db.commit()
    return {"status": "ok"}


@app.get("/api/colors")
def get_user_colors(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    colors = db.query(models.CustomColor).filter(models.CustomColor.user_id == current_user.id).all()
    color_map = {c.category: c.hex_color for c in colors}
    return {"customColors": color_map}


@app.post("/api/colors")
def set_user_color(
    color_data: ColorUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    c = db.query(models.CustomColor).filter(
        models.CustomColor.user_id == current_user.id,
        models.CustomColor.category == color_data.category
    ).first()
    
    if c:
        c.hex_color = color_data.hex_color
    else:
        c = models.CustomColor(
            user_id=current_user.id, 
            category=color_data.category, 
            hex_color=color_data.hex_color
        )
        db.add(c)
        
    db.commit()
    return {"status": "ok"}


@app.delete("/api/transactions/nuke")
def delete_all_my_data(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Rota perigosa: apaga todas as faturas do usuário."""
    db.query(models.Transaction).filter(models.Transaction.user_id == current_user.id).delete()
    db.commit()
    return {"message": "Limpeza completa."}
