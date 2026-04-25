from app.services.idempotency import reserve

def test_idempotency_reserve_once(monkeypatch):
    calls = {'seen': set()}
    class FakeSelect:
        def __init__(self, key): self.key = key
        def fetchone(self): return {'idempotency_key': self.key} if self.key in calls['seen'] else None
    class FakeConn:
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def execute(self, sql, params=None):
            if 'SELECT * FROM idempotency_records' in sql:
                return FakeSelect(params[0])
            if 'INSERT INTO idempotency_records' in sql:
                calls['seen'].add(params[2])
                return None
    monkeypatch.setattr('app.services.idempotency.get_conn', lambda: FakeConn())
    assert reserve('j1', 'publish', 'j1:publish') is True
    assert reserve('j1', 'publish', 'j1:publish') is False
