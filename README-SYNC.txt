VIKING — sincronização entre dispositivos

1) Coloca estes ficheiros no mesmo repositório GitHub que usas no Netlify:
   - index.html
   - netlify.toml
   - netlify/functions/sync.mjs

2) No Netlify, abre:
   Project configuration > Environment variables

3) Cria estas variáveis:
   GITHUB_TOKEN = token pessoal refinado do GitHub com acesso Contents: Read and write ao repositório
   GITHUB_OWNER = teu utilizador/organização do GitHub
   GITHUB_REPO = nome do repositório (sem .git)
   GITHUB_DATA_PATH = data/viking_backup.json   (opcional)
   GITHUB_BRANCH = main                         (opcional)

4) Faz um novo deploy.

O ficheiro JSON será criado automaticamente em data/viking_backup.json.
A app continua a guardar localmente em IndexedDB e sincroniza em segundo plano após alterações.

IMPORTANTE:
- O token fica apenas nas variáveis do Netlify e nunca no HTML.
- A sincronização é pensada para um único utilizador.
- Se dois dispositivos alterarem dados ao mesmo tempo, o último upload pode substituir o anterior.
- O botão "Descarregar cloud" permite forçar a cópia do GitHub para o dispositivo atual.
