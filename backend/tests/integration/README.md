# Integration Tests

Tests for complete workflows and cross-module interactions.

## Test Files

| File | What it tests |
|------|---------------|
| `test_rsm_integration.py` | RSM processing pipeline, rendering, API integration |
| `test_rsm_error_handling.py` | Malformed markup, error recovery, edge cases |
| `test_database_constraints.py` | Constraints, transactions, concurrency, PostgreSQL-specific behavior |

## Running

```bash
uv run pytest tests/integration/ -v              # SQLite (local)
ENV=CI uv run pytest tests/integration/ -v       # PostgreSQL
uv run pytest tests/integration/ --cov=aris      # with coverage
```

## Database strategy

Tests run on SQLite locally and PostgreSQL in CI. Use the `is_postgresql` fixture to skip or condition tests that only apply to one database:

```python
async def test_something_postgres_only(self, db_session, is_postgresql):
    if not is_postgresql:
        pytest.skip("PostgreSQL only")
    ...
```
