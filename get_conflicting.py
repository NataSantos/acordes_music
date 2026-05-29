import json
from urllib.request import urlopen
raw = urlopen("http://localhost:3000/api/agendamentos").read()
data = json.loads(raw)
dups = [a for a in data if a['salaId']=='44a5525c-40a6-405b-8bed-cb8296d90847' and a['data'][:10] in ('2026-05-21','2026-05-20') and a['horario'] in ('19:00','14:00')]
for a in sorted(dups, key=lambda x: (x['data'], x['horario'], x['createdAt'])):
    print(f"ID:{a['id'][:12]} Data:{a['data'][:10]} {a['horario']} Prof:{a['professor']['usuario']['nome'][:22]} Aluno:{a['aluno']['usuario']['nome'][:22]} Status:{a['status']} Criado:{a['createdAt']}")
