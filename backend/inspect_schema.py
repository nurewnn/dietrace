"""Temporary script: reflect and print public schema tables, columns, and types."""

from sqlalchemy import MetaData

from app.database import engine

metadata = MetaData()
metadata.reflect(bind=engine, schema="public")

if not metadata.tables:
    print("No tables found in the public schema.")
else:
    for table_name in sorted(metadata.tables):
        table = metadata.tables[table_name]
        print(f"\n{table.name}")
        print("-" * len(table.name))
        for column in table.columns:
            print(f"  {column.name}: {column.type}")
