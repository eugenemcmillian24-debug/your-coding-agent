from app.services.state_machine import set_state

def test_invalid_state():
    try:
        set_state('job-1', 'not-a-real-state', '')
    except ValueError:
        assert True
        return
    assert False
