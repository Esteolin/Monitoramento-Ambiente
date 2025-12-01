!/bin/bash

echo "======================================"
echo "  MONITORAMENTO BÁSICO DO AMBIENTE"
echo "======================================"

echo "Digite o diretório onde a aplicação será instalada:"
read DIRETORIO

if [ -d "$DIRETORIO" ]; then
    echo "O diretório existe"

    if [ -r "$DIRETORIO" ] && [ -w "$DIRETORIO" ] && [ -x "$DIRETORIO" ]; then
        echo "Você possui permissões de leitura, escrita e execução"
    else
        echo "[AVISO] Você não possui todas as permissões necessárias (rwx)."
    fi
else
    echo "Erro: o diretório informado não existe."
    exit 1
fi