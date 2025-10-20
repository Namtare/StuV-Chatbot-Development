#!/bin/bash

# Start Ollama in the background
/bin/ollama serve &

# Wait for Ollama to be ready
echo "Waiting for Ollama service to be ready..."
until curl -s http://localhost:11434/api/tags > /dev/null 2>&1; do
    sleep 1
done

echo "Ollama service is ready!"

# Pull the model if MODEL_NAME is set
if [ ! -z "$MODEL_NAME" ]; then
    echo "Pulling model: $MODEL_NAME"
    ollama pull $MODEL_NAME
    echo "Model $MODEL_NAME is ready!"
fi

# Keep the container running
wait
