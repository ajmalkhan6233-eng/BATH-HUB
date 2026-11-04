"""Run once to create all tables in PostgreSQL."""
import sys, os
sys.path.append(os.path.dirname(__file__))
from database import engine, Base
import models  # registers all models

def init():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Done. Tables created:")
    for table in Base.metadata.tables:
        print(f"  - {table}")

if __name__ == "__main__":
    init()
