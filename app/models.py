from datetime import date, datetime
from sqlalchemy import Column, Integer, String, Text, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Factory(Base):
    __tablename__ = "factories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    sections = relationship("Section", back_populates="factory", cascade="all, delete-orphan")


class Section(Base):
    __tablename__ = "sections"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    factory = relationship("Factory", back_populates="sections")
    equipment_list = relationship("Equipment", back_populates="section", cascade="all, delete-orphan")


class Equipment(Base):
    __tablename__ = "equipment"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    section_id = Column(Integer, ForeignKey("sections.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    section = relationship("Section", back_populates="equipment_list")
    components = relationship("Component", back_populates="equipment", cascade="all, delete-orphan")
    documentation = relationship("Documentation", back_populates="equipment", cascade="all, delete-orphan")
    maintenance_tasks = relationship("MaintenanceTask", back_populates="equipment", cascade="all, delete-orphan")
    maintenance_plans = relationship("MaintenancePlan", back_populates="equipment", cascade="all, delete-orphan")


class Component(Base):
    __tablename__ = "components"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    equipment_id = Column(Integer, ForeignKey("equipment.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    equipment = relationship("Equipment", back_populates="components")
    documentation = relationship("Documentation", back_populates="component", cascade="all, delete-orphan")
    maintenance_tasks = relationship("MaintenanceTask", back_populates="component", cascade="all, delete-orphan")
    maintenance_plans = relationship("MaintenancePlan", back_populates="component", cascade="all, delete-orphan")


class Documentation(Base):
    __tablename__ = "documentation"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    url = Column(String(500), nullable=False)
    equipment_id = Column(Integer, ForeignKey("equipment.id", ondelete="CASCADE"), nullable=True)
    component_id = Column(Integer, ForeignKey("components.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    equipment = relationship("Equipment", back_populates="documentation")
    component = relationship("Component", back_populates="documentation")


class MaintenanceTask(Base):
    __tablename__ = "maintenance_tasks"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    due_date = Column(Date, nullable=False)
    status = Column(String(20), default="planned")
    notes = Column(Text, default="")
    equipment_id = Column(Integer, ForeignKey("equipment.id", ondelete="CASCADE"), nullable=True)
    component_id = Column(Integer, ForeignKey("components.id", ondelete="CASCADE"), nullable=True)
    plan_id = Column(Integer, ForeignKey("maintenance_plans.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    equipment = relationship("Equipment", back_populates="maintenance_tasks")
    component = relationship("Component", back_populates="maintenance_tasks")
    plan = relationship("MaintenancePlan", back_populates="tasks")


class MaintenancePlan(Base):
    __tablename__ = "maintenance_plans"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    interval_days = Column(Integer, nullable=False)
    last_completed = Column(Date, nullable=True)
    next_due = Column(Date, nullable=False)
    equipment_id = Column(Integer, ForeignKey("equipment.id", ondelete="CASCADE"), nullable=True)
    component_id = Column(Integer, ForeignKey("components.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    equipment = relationship("Equipment", back_populates="maintenance_plans")
    component = relationship("Component", back_populates="maintenance_plans")
    tasks = relationship("MaintenanceTask", back_populates="plan")
