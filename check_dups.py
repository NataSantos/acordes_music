import json, sys
from collections import Counter
from urllib.request import urlopen

def check(url, label, key_fn):
    raw = urlopen(url).read()
    data = json.loads(raw)
    print(f"{label}: {len(data)}")
    keys = [key_fn(item) for item in data]
    dups = {k: v for k, v in Counter(keys).items() if v > 1}
    if dups:
        for k, v in dups.items():
            print(f"  Duplicate key: {k} ({v}x)")
            items = [item for item in data if key_fn(item) == k]
            for it in items:
                name = it.get('nome') or it.get('usuario',{}).get('nome','?')
                print(f"    ID: {it['id'][:12]}... {name}")
    else:
        print("  No duplicates")
    print()

check("http://localhost:3000/api/salas", "Salas", lambda s: s["nome"])
check("http://localhost:3000/api/professores", "Professores", lambda p: p["usuario"]["cpf"])
check("http://localhost:3000/api/alunos", "Alunos", lambda a: a["usuario"]["cpf"])
check("http://localhost:3000/api/agendamentos", "Agendamentos (sala+data+horario)",
      lambda a: (a["salaId"], a["data"][:10], a["horario"]))
