#!/usr/bin/env bash

# Setup Virtual Environment for WhisperX Service
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/venv"

echo "=================================================="
echo "🚀 Setting up WhisperX Virtual Environment"
echo "Location: $VENV_DIR"
echo "=================================================="

if [ ! -d "$VENV_DIR" ]; then
    echo "📦 Creating python virtual environment..."
    python3 -m venv "$VENV_DIR"
fi

echo "🔄 Activating virtual environment & updating pip..."
source "$VENV_DIR/bin/activate"
pip install --upgrade pip setuptools wheel

echo "📥 Installing WhisperX & dependencies..."
pip install -r "$SCRIPT_DIR/requirements.txt"

echo "=================================================="
echo "✅ WhisperX Virtual Environment Ready!"
echo "Python binary: $VENV_DIR/bin/python"
echo "Usage example:"
echo "  $VENV_DIR/bin/python $SCRIPT_DIR/transcribe_cli.py --audio sample.mp3 --output transcript.json"
echo "=================================================="
