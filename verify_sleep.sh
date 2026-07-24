#!/bin/bash

echo "Starting Deep Sleep Verification..."
echo "This script will monitor the 'tauri-app' process CPU and Memory usage."

PID=$(pgrep -f "tauri-app")
if [ -z "$PID" ]; then
    echo "tauri-app is not running."
    exit 1
fi

echo "Found tauri-app with PID: $PID"
echo "Monitoring for 15 seconds. Please ensure the app is in Passthrough mode (deep sleep)..."

echo "Time | %CPU | %MEM"
for i in {1..15}; do
    NOW=$(date "+%H:%M:%S")
    ps -p $PID -o %cpu,%mem | tail -n 1 | awk -v time="$NOW" '{print time, "|", $1, " |", $2}'
    sleep 1
done

echo "Monitoring complete. If CPU is consistently 0.0, Deep Sleep has zero overhead."
