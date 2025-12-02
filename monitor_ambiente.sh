#!/bin/bash

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

USO=$(df / | tail -1 | awk '{print $5}' | tr -d '%')

if [ $USO -gt 90 ]; then
    echo "Seu sistema está critico com o uso de $USO%"
elif [ $USO -gt 70 ] && [ $USO -lt 90 ]; then
    echo "Esse é um alerta que seu sitema está com uso de $USO%"
else
    echo "Seu sistema está OK para prosseguir com o uso de $USO%"
fi

PROCESSOS=$(ps aux | wc -l)

echo "Número de processos em execução: $PROCESSOS"

echo "=== TOP 5 processos que mais consomem memória ==="


ps aux | sort -nrk 4 | head -n 5 | awk '{print $2, $11}' |
while read pid cmd; do
    echo "PID: $pid | CMD: $cmd"
done



