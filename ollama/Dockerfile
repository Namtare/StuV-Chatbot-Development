FROM ollama/ollama:latest

EXPOSE 11434
ENV OLLAMA_HOST=0.0.0.0

# Create entrypoint inline to avoid line ending issues
RUN echo '#!/bin/bash\n\
echo "Starting Ollama server..."\n\
/bin/ollama serve &\n\
OLLAMA_PID=$!\n\
echo "Waiting for Ollama service to be ready..."\n\
until curl -s http://localhost:11434/api/tags > /dev/null 2>&1; do sleep 1; done\n\
echo "Ollama service is ready!"\n\
if [ -n "$MODEL_NAME" ]; then\n\
    echo "Checking if model $MODEL_NAME exists..."\n\
    if ! ollama list | grep -q "$MODEL_NAME"; then\n\
        echo "Model not found. Pulling model: $MODEL_NAME"\n\
        ollama pull "$MODEL_NAME"\n\
        echo "Model $MODEL_NAME is ready!"\n\
    else\n\
        echo "Model $MODEL_NAME already exists, skipping download."\n\
    fi\n\
else\n\
    echo "No MODEL_NAME specified, skipping model pull."\n\
fi\n\
echo "Ollama is ready to accept requests."\n\
wait $OLLAMA_PID' > /entrypoint.sh && chmod +x /entrypoint.sh

ENTRYPOINT ["/bin/bash", "/entrypoint.sh"]
