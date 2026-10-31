"""Genera las referencias del simulador a partir del cuotero Flask original.

El simulador del Hub (src/lib/fide/simulador.ts) es un porteo de
cuotero_prime/app.py: generate_full_schedule. Este script corre el Python original sobre un
conjunto de casos y guarda su salida en src/test/golden-cuotero.json, que el test del porteo usa
como referencia. Si cambia la lógica del cuotero, regenerar con:

    cd /home/administrator/cuotero_prime
    ./venv/bin/python /home/administrator/fortaleza-hub/scripts/golden-cuotero.py \
        > /home/administrator/fortaleza-hub/src/test/golden-cuotero.json

Necesita el venv del cuotero (trae python-dateutil). Los stubs de abajo permiten importar app.py
sin levantar Flask.
"""

import json, sys, types
sys.path.insert(0, "/home/administrator/cuotero_prime")
# Stubs mínimos para importar app.py sin Flask.
flask = types.ModuleType("flask")
class DummyFlask:
    def __init__(self, *a, **k):
        self.logger = types.SimpleNamespace(warning=lambda *a, **k: None, info=lambda *a, **k: None, error=lambda *a, **k: None)
        self.config = {}
    def route(self, *a, **k):
        return lambda f: f
    def errorhandler(self, *a, **k):
        return lambda f: f
    def run(self, *a, **k):
        pass
flask.Flask = DummyFlask
flask.render_template = lambda *a, **k: ""
flask.render_template_string = lambda *a, **k: ""
flask.request = types.SimpleNamespace(get_json=lambda: {}, args={})
flask.jsonify = lambda *a, **k: a[0] if a else {}
flask.session = {}
flask.make_response = lambda x=None: x
flask.url_for = lambda e, **o: "/" + e
flask.send_file = lambda *a, **k: None
sys.modules.setdefault("flask", flask)
fs = types.ModuleType("flask_session")
fs.Session = lambda *a, **k: None
sys.modules.setdefault("flask_session", fs)

import app

casos = [
    {"nombre": "simple", "price": 100000, "n_pre": 2, "total_cuotas": 12, "rate": 0.02, "start_date": "2023-01-01", "freq": 1, "refuerzos": []},
    {"nombre": "sin_post", "price": 50000, "n_pre": 10, "total_cuotas": 10, "rate": 0.0, "start_date": "2024-03-31", "freq": 1, "refuerzos": []},
    {"nombre": "con_refuerzos", "price": 200000, "n_pre": 6, "total_cuotas": 24, "rate": 0.015, "start_date": "2025-01-31", "freq": 1,
     "refuerzos": [{"period": 6, "amount": 20000}, {"period": 18, "amount": 15000}]},
    {"nombre": "con_overrides", "price": 180000, "n_pre": 4, "total_cuotas": 18, "rate": 0.012, "start_date": "2025-06-15", "freq": 1,
     "refuerzos": [{"period": 12, "amount": 10000}], "manual": [{"period": 2, "amount": 9000}, {"period": 14, "amount": 14000}]},
    {"nombre": "fortaleza_gs", "price": 420000000, "n_pre": 60, "total_cuotas": 180, "rate": 0.009, "start_date": "2026-01-10", "freq": 1,
     "refuerzos": [{"period": 60, "amount": 40000000}]},
]

salida = []
for c in casos:
    nombre = c.pop("nombre")
    schedule, summary = app.generate_full_schedule(**c)
    salida.append({
        "nombre": nombre,
        "entrada": c,
        "cuotas": [
            {"periodo": r["number"], "fecha": r["date"], "tramo": r["type"], "cuota": r["amount"],
             "interes": r["interest"], "amortizacion": r["principal"], "saldo": r["balance"]}
            for r in schedule
        ],
        "summary": summary,
    })
print(json.dumps(salida, ensure_ascii=False))
