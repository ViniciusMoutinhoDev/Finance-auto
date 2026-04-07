from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)

    transactions = relationship("Transaction", back_populates="owner")
    custom_colors = relationship("CustomColor", back_populates="owner")
    upload_batches = relationship("UploadBatch", back_populates="owner")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(String, index=True) # YYYY-MM-DD
    description = Column(String)
    category = Column(String, index=True)
    amount = Column(Float)
    transaction_hash = Column(String, unique=True, index=True) # MD5(user_id + date + desc + amount)
    
    user_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="transactions")
    batch_id = Column(Integer, ForeignKey("upload_batches.id"), nullable=True)
    batch = relationship("UploadBatch", back_populates="transactions")

class CustomColor(Base):
    __tablename__ = "custom_colors"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String)
    hex_color = Column(String)

    user_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="custom_colors")


class UploadBatch(Base):
    __tablename__ = "upload_batches"

    id = Column(Integer, primary_key=True, index=True)
    month = Column(String, index=True)  # YYYY-MM
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    total_files = Column(Integer, default=0, nullable=False)
    total_extracted = Column(Integer, default=0, nullable=False)
    total_inserted = Column(Integer, default=0, nullable=False)

    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    owner = relationship("User", back_populates="upload_batches")

    documents = relationship("UploadedDocument", back_populates="batch", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="batch")

    __table_args__ = (UniqueConstraint("user_id", "month", "created_at", name="uq_batch_user_month_created"),)


class UploadedDocument(Base):
    __tablename__ = "uploaded_documents"

    id = Column(Integer, primary_key=True, index=True)
    original_filename = Column(String, nullable=False)
    doc_hash = Column(String, nullable=False, index=True)  # sha256(pdf_bytes)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    batch_id = Column(Integer, ForeignKey("upload_batches.id"), index=True)
    batch = relationship("UploadBatch", back_populates="documents")

    user_id = Column(Integer, ForeignKey("users.id"), index=True)

    __table_args__ = (UniqueConstraint("user_id", "doc_hash", name="uq_uploaded_doc_user_hash"),)
