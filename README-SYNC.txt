VIKING — sincronização entre dispositivos

Estrutura:
- index.html
- netlify.toml
- netlify/functions/sync/index.mjs

IMPORTANTE:
1. O repositório GitHub que guarda viking_backup.json deve ser PRIVADO. Se o repositório estiver Público, os dados sincronizados ficam públicos.
2. No Netlify, manter estas variáveis com scope Functions:
   GITHUB_TOKEN
   GITHUB_OWNER
   GITHUB_REPO
   GITHUB_BRANCH=main
3. Fazer commit destes ficheiros no GitHub e aguardar novo deploy no Netlify.
4. Depois confirmar em Logs & metrics > Functions que aparece "sync".
5. O endpoint é /.netlify/functions/sync.

A aplicação continua a usar IndexedDB localmente e usa a Function apenas para ler/gravar o backup JSON no GitHub.
