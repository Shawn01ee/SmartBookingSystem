.PHONY: summary viz api install311 install311-forecast

summary:
	python -m quant_pipeline.tools.summary

viz:
	kedro viz run --no-browser

api:
	uvicorn quant_pipeline.api.app:app --host 127.0.0.1 --port 8787

install311:
	python3.11 -m venv .venv
	. .venv/bin/activate && pip install -U pip && pip install -e .

install311-forecast:
	python3.11 -m venv .venv
	. .venv/bin/activate && pip install -U pip && pip install -e .[forecast]
