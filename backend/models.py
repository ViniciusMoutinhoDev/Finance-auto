from sqlalchemy import Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)

    transactions = relationship("Transaction", back_populates="owner")
    custom_colors = relationship("CustomColor", back_populates="owner")

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

class CustomColor(Base):
    __tablename__ = "custom_colors"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String)
    hex_color = Column(String)

    user_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="custom_colors")
