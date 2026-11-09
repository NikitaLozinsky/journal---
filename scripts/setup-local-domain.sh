#!/usr/bin/env bash
# Скрипт привязки локального домена http://journal.edu.local к порту 5000 на Arch Linux
set -euo pipefail

DOMAIN="journal.edu.local"
APP_PORT=5000

echo "=== Настройка локального домена http://${DOMAIN} ==="

if [ "$EUID" -ne 0 ]; then
    echo "Запуск от имени суперпользователя (sudo)..."
    exec sudo bash "$0" "$@"
fi

# 1. Добавление записи в /etc/hosts
if grep -qE "\s+${DOMAIN}(\s|$)" /etc/hosts; then
    echo "✓ Домен ${DOMAIN} уже присутствует в /etc/hosts"
else
    echo "127.0.0.1 ${DOMAIN}" >> /etc/hosts
    echo "✓ Добавлена запись '127.0.0.1 ${DOMAIN}' в /etc/hosts"
fi

# 2. Настройка перенаправления входящего трафика с 80 на 5000 через iptables
if command -v iptables >/dev/null 2>&1; then
    # Перенаправление для локальных запросов (OUTPUT)
    if ! iptables -t nat -C OUTPUT -p tcp -d 127.0.0.1 --dport 80 -j REDIRECT --to-port ${APP_PORT} 2>/dev/null; then
        iptables -t nat -I OUTPUT -p tcp -d 127.0.0.1 --dport 80 -j REDIRECT --to-port ${APP_PORT}
        echo "✓ Настроено локальное перенаправление: 127.0.0.1:80 -> 127.0.0.1:${APP_PORT} (iptables OUTPUT)"
    else
        echo "✓ Правило iptables OUTPUT (порт 80 -> ${APP_PORT}) уже активно"
    fi

    # Перенаправление для внешних запросов (PREROUTING)
    if ! iptables -t nat -C PREROUTING -p tcp --dport 80 -j REDIRECT --to-port ${APP_PORT} 2>/dev/null; then
        iptables -t nat -I PREROUTING -p tcp --dport 80 -j REDIRECT --to-port ${APP_PORT}
        echo "✓ Настроено внешнее перенаправление: :80 -> :${APP_PORT} (iptables PREROUTING)"
    else
        echo "✓ Правило iptables PREROUTING (порт 80 -> ${APP_PORT}) уже активно"
    fi
else
    echo "⚠️ iptables не найден, перенаправление с порта 80 не настроено."
fi

echo ""
echo "=========================================================="
echo "ГОТОВО! Домен http://${DOMAIN} успешно привязан."
echo "Запустите приложение и открывайте в браузере:"
echo "👉 http://${DOMAIN}"
echo "(или http://${DOMAIN}:${APP_PORT})"
echo "=========================================================="
