from database import engine
from sqlalchemy import text

print("Running database migrations for runs and nodes tables...")

with engine.connect() as conn:
    run_cols = [
        ("user_id", "VARCHAR DEFAULT 'anonymous'"),
        ("share_token", "VARCHAR"),
        ("is_public", "BOOLEAN DEFAULT 0"),
    ]
    for col_name, col_def in run_cols:
        try:
            conn.execute(text(f"ALTER TABLE runs ADD COLUMN {col_name} {col_def};"))
            print(f"Added column runs.{col_name}")
        except Exception as e:
            print(f"Column runs.{col_name} note:", e)

    node_cols = [
        ("embedding", "TEXT"),
        ("eval_score", "JSON"),
        ("token_count_input", "INTEGER"),
        ("token_count_output", "INTEGER"),
        ("model_name", "VARCHAR"),
        ("latency_ms", "FLOAT"),
        ("status_message", "TEXT"),
    ]
    for col_name, col_def in node_cols:
        try:
            conn.execute(text(f"ALTER TABLE nodes ADD COLUMN {col_name} {col_def};"))
            print(f"Added column nodes.{col_name}")
        except Exception as e:
            print(f"Column nodes.{col_name} note:", e)

    # Additional Run columns
    extra_run_cols = [
        ("is_template", "BOOLEAN DEFAULT 0"),
        ("template_title", "VARCHAR"),
        ("template_description", "TEXT"),
        ("clone_count", "INTEGER DEFAULT 0"),
    ]
    for col_name, col_def in extra_run_cols:
        try:
            conn.execute(text(f"ALTER TABLE runs ADD COLUMN {col_name} {col_def};"))
            print(f"Added column runs.{col_name}")
        except Exception as e:
            print(f"Column runs.{col_name} note:", e)

    # Challenge columns
    challenge_cols = [
        ("weekly_rank", "INTEGER"),
        ("difficulty_score", "FLOAT DEFAULT 0.0"),
        ("engagement_score", "FLOAT DEFAULT 0.0"),
    ]
    for col_name, col_def in challenge_cols:
        try:
            conn.execute(text(f"ALTER TABLE challenges ADD COLUMN {col_name} {col_def};"))
            print(f"Added column challenges.{col_name}")
        except Exception as e:
            print(f"Column challenges.{col_name} note:", e)

    # User Profiles table
    try:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS user_profiles (
                user_id VARCHAR PRIMARY KEY,
                current_streak INTEGER DEFAULT 0,
                longest_streak INTEGER DEFAULT 0,
                last_active_date VARCHAR,
                created_at DATETIME
            );
        """))
        print("Created table user_profiles")
    except Exception as e:
        print("Table user_profiles note:", e)

    conn.commit()

print("Schema migration finished successfully!")
