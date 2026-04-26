import os
import sys

# Добавляем корневую директорию проекта в sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import Tag

def seed_tags():
    db = SessionLocal()
    
    tags_data = [
        # Tech / Skills
        {"name": "Python", "category": "tech"},
        {"name": "JavaScript", "category": "tech"},
        {"name": "React", "category": "tech"},
        {"name": "Vue.js", "category": "tech"},
        {"name": "TypeScript", "category": "tech"},
        {"name": "Node.js", "category": "tech"},
        {"name": "FastAPI", "category": "tech"},
        {"name": "Django", "category": "tech"},
        {"name": "Go", "category": "tech"},
        {"name": "Java", "category": "tech"},
        {"name": "C++", "category": "tech"},
        {"name": "C#", "category": "tech"},
        {"name": "SQL", "category": "tech"},
        {"name": "PostgreSQL", "category": "tech"},
        {"name": "Docker", "category": "tech"},
        {"name": "Kubernetes", "category": "tech"},
        {"name": "Data Science", "category": "tech"},
        {"name": "Machine Learning", "category": "tech"},
        {"name": "Figma", "category": "tech"},
        {"name": "UI/UX", "category": "tech"},
        {"name": "QA", "category": "tech"},
        {"name": "DevOps", "category": "tech"},
        
        # Level
        {"name": "Trainee", "category": "level"},
        {"name": "Junior", "category": "level"},
        {"name": "Middle", "category": "level"},
        {"name": "Senior", "category": "level"},
        
        # Format
        {"name": "Удаленка", "category": "format"},
        {"name": "Офис", "category": "format"},
        {"name": "Гибрид", "category": "format"},
        
        # Employment Type
        {"name": "Полный день", "category": "employment_type"},
        {"name": "Неполный день", "category": "employment_type"},
        {"name": "Стажировка", "category": "employment_type"},
        {"name": "Проектная работа", "category": "employment_type"},
    ]

    added_count = 0
    for tag_info in tags_data:
        # Проверяем, существует ли уже такой тег
        existing_tag = db.query(Tag).filter(Tag.name == tag_info["name"]).first()
        if not existing_tag:
            new_tag = Tag(name=tag_info["name"], category=tag_info["category"])
            db.add(new_tag)
            added_count += 1
            
    db.commit()
    db.close()
    
    print(f"Успешно добавлено тегов: {added_count}")

if __name__ == "__main__":
    print("Начинаем загрузку тегов в базу данных...")
    seed_tags()
    print("Завершено!")
