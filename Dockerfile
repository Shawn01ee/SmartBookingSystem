FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY quant-pipeline /app/quant-pipeline
COPY fx-dashboard /app/fx-dashboard

RUN python -m pip install --upgrade pip setuptools wheel \
    && python -m pip install -e /app/quant-pipeline

WORKDIR /app/quant-pipeline

EXPOSE 8787

CMD ["uvicorn", "quant_pipeline.api.app:app", "--host", "0.0.0.0", "--port", "8787"]
