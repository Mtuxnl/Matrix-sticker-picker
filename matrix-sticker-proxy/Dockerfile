FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py .

RUN mkdir /data
VOLUME /data

WORKDIR /data

CMD ["python", "/app/server.py"]