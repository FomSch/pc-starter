#!/bin/bash

echo "Restarting dc-bot service..."
sudo systemctl restart dc-bot

if systemctl is-active --quiet dc-bot; then
    echo "✓ dc-bot service restarted successfully"
    exit 0
else
    echo "✗ Failed to restart dc-bot service"
    echo "Service status:"
    systemctl status dc-bot --no-pager -l
    exit 1
fi
