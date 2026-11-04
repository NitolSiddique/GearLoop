from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.database import get_session
from app.categories.models import Category, utcnow
from app.categories.schemas import CategoryCreate, CategoryRead, CategoryUpdate

router = APIRouter(prefix="/api/v1/categories", tags=["categories"])

SessionDep = Annotated[Session, Depends(get_session)]

NOT_FOUND = "Category not found"
DUPLICATE = "Category name already exists"


def get_active_or_404(session: Session, category_id: int) -> Category:
    category = session.get(Category, category_id)
    if category is None or not category.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=NOT_FOUND)
    return category


def name_taken(session: Session, name: str, exclude_id: int | None = None) -> bool:
    stmt = select(Category).where(Category.name == name)
    if exclude_id is not None:
        stmt = stmt.where(Category.id != exclude_id)
    return session.exec(stmt).first() is not None


def commit_or_409(session: Session) -> None:
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=DUPLICATE)


@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(data: CategoryCreate, session: SessionDep) -> Category:
    if name_taken(session, data.name):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=DUPLICATE)
    category = Category(name=data.name, description=data.description)
    session.add(category)
    commit_or_409(session)
    session.refresh(category)
    return category


@router.get("", response_model=list[CategoryRead])
def list_categories(session: SessionDep) -> list[Category]:
    stmt = select(Category).where(Category.is_active == True).order_by(Category.name)  # noqa: E712
    return list(session.exec(stmt).all())


@router.get("/{category_id}", response_model=CategoryRead)
def get_category(category_id: int, session: SessionDep) -> Category:
    return get_active_or_404(session, category_id)


@router.put("/{category_id}", response_model=CategoryRead)
def update_category(
    category_id: int, data: CategoryUpdate, session: SessionDep
) -> Category:
    category = get_active_or_404(session, category_id)
    if name_taken(session, data.name, exclude_id=category_id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=DUPLICATE)
    category.name = data.name
    category.description = data.description
    category.updated_at = utcnow()
    session.add(category)
    commit_or_409(session)
    session.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, session: SessionDep) -> None:
    # Soft delete: keep the row, mark it inactive.
    category = get_active_or_404(session, category_id)
    category.is_active = False
    category.updated_at = utcnow()
    session.add(category)
    session.commit()
